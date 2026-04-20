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

/**
 * Extract the API endpoint name from the Netlify event.
 *
 * Netlify does NOT inject redirect query params (e.g. ?apiPath=:splat) into
 * event.queryStringParameters for POST requests — only GET. So we use a
 * multi-step strategy:
 *
 * 1. event.queryStringParameters.apiPath  (works for GET redirects)
 * 2. ?apiPath= anywhere in event.rawUrl   (rewritten destination URL)
 * 3. /api/<endpoint> in event.rawUrl      (original request URL, always present)
 * 4. /api/<endpoint> in event.path        (fallback)
 */
function parseApiPath(event) {
  // 1. Injected by redirect for GET requests
  const qs = event.queryStringParameters || {};
  if (qs.apiPath) return qs.apiPath.replace(/^\/+|\/+$/g, '');

  const raw = String(event.rawUrl || event.path || '');

  // 2. ?apiPath= present somewhere in the rewritten URL
  const qm = raw.match(/[?&]apiPath=([^&#]+)/);
  if (qm) return decodeURIComponent(qm[1]).replace(/^\/+|\/+$/g, '');

  // 3. Original /api/<endpoint> path pattern — reliable for all methods
  const pm = raw.match(/\/api\/([^/?&#\s]+)/);
  if (pm) return pm[1];

  // 4. Same check on event.path alone
  const ep = String(event.path || '').match(/\/api\/([^/?&#\s]+)/);
  if (ep) return ep[1];

  return '';
}

const KNOWN_PATHS = new Set(['health', 'sources', 'news', 'critical', 'refresh']);

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const apiPath = parseApiPath(event) || 'news';
  const agg = getAggregator();

  // Debug header so we can verify path resolution in Netlify function logs
  const debugHeaders = {
    ...corsHeaders,
    'X-Resolved-Path': apiPath,
    'X-Http-Method': event.httpMethod,
  };

  if (!KNOWN_PATHS.has(apiPath)) {
    return { statusCode: 404, headers: debugHeaders, body: JSON.stringify({ error: 'Not found', path: apiPath }) };
  }

  try {
    if (apiPath === 'health') {
      return response(200, httpApi.handleHealth());
    }

    if (apiPath === 'sources') {
      return response(200, httpApi.handleSources(agg));
    }

    if (apiPath === 'news') {
      const body = await httpApi.handleNews(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return response(200, body);
    }

    if (apiPath === 'critical') {
      const body = await httpApi.handleCritical(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return response(200, body);
    }

    if (apiPath === 'refresh') {
      // Accept GET and POST — Netlify can normalise the method during a 200 rewrite,
      // and there is no request body to parse here anyway.
      const body = await httpApi.handleRefresh(agg);
      return response(200, body);
    }

    return response(404, { error: 'Not found', path: apiPath });
  } catch (err) {
    console.error('api function error', err);
    return response(500, { error: 'Internal error', message: err?.message || String(err) });
  }
};
