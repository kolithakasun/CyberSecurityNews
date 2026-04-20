/**
 * Dev: `/api/*` → Vite proxy → local Fastify.
 * Prod (Netlify): set `VITE_API_ROOT` to your deployed API origin (HTTPS), e.g.
 * `https://cybersecurity-news-api.onrender.com` — requests go to `/news`, `/sources`, etc.
 */

function joinUrl(path, queryString = '') {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return `/api${p}${queryString}`;
  }
  const root = import.meta.env.VITE_API_ROOT?.replace(/\/$/, '');
  if (!root) {
    throw new Error(
      'Missing VITE_API_ROOT. In Netlify: Site configuration → Environment variables → add VITE_API_ROOT pointing to your Node API (see README), then trigger a new deploy.',
    );
  }
  return `${root}${p}${queryString}`;
}

export function isApiConfigured() {
  if (import.meta.env.DEV) return true;
  return Boolean(import.meta.env.VITE_API_ROOT?.trim());
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
