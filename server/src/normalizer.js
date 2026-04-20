import Parser from 'rss-parser';
import {
  CVE_REGEX,
  VENDOR_TAGS,
} from './config.js';
import { classifyCategoryAndSeverity, inferAttackTypes, normalizeText } from './classifier.js';

const parser = new Parser({
  timeout: 25000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; CyberSecurityNewsBot/1.0; +https://github.com) AppleWebKit/537.36 (KHTML, like Gecko)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

function hostnameSource(feedUrl) {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {
    return feedUrl;
  }
}

function pickTitle(item) {
  return (
    item.title ||
    item['cve-id'] ||
    item.id ||
    item.name ||
    'Untitled'
  ).trim();
}

function pickLink(item) {
  const link = item.link || item.guid;
  if (!link) return '';
  if (typeof link === 'string') return link;
  return link.href || '';
}

function pickSummary(item) {
  const content =
    item.contentSnippet ||
    item.summary ||
    item.description ||
    item.content ||
    '';
  return String(content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickDate(item) {
  const raw =
    item.isoDate ||
    item.pubDate ||
    item.published ||
    item.updated ||
    item.date ||
    null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function extractCves(text) {
  if (!text) return [];
  const set = new Set();
  let m;
  const re = new RegExp(CVE_REGEX.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    set.add(m[0].toUpperCase());
  }
  return [...set];
}

function extractVendorTags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return VENDOR_TAGS.filter((v) => lower.includes(v.toLowerCase()));
}

export async function fetchFeedItems(feedUrl) {
  const feed = await parser.parseURL(feedUrl);
  const source = feed.title?.trim() || hostnameSource(feedUrl);
  const items = feed.items || [];
  return items.map((item) => {
    const title = pickTitle(item);
    const link = pickLink(item);
    const summary = pickSummary(item);
    const published_date = pickDate(item);
    const textBlob = `${title} ${summary}`;
    const cves = extractCves(textBlob);
    const vendors = extractVendorTags(textBlob);
    const attackTypes = inferAttackTypes(textBlob);
    const tags = [...new Set([...cves, ...vendors, ...attackTypes])];
    const { category, severity_score, classification_reasons } =
      classifyCategoryAndSeverity({ title, summary, tags });

    return {
      id: link || `${feedUrl}::${title}`,
      title,
      source,
      feed_url: feedUrl,
      published_date,
      summary: summary.slice(0, 2000),
      link,
      tags,
      cves,
      category,
      severity_score,
      classification_reasons,
      merged_sources: [source],
    };
  });
}

export function normalizeTitleKey(title) {
  return normalizeText(title).replace(/[^\p{L}\p{N}\s]/gu, '');
}

export function primaryDedupe(items) {
  const sorted = [...items].sort((a, b) => dateScore(b) - dateScore(a));
  const seenLinks = new Set();
  const seenTitles = new Set();
  const out = [];
  for (const item of sorted) {
    const lk = item.link?.trim().toLowerCase();
    const tk = normalizeTitleKey(item.title);
    if (lk && seenLinks.has(lk)) continue;
    if (tk && seenTitles.has(tk)) continue;
    if (lk) seenLinks.add(lk);
    if (tk) seenTitles.add(tk);
    out.push(item);
  }
  return out;
}

function dateScore(item) {
  const t = item.published_date ? Date.parse(item.published_date) : 0;
  return Number.isNaN(t) ? 0 : t;
}

function tokenSet(str) {
  const tokens = normalizeTitleKey(str).split(/\s+/).filter(Boolean);
  return new Set(tokens);
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/**
 * Merge items from different sources when titles are highly similar.
 */
export function mergeSimilarItems(items, { similarity = 0.72 } = {}) {
  const sorted = [...items].sort((a, b) => dateScore(b) - dateScore(a));
  const clusters = [];

  for (const item of sorted) {
    const a = tokenSet(item.title);
    let placed = false;
    for (const cluster of clusters) {
      const rep = cluster[0];
      const b = tokenSet(rep.title);
      const sim = jaccard(a, b);
      const containment =
        a.size && b.size
          ? Math.min(
              [...a].filter((t) => b.has(t)).length / a.size,
              [...b].filter((t) => a.has(t)).length / b.size,
            )
          : 0;
      if (sim >= similarity || containment >= 0.85) {
        cluster.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([item]);
  }

  return clusters.map((group) => {
    if (group.length === 1) return group[0];
    const primary = [...group].sort((a, b) => dateScore(b) - dateScore(a))[0];
    const sources = new Set();
    for (const g of group) {
      for (const s of g.merged_sources || [g.source]) sources.add(s);
    }
    const allTags = new Set(primary.tags || []);
    let bestSeverity = primary.severity_score || 0;
    let bestCat = primary.category;
    const order = { critical: 4, high: 3, medium: 2, informational: 1 };

    for (const g of group) {
      for (const t of g.tags || []) allTags.add(t);
      if ((g.severity_score || 0) > bestSeverity) bestSeverity = g.severity_score;
      if (order[g.category] > order[bestCat]) bestCat = g.category;
    }

    return {
      ...primary,
      tags: [...allTags],
      cves: [...new Set([...(primary.cves || []), ...group.flatMap((g) => g.cves || [])])],
      merged_sources: [...sources],
      source: [...sources].slice(0, 2).join(' + ') + (sources.size > 2 ? ` +${sources.size - 2}` : ''),
      severity_score: bestSeverity,
      category: bestCat,
    };
  });
}
