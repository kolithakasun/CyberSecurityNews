/**
 * Shared HTTP response logic for Fastify and Netlify Functions.
 */

export function filterItems(items, query) {
  let out = items;
  const kw = (query.keyword || '').trim().toLowerCase();
  const source = (query.source || '').trim().toLowerCase();
  const severity = (query.severity || '').trim().toLowerCase();
  const from = query.from ? Date.parse(query.from) : null;
  const to = query.to ? Date.parse(query.to) : null;

  if (kw) {
    out = out.filter((it) => {
      const blob = `${it.title} ${it.summary} ${(it.tags || []).join(' ')}`.toLowerCase();
      return blob.includes(kw);
    });
  }
  // Support comma-separated multi-source OR filter
  if (source) {
    const sourceParts = source.split(',').map((s) => s.trim()).filter(Boolean);
    if (sourceParts.length > 0) {
      out = out.filter((it) => {
        const hay = `${it.source} ${(it.merged_sources || []).join(' ')}`.toLowerCase();
        return sourceParts.some((p) => hay.includes(p));
      });
    }
  }
  if (severity && severity !== 'all') {
    out = out.filter((it) => it.category === severity);
  }
  if (from !== null && !Number.isNaN(from)) {
    out = out.filter((it) => {
      if (!it.published_date) return true;
      return Date.parse(it.published_date) >= from;
    });
  }
  if (to !== null && !Number.isNaN(to)) {
    out = out.filter((it) => {
      if (!it.published_date) return true;
      return Date.parse(it.published_date) <= to;
    });
  }
  return out;
}

function stripRoutingKeys(query) {
  if (!query || typeof query !== 'object') return {};
  const out = { ...query };
  delete out.apiPath;
  delete out.path;
  return out;
}

export async function handleNews(aggregator, query, { cacheTtlMs }) {
  const q = stripRoutingKeys(query);
  const force = String(q.refresh || '').toLowerCase() === 'true';
  const data = await aggregator.loadFeeds({ force });
  const filtered = filterItems(data.items, q);
  return {
    items: filtered,
    stats: {
      ...data.stats,
      filtered_count: filtered.length,
    },
    errors: data.errors,
    fetchedAt: data.fetchedAt,
    cache_ttl_ms: cacheTtlMs,
  };
}

export async function handleCritical(aggregator, query, { cacheTtlMs }) {
  const q = stripRoutingKeys(query);
  const force = String(q.refresh || '').toLowerCase() === 'true';
  const data = await aggregator.loadFeeds({ force });
  const critical = filterItems(data.items.filter((i) => i.category === 'critical'), q);
  return {
    items: critical,
    stats: data.stats,
    errors: data.errors,
    fetchedAt: data.fetchedAt,
  };
}

export function handleSources(aggregator) {
  return {
    sources: aggregator.listSources(),
  };
}

export async function handleRefresh(aggregator) {
  await aggregator.invalidate();
  const data = await aggregator.loadFeeds({ force: true });
  return {
    ok: true,
    stats: data.stats,
    errors: data.errors,
    fetchedAt: data.fetchedAt,
  };
}

export function handleHealth() {
  return { ok: true };
}
