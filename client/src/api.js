/**
 * Dev: `/api/*` → Vite proxy → local Fastify.
 * Prod on Netlify: `/api/*` → redirect → `netlify/functions/api.mjs` (same site).
 * Optional override: set `VITE_API_ROOT` to an external HTTPS API origin (no trailing slash).
 */

function joinUrl(path, queryString = '') {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return `/api${p}${queryString}`;
  }
  const external = import.meta.env.VITE_API_ROOT?.replace(/\/$/, '');
  if (external) {
    return `${external}${p}${queryString}`;
  }
  return `/api${p}${queryString}`;
}

export function isApiConfigured() {
  return true;
}

async function parseJson(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchNews(query = {}) {
  const res = await fetch(joinUrl('/news', buildQuery(query)));
  return parseJson(res);
}

export async function fetchCritical(query = {}) {
  const res = await fetch(joinUrl('/critical', buildQuery(query)));
  return parseJson(res);
}

export async function postRefresh() {
  const res = await fetch(joinUrl('/refresh', ''), { method: 'POST' });
  return parseJson(res);
}

export async function fetchSources() {
  const res = await fetch(joinUrl('/sources', ''));
  return parseJson(res);
}
