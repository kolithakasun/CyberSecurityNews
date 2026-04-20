import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createAggregator } from './aggregator.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  process.env.CLIENT_ORIGINS ||
  'http://localhost:5173';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 120_000);
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY || 5);
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '..', 'data');

const aggregator = createAggregator({
  cacheTtlMs: CACHE_TTL_MS,
  fetchConcurrency: FETCH_CONCURRENCY,
  cacheDir: CACHE_DIR,
});

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: CLIENT_ORIGIN.split(',').map((s) => s.trim()),
});

function filterItems(items, query) {
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
  if (source) {
    out = out.filter((it) => {
      const hay = `${it.source} ${(it.merged_sources || []).join(' ')}`.toLowerCase();
      return hay.includes(source);
    });
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

app.get('/health', async () => ({ ok: true }));

app.get('/sources', async () => ({
  sources: aggregator.listSources(),
}));

app.get('/news', async (req) => {
  const force = String(req.query.refresh || '').toLowerCase() === 'true';
  const data = await aggregator.loadFeeds({ force });
  const filtered = filterItems(data.items, req.query);
  return {
    items: filtered,
    stats: {
      ...data.stats,
      filtered_count: filtered.length,
    },
    errors: data.errors,
    fetchedAt: data.fetchedAt,
    cache_ttl_ms: CACHE_TTL_MS,
  };
});

app.get('/critical', async (req) => {
  const force = String(req.query.refresh || '').toLowerCase() === 'true';
  const data = await aggregator.loadFeeds({ force });
  const critical = filterItems(
    data.items.filter((i) => i.category === 'critical'),
    req.query,
  );
  return {
    items: critical,
    stats: data.stats,
    errors: data.errors,
    fetchedAt: data.fetchedAt,
  };
});

app.post('/refresh', async () => {
  await aggregator.invalidate();
  const data = await aggregator.loadFeeds({ force: true });
  return {
    ok: true,
    stats: data.stats,
    errors: data.errors,
    fetchedAt: data.fetchedAt,
  };
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API listening on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
