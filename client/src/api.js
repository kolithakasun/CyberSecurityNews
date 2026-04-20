const base = '/api';

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
  const res = await fetch(`${base}/news${buildQuery(query)}`);
  return parseJson(res);
}

export async function fetchCritical(query = {}) {
  const res = await fetch(`${base}/critical${buildQuery(query)}`);
  return parseJson(res);
}

export async function postRefresh() {
  const res = await fetch(`${base}/refresh`, { method: 'POST' });
  return parseJson(res);
}

export async function fetchSources() {
  const res = await fetch(`${base}/sources`);
  return parseJson(res);
}
