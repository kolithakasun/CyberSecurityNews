/**
 * Netlify Function — RSS API + user prefs + email notifications.
 * All /api/* requests are rewritten here via netlify.toml redirect.
 */
import { createAggregator } from '../../server/src/aggregator.js';
import * as httpApi from '../../server/src/httpApi.js';
import { sendCriticalAlert, isEmailConfigured } from '../email.mjs';

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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function ok(body) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) };
}
function err(status, message) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify({ error: message }) };
}

/**
 * Extract the API endpoint name from the Netlify event using multiple strategies:
 * 1. event.queryStringParameters.apiPath  (works for most redirected GETs)
 * 2. ?apiPath= in the raw URL query string  (covers POST where Netlify may not inject qs)
 * 3. /api/<endpoint> path pattern from rawUrl / path  (most reliable fallback)
 */
function parseApiPath(event) {
  const qs = event.queryStringParameters || {};
  if (qs.apiPath) return qs.apiPath.replace(/^\/+|\/+$/g, '');

  const raw = String(event.rawUrl || event.path || '');
  const qm = raw.match(/[?&]apiPath=([^&#]+)/);
  if (qm) return decodeURIComponent(qm[1]).replace(/^\/+|\/+$/g, '');

  const pm = raw.match(/\/api\/([^/?&#\s]+)/);
  if (pm) return pm[1];

  const ep = String(event.path || '').match(/\/api\/([^/?&#\s]+)/);
  if (ep) return ep[1];

  return '';
}

/**
 * Get the authenticated user from Netlify Identity context.
 * Netlify auto-decodes the Identity JWT from the Authorization header.
 * Falls back to manual base64-decode for when context isn't populated.
 */
function getUser(event, context) {
  // Netlify-decoded (standard)
  if (context?.clientContext?.user) return context.clientContext.user;

  // Manual decode fallback
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(auth.slice(7).split('.')[1], 'base64').toString('utf8'),
      );
      return payload;
    } catch {
      return null;
    }
  }
  return null;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ─── Netlify Blobs helpers ────────────────────────────────────────────────────

let blobStore = null;
async function getStore() {
  if (blobStore) return blobStore;
  try {
    const { getStore: gs } = await import('@netlify/blobs');
    blobStore = gs('csnews-prefs');
    return blobStore;
  } catch {
    return null;
  }
}

async function readPrefs(userId) {
  const store = await getStore();
  if (!store) return null;
  try {
    const raw = await store.get(`user:${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writePrefs(userId, prefs) {
  const store = await getStore();
  if (!store) throw new Error('Blob store unavailable');
  await store.set(`user:${userId}`, JSON.stringify(prefs));
}

/** Maintain a flat subscribers list so the scheduled digest can iterate all users */
async function updateSubscribersList(userId, email, prefs) {
  const store = await getStore();
  if (!store) return;
  try {
    const raw = await store.get('subscribers');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((s) => s.userId === userId);
    const entry = {
      userId,
      email: prefs.alertEmail || email,
      criticalAlerts: Boolean(prefs.criticalAlerts),
      dailyDigest: Boolean(prefs.dailyDigest),
    };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    await store.set('subscribers', JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const KNOWN_PATHS = new Set([
  'health', 'sources', 'news', 'critical', 'refresh', 'prefs', 'notify',
]);

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const apiPath = parseApiPath(event) || 'news';
  const agg = getAggregator();

  if (!KNOWN_PATHS.has(apiPath)) {
    return err(404, `Unknown path: ${apiPath}`);
  }

  try {
    // ── Public routes ────────────────────────────────────────────────────────
    if (apiPath === 'health') return ok(httpApi.handleHealth());

    if (apiPath === 'sources') return ok(httpApi.handleSources(agg));

    if (apiPath === 'news') {
      const body = await httpApi.handleNews(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return ok(body);
    }

    if (apiPath === 'critical') {
      const body = await httpApi.handleCritical(agg, event.queryStringParameters || {}, {
        cacheTtlMs: CACHE_TTL_MS,
      });
      return ok(body);
    }

    if (apiPath === 'refresh') {
      const body = await httpApi.handleRefresh(agg);
      return ok(body);
    }

    // ── Authenticated routes ─────────────────────────────────────────────────
    const user = getUser(event, context);
    if (!user) return err(401, 'Unauthorized — sign in with Netlify Identity');

    const userId = user.sub || user.id || user.email;

    // GET /api/prefs
    if (apiPath === 'prefs' && event.httpMethod === 'GET') {
      const prefs = await readPrefs(userId);
      return ok(prefs || { alertEmail: user.email, criticalAlerts: true, dailyDigest: true });
    }

    // PUT /api/prefs
    if (apiPath === 'prefs' && (event.httpMethod === 'PUT' || event.httpMethod === 'POST')) {
      const incoming = parseBody(event);
      const prefs = {
        alertEmail: incoming.alertEmail || user.email,
        criticalAlerts: Boolean(incoming.criticalAlerts ?? true),
        dailyDigest: Boolean(incoming.dailyDigest ?? true),
        slackWebhook: incoming.slackWebhook || '',
      };
      await writePrefs(userId, prefs);
      await updateSubscribersList(userId, user.email, prefs);
      return ok({ saved: true });
    }

    // POST /api/notify — client reports new critical items; send email to this user
    if (apiPath === 'notify') {
      const { items = [] } = parseBody(event);
      if (!items.length) return ok({ sent: 0 });

      const prefs = await readPrefs(userId);
      if (!prefs?.criticalAlerts || !prefs?.alertEmail) {
        return ok({ sent: 0, reason: 'Alerts disabled or no email configured' });
      }
      if (!isEmailConfigured()) {
        return ok({ sent: 0, reason: 'RESEND_API_KEY not configured' });
      }

      let sent = 0;
      for (const item of items.slice(0, 5)) {
        try {
          await sendCriticalAlert(prefs.alertEmail, item);
          sent++;
        } catch (e) {
          console.error('Email send error:', e.message);
        }
      }
      return ok({ sent });
    }

    return err(404, `Unknown path: ${apiPath}`);
  } catch (e) {
    console.error('api function error', e);
    return err(500, e?.message || String(e));
  }
};
