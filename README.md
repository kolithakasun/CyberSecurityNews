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
| **`VITE_API_ROOT`** | **Required for static production builds (e.g. Netlify).** Full HTTPS origin of the Node API, no trailing slash (e.g. `https://cybersecurity-news-api.onrender.com`). Vite inlines this at build time — change it in the host UI and **redeploy** the frontend. | _empty in dev_ |

## Deploying on Netlify + API on Render

Netlify only serves the **static** Vite build from `client/dist`. It does **not** run the Fastify RSS worker, so the browser must call a **separate** HTTPS API.

1. **Deploy the API** (example: [Render](https://render.com) using `render.yaml` in this repo, or any Node host). Ensure the service runs `npm start` in `server/` and is reachable over **HTTPS**.
2. In the API host, set **`CLIENT_ORIGIN`** to your Netlify site URL (e.g. `https://verdant-crostata-8d52cf.netlify.app`) so CORS allows the browser.
3. In **Netlify** → Site configuration → **Environment variables**, add:
   - **`VITE_API_ROOT`** = your API origin, e.g. `https://your-service.onrender.com` (no `/api` suffix; the client calls `/news`, `/sources`, etc. on that host).
4. **Redeploy** the Netlify site so the new variable is baked into the bundle.

This repo includes **`netlify.toml`** with the correct `build` command and `publish = "client/dist"`, plus an SPA fallback so client-side routing keeps working.

## Production build

```bash
npm run install:all
npm run build --prefix client
```

Serve the static `client/dist` with any CDN or static host. Point the UI at the API by setting **`VITE_API_ROOT`** at build time (see table above), and configure the API **`CLIENT_ORIGIN`** for CORS. Alternatively, put a reverse proxy in front so the UI and API share one origin.

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
  aggregator.js    # fetch, dedupe, merge, stats, cache wiring
  normalizer.js    # RSS → unified item, CVE/vendor tags, similarity merge
  classifier.js    # severity + category inference
  cache.js         # disk JSON cache
  config.js        # feeds + keyword dictionaries
client/src/
  App.jsx          # dashboard shell
  components/      # cards, filters, widgets
  hooks/           # data + localStorage helpers
  utils/           # CVE helpers, export, Slack helper
```

## License

Use and modify freely for internal security operations and learning.
