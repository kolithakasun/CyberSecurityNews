/**
 * Netlify Function — same RSS API as Fastify, for same-site deploy.
 * Cache directory must be writable on Lambda (/tmp).
 */
import { createAggregator } from '../../server/src/aggregator.js';
import * as httpApi from '../../server/src/httpApi.js';

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 120_000);
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY || 4);

let aggregator;

function getAggregator() {
  if (!aggregator) {
    aggregator = createAggregator({
      cacheTtlMs: CACHE_TTL_MS,
      fetchConcurrency: FETCH_CONCURRENCY,
      cacheDir: '/tmp/csnews-cache',
    });
  }
  return aggregator;
}

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function parseApiPath(event) {
  const qs = event.queryStringParameters || {};
  if (qs.apiPath) return qs.apiPath.replace(/^\/+|\/+$/g, '');
  if (qs.path) return qs.path.replace(/^\/+|\/+$/g, '');
  const raw = event.rawUrl || event.path || '';
  const m = String(raw).match(/[?&]apiPath=([^&]+)/);
  if (m) return decodeURIComponent(m[1]).replace(/^\/+|\/+$/g, '');
  return '';
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const apiPath = parseApiPath(event) || 'news';
  const agg = getAggregator();

  try {
    if (apiPath === 'health' && event.httpMethod === 'GET') {
      return response(200, httpApi.handleHealth());
    }
    if (apiPath === 'sources' && event.httpMethod === 'GET') {
      return response(200, httpApi.handleSources(agg));
    }
    if (apiPath === 'news' && event.httpMethod === 'GET') {
      const body = await httpApi.handleNews(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return response(200, body);
    }
    if (apiPath === 'critical' && event.httpMethod === 'GET') {
      const body = await httpApi.handleCritical(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return response(200, body);
    }
    if (apiPath === 'refresh' && event.httpMethod === 'POST') {
      const body = await httpApi.handleRefresh(agg);
      return response(200, body);
    }
    return response(404, { error: 'Not found', path: apiPath });
  } catch (err) {
    console.error('api function error', err);
    return response(500, { error: 'Internal error', message: err?.message || String(err) });
  }
};
