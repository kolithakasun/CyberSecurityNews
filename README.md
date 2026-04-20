# CyberSecurity News Dashboard

Production-oriented threat intelligence dashboard that aggregates major cybersecurity RSS feeds, normalizes items, deduplicates and merges cross-source duplicates, classifies severity, extracts CVE identifiers, and exposes a REST API to a React dashboard.

## Features

- **Aggregation**: 15 curated RSS sources (news, advisories, KEV, NVD, research blogs).
- **Normalization**: title, source, published date, summary, link, tags (CVEs, vendors, attack types).
- **Deduplication**: by link or normalized title, plus similarity merge across sources.
- **Classification**: critical / high / medium / informational using keyword and CVSS heuristics.
- **API**: `GET /news`, `GET /critical`, `GET /sources`, `POST /refresh` (Fastify).
- **Caching**: in-memory + JSON disk cache under `server/data/` (TTL configurable).
- **Dashboard**: dark-first UI, critical panel, chronological feed, filters, auto-refresh, bookmarks, exports (JSON/CSV), CVE trend widget, optional browser notifications and Slack incoming webhook (stored locally in the browser).

## Prerequisites

- Node.js 18+ (uses global `fetch` on the server).

## Quick start

```bash
cd /path/to/CyberSecurityNews
npm install
npm run install:all
```

Terminal 1 – API (defaults to port `3001`):

```bash
cd server
cp .env.example .env   # optional: tune PORT, CLIENT_ORIGIN, CACHE_TTL_MS
npm run dev
```

Terminal 2 – UI (Vite dev server, proxies `/api` → API):

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

Or run both from the repo root:

```bash
npm install
npm run install:all
npm run dev
```

## Environment variables

### Server (`server/.env`)

| Name | Description | Default |
| --- | --- | --- |
| `PORT` | API port | `3001` |
| `CLIENT_ORIGIN` | CORS origin(s), comma-separated | `http://localhost:5173` |
| `CACHE_TTL_MS` | Cache lifetime for aggregated feeds | `120000` |
| `FETCH_CONCURRENCY` | Parallel RSS fetches | `5` |
| `CACHE_DIR` | Directory for `feed-cache.json` | `server/data` |

### Client

| Name | Description |
| --- | --- |
| `VITE_PROXY_API` | Override API target for the Vite dev proxy (local only) | `http://localhost:3001` |
| `VITE_API_ROOT` | Optional. If set in production, the UI calls this HTTPS API origin instead of same-site `/api` (no trailing slash). | _empty_ |

## Deploying on Netlify (UI + API in the same site)

The static app and the RSS API both deploy on Netlify:

- **UI**: built from `client/dist` (see `netlify.toml`).
- **API**: `netlify/functions/api.mjs` — same aggregation logic as the Fastify server, with cache under `/tmp` on the function instance.

Netlify redirects **`/api/*`** → **`/.netlify/functions/api?apiPath=:splat`**, so the browser keeps using `/api/news`, `/api/sources`, etc. (same origin; no CORS setup needed).

**Optional environment variables** (Netlify → Site configuration → Environment variables):

| Name | Purpose |
| --- | --- |
| `CACHE_TTL_MS` | Cache lifetime for aggregated feeds (default `120000`). |
| `FETCH_CONCURRENCY` | Parallel RSS fetches (default `4` on functions). |

**Timeouts:** On the Netlify **Starter** plan, synchronous functions default to **10s**. The first cold fetch of many feeds can exceed that. After a successful run, cached responses are fast. If you hit timeouts, raise the function limit on a paid plan, lower `FETCH_CONCURRENCY`, or use an external long-running API via `VITE_API_ROOT` and `render.yaml` instead.

**External API instead:** Set `VITE_API_ROOT` to another host and redeploy the client; requests go to that origin’s `/news`, `/sources`, etc. (configure CORS there with `CLIENT_ORIGIN`).

## Production build

```bash
npm run install:all
npm run build --prefix client
```

Serve the static `client/dist` with any CDN or static host. On Netlify, the bundled function serves `/api/*` automatically. For other hosts, use a reverse proxy to forward `/api` to a Node process, or set **`VITE_API_ROOT`** to an external API.

## REST API

- `GET /health` – liveness.
- `GET /sources` – configured feed URLs and hostnames.
- `GET /news` – aggregated items with stats. Query params: `keyword`, `source`, `severity` (`critical` \| `high` \| `medium` \| `informational`), `from`, `to` (ISO dates), `refresh=true` to bypass cache read (still writes new cache after fetch).
- `GET /critical` – subset where `category === "critical"` (same query params).
- `POST /refresh` – clears disk cache and refetches all feeds.

## Security notes

- RSS fetching is **server-side**; the browser never calls third-party RSS URLs directly.
- Optional Slack webhooks configured in the UI are stored in **localStorage** only; for production, prefer a server-side relay so secrets are not exposed to browsers.
- Treat outputs as **situational awareness**, not as a replacement for vendor advisories or vuln intelligence platforms.

## Project layout

```
server/src/
  server.js        # Fastify app + routes
  httpApi.js       # Shared route handlers (Fastify + Netlify)
  aggregator.js    # fetch, dedupe, merge, stats, cache wiring
  normalizer.js    # RSS → unified item, CVE/vendor tags, similarity merge
  classifier.js    # severity + category inference
  cache.js         # disk JSON cache
  config.js        # feeds + keyword dictionaries
netlify/functions/
  api.mjs          # Netlify serverless entry (same handlers as Fastify)
client/src/
  App.jsx          # dashboard shell
  components/      # cards, filters, widgets
  hooks/           # data + localStorage helpers
  utils/           # CVE helpers, export, Slack helper
```

## License

Use and modify freely for internal security operations and learning.
