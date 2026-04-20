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

### Client (optional)

| Name | Description |
| --- | --- |
| `VITE_PROXY_API` | Override API target for the Vite dev proxy | `http://localhost:3001` |

## Production build

```bash
npm run install:all
npm run build --prefix client
```

Serve the static `client/dist` with any CDN or static host, and place the API behind the same origin or configure CORS `CLIENT_ORIGIN` to your UI origin. Point the UI at the API by:

- configuring a reverse proxy so `/api` forwards to the Node service, **or**
- rebuilding the client with a small change to `client/src/api.js` to use an absolute API base URL.

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
