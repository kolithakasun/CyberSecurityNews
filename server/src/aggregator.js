import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RSS_FEEDS } from './config.js';
import { createDiskCache } from './cache.js';
import {
  fetchFeedItems,
  mergeSimilarItems,
  primaryDedupe,
} from './normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function mapPool(items, concurrency, fn) {
  const results = [];
  let idx = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = { error: e, feed: items[i] };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function summarizeSources(items) {
  const counts = new Map();
  for (const it of items) {
    const primary = (it.merged_sources && it.merged_sources[0]) || it.source;
    counts.set(primary, (counts.get(primary) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

function statsFor(items, { now = new Date() } = {}) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = startOfDay.toISOString();
  let criticalToday = 0;
  let newCves = 0;
  const cveSet = new Set();

  for (const it of items) {
    if (it.category === 'critical' && it.published_date && it.published_date >= iso) {
      criticalToday += 1;
    }
    if (it.published_date && it.published_date >= iso) {
      for (const c of it.cves || []) {
        if (!cveSet.has(c)) {
          cveSet.add(c);
          newCves += 1;
        }
      }
    }
  }

  return {
    critical_threats_today: criticalToday,
    new_cves_today: newCves,
    top_sources: summarizeSources(items).slice(0, 8),
    total_items: items.length,
    fetched_at: new Date().toISOString(),
  };
}

export function createAggregator(options = {}) {
  const ttlMs = Number(options.cacheTtlMs ?? 120_000);
  const concurrency = Number(options.fetchConcurrency ?? 5);
  const cacheDir =
    options.cacheDir || path.join(__dirname, '..', 'data');

  const diskCache = createDiskCache({ cacheDir, ttlMs });

  let memoryPayload = null;
  let memoryAt = 0;

  async function loadFeeds({ force = false } = {}) {
    if (!force) {
      const memOk = memoryPayload && Date.now() - memoryAt <= ttlMs;
      if (memOk) return memoryPayload;
      const disk = await diskCache.get(ttlMs);
      if (disk) {
        memoryPayload = disk;
        memoryAt = disk.fetchedAt || Date.now();
        return disk;
      }
    }

    const fetchResults = await mapPool(RSS_FEEDS, concurrency, async (url) => {
      const rows = await fetchFeedItems(url);
      return rows;
    });

    const errors = [];
    const all = [];
    for (const chunk of fetchResults) {
      if (chunk && chunk.error) {
        errors.push({
          feed: chunk.feed,
          message: chunk.error.message || String(chunk.error),
        });
        continue;
      }
      if (Array.isArray(chunk)) all.push(...chunk);
    }

    const deduped = primaryDedupe(all);
    const merged = mergeSimilarItems(deduped, { similarity: 0.72 });
    merged.sort((a, b) => {
      const catOrder = { critical: 4, high: 3, medium: 2, informational: 1 };
      const co = (catOrder[b.category] || 0) - (catOrder[a.category] || 0);
      if (co !== 0) return co;
      const da = dateScore(a);
      const db = dateScore(b);
      return db - da;
    });

    const payload = {
      items: merged,
      stats: statsFor(merged),
      errors,
      feeds: RSS_FEEDS,
    };

    memoryPayload = { ...payload, fetchedAt: Date.now() };
    memoryAt = memoryPayload.fetchedAt;
    await diskCache.set(memoryPayload);
    return memoryPayload;
  }

  return {
    loadFeeds,
    async invalidate() {
      memoryPayload = null;
      memoryAt = 0;
      await diskCache.clear();
    },
    listSources() {
      return RSS_FEEDS.map((url) => ({
        url,
        hostname: (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return url;
          }
        })(),
      }));
    },
  };
}

function dateScore(item) {
  const t = item.published_date ? Date.parse(item.published_date) : 0;
  return Number.isNaN(t) ? 0 : t;
}
