/**
 * Netlify Function — RSS API + user prefs + email/webhook notifications.
 * All /api/* requests are rewritten here via netlify.toml redirect.
 *
 * Admin detection: set ADMIN_EMAILS env var to comma-separated list of admin email addresses.
 */
import { createAggregator } from '../../server/src/aggregator.js';
import * as httpApi from '../../server/src/httpApi.js';
import { sendCriticalAlert, isEmailConfigured } from '../email.mjs';
import { broadcastCritical } from '../webhooks.mjs';

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 120_000);
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY || 4);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

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

const ok = (body) => ({ statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) });
const err = (status, message) => ({ statusCode: status, headers: corsHeaders, body: JSON.stringify({ error: message }) });

// ─── Path extraction ──────────────────────────────────────────────────────────

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

// ─── Auth ────────────────────────────────────────────────────────────────────

function getUser(event, context) {
  if (context?.clientContext?.user) return context.clientContext.user;
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      return JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64').toString('utf8'));
    } catch { return null; }
  }
  return null;
}

function isAdmin(user) {
  if (!user) return false;
  if (!ADMIN_EMAILS.length) return false;
  return ADMIN_EMAILS.includes((user.email || '').toLowerCase());
}

// ─── Body parsing ─────────────────────────────────────────────────────────────

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch { return {}; }
}

// ─── Netlify Blobs ────────────────────────────────────────────────────────────

let _store = null;
async function getStore() {
  if (_store) return _store;
  try {
    const { getStore: gs } = await import('@netlify/blobs');
    _store = gs('csnews-prefs');
    return _store;
  } catch { return null; }
}

async function blobGet(key) {
  const s = await getStore();
  if (!s) return null;
  try { const r = await s.get(key); return r ? JSON.parse(r) : null; } catch { return null; }
}

async function blobSet(key, value) {
  const s = await getStore();
  if (!s) throw new Error('Blob store unavailable');
  await s.set(key, JSON.stringify(value));
}

// ─── Prefs helpers ────────────────────────────────────────────────────────────

function normalisePrefs(incoming, fallbackEmail) {
  // Support migration from old single-email field
  let emails = incoming.alertEmails;
  if (!Array.isArray(emails)) {
    const legacy = incoming.alertEmail || '';
    emails = legacy ? [legacy] : (fallbackEmail ? [fallbackEmail] : []);
  }
  return {
    alertEmails: [...new Set(emails.map((e) => e.trim()).filter(Boolean))],
    criticalAlerts: Boolean(incoming.criticalAlerts ?? true),
    dailyDigest: Boolean(incoming.dailyDigest ?? true),
  };
}

async function updateSubscribersList(userId, prefs) {
  try {
    const list = (await blobGet('subscribers')) || [];
    const idx = list.findIndex((s) => s.userId === userId);
    const entry = {
      userId,
      emails: prefs.alertEmails,
      criticalAlerts: prefs.criticalAlerts,
      dailyDigest: prefs.dailyDigest,
    };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    await blobSet('subscribers', list);
  } catch { /* non-fatal */ }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const KNOWN_PATHS = new Set([
  'health', 'sources', 'news', 'critical', 'refresh',
  'prefs', 'notify', 'admin-config',
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
      return ok(await httpApi.handleNews(agg, event.queryStringParameters || {}, { cacheTtlMs: CACHE_TTL_MS }));
    }
    if (apiPath === 'critical') {
      return ok(await httpApi.handleCritical(agg, event.queryStringParameters || {}, { cacheTtlMs: CACHE_TTL_MS }));
    }
    if (apiPath === 'refresh') return ok(await httpApi.handleRefresh(agg));

    // ── Authenticated routes ─────────────────────────────────────────────────
    const user = getUser(event, context);
    if (!user) return err(401, 'Unauthorized — sign in with Netlify Identity');

    const userId = user.sub || user.id || user.email;
    const userIsAdmin = isAdmin(user);

    // ── GET /api/prefs ───────────────────────────────────────────────────────
    if (apiPath === 'prefs' && event.httpMethod === 'GET') {
      const saved = await blobGet(`user:${userId}`);
      const prefs = saved
        ? normalisePrefs(saved, user.email)
        : { alertEmails: [user.email].filter(Boolean), criticalAlerts: true, dailyDigest: true };
      return ok({ ...prefs, isAdmin: userIsAdmin });
    }

    // ── PUT /api/prefs ───────────────────────────────────────────────────────
    if (apiPath === 'prefs' && (event.httpMethod === 'PUT' || event.httpMethod === 'POST')) {
      const incoming = parseBody(event);
      const prefs = normalisePrefs(incoming, user.email);
      await blobSet(`user:${userId}`, prefs);
      await updateSubscribersList(userId, prefs);
      return ok({ saved: true });
    }

    // ── GET /api/admin-config  (admin only) ──────────────────────────────────
    if (apiPath === 'admin-config' && event.httpMethod === 'GET') {
      if (!userIsAdmin) return err(403, 'Admin access required — set ADMIN_EMAILS env var');
      const cfg = (await blobGet('admin-config')) || { slackWebhook: '', teamsWebhook: '', notifyOnCritical: true, notifyOnDigest: true };
      return ok(cfg);
    }

    // ── PUT /api/admin-config  (admin only) ──────────────────────────────────
    if (apiPath === 'admin-config' && (event.httpMethod === 'PUT' || event.httpMethod === 'POST')) {
      if (!userIsAdmin) return err(403, 'Admin access required — set ADMIN_EMAILS env var');
      const incoming = parseBody(event);
      const cfg = {
        slackWebhook: (incoming.slackWebhook || '').trim(),
        teamsWebhook: (incoming.teamsWebhook || '').trim(),
        notifyOnCritical: Boolean(incoming.notifyOnCritical ?? true),
        notifyOnDigest: Boolean(incoming.notifyOnDigest ?? true),
      };
      await blobSet('admin-config', cfg);
      return ok({ saved: true });
    }

    // ── POST /api/notify ─────────────────────────────────────────────────────
    if (apiPath === 'notify') {
      const { items = [] } = parseBody(event);
      if (!items.length) return ok({ email: 0, slack: null, teams: null });

      const prefs = await blobGet(`user:${userId}`);
      const adminCfg = (await blobGet('admin-config')) || {};
      const results = { email: 0, slack: null, teams: null };

      // Email to this user's alert addresses
      if (prefs?.criticalAlerts && prefs?.alertEmails?.length && isEmailConfigured()) {
        for (const item of items.slice(0, 5)) {
          try {
            await sendCriticalAlert(prefs.alertEmails, item);
            results.email++;
          } catch (e) {
            console.error('[notify] Email error:', e.message);
          }
        }
      }

      // Admin Slack + Teams broadcast
      if (adminCfg.notifyOnCritical !== false) {
        const webhookResults = await broadcastCritical(adminCfg, items.slice(0, 5));
        results.slack = webhookResults.slack;
        results.teams = webhookResults.teams;
      }

      return ok(results);
    }

    return err(404, `Unknown path: ${apiPath}`);
  } catch (e) {
    console.error('[api] Error:', e);
    return err(500, e?.message || String(e));
  }
};
