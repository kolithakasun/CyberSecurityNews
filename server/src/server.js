import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createAggregator } from './aggregator.js';
import * as httpApi from './httpApi.js';
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

app.get('/health', async () => httpApi.handleHealth());

app.get('/sources', async () => httpApi.handleSources(aggregator));

app.get('/news', async (req) => httpApi.handleNews(aggregator, req.query, { cacheTtlMs: CACHE_TTL_MS }));

app.get('/critical', async (req) =>
  httpApi.handleCritical(aggregator, req.query, { cacheTtlMs: CACHE_TTL_MS }),
);

// Accept both GET and POST so local dev (Fastify) and Netlify (rewrite) both work.
app.get('/refresh', async () => httpApi.handleRefresh(aggregator));
app.post('/refresh', async () => httpApi.handleRefresh(aggregator));

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API listening on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
