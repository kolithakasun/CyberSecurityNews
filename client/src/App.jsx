import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSources } from './api.js';
import { FiltersBar } from './components/FiltersBar.jsx';
import { NewsCard } from './components/NewsCard.jsx';
import { SummaryWidgets } from './components/SummaryWidgets.jsx';
import { TrendsPanel } from './components/TrendsPanel.jsx';
import { useDashboardData } from './hooks/useDashboardData.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { computeCveTrends, exportCsv, exportJson } from './utils/cves.js';
import { postSlackMessage } from './utils/slack.js';

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 300_000 },
  { label: '15 min', value: 900_000 },
  { label: '1 hour', value: 3_600_000 },
];

function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = a.published_date ? Date.parse(a.published_date) : 0;
    const db = b.published_date ? Date.parse(b.published_date) : 0;
    return db - da;
  });
}

function bookmarkKey(item) {
  return item.link || `${item.source}::${item.title}`;
}

export default function App() {
  const [theme, setTheme] = useLocalStorage('csnews_theme', 'dark');
  const [autoRefreshMs, setAutoRefreshMs] = useLocalStorage('csnews_auto_refresh_ms', 0);
  const [notifyEnabled, setNotifyEnabled] = useLocalStorage('csnews_notify', true);
  const [slackWebhook, setSlackWebhook] = useLocalStorage('csnews_slack_webhook', '');
  const [bookmarks, setBookmarks] = useLocalStorage('csnews_bookmarks', []);
  const [filters, setFilters] = useState({
    keyword: '',
    source: '',
    severity: '',
    from: '',
    to: '',
  });
  const [view, setView] = useState('dashboard');
  const [sourceOptions, setSourceOptions] = useState([]);
  const seenCriticalLinks = useRef(new Set());
  const firstFetchDone = useRef(false);

  const { data, loading, error, hardRefresh } = useDashboardData({
    filters,
    refreshIntervalMs: autoRefreshMs,
  });

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    fetchSources()
      .then((res) => {
        const labels = (res.sources || []).map((s) => s.hostname).filter(Boolean);
        setSourceOptions([...new Set(labels)].sort());
      })
      .catch(() => {});
  }, []);

  const items = data?.items || [];
  const stats = data?.stats;

  const criticalItems = useMemo(
    () => items.filter((i) => i.category === 'critical').slice(0, 14),
    [items],
  );
  const latestItems = useMemo(() => sortByDateDesc(items).slice(0, 60), [items]);
  const trends = useMemo(() => computeCveTrends(items, 10), [items]);

  const bookmarkSet = useMemo(() => new Set(bookmarks.map((b) => b.key)), [bookmarks]);

  const toggleBookmark = useCallback(
    (item) => {
      const key = bookmarkKey(item);
      setBookmarks((prev) => {
        const exists = prev.some((b) => b.key === key);
        if (exists) return prev.filter((b) => b.key !== key);
        return [
          {
            key,
            title: item.title,
            link: item.link,
            source: item.source,
            category: item.category,
            savedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
    },
    [setBookmarks],
  );

  useEffect(() => {
    if (!data?.items) return;

    const critical = data.items.filter((i) => i.category === 'critical');
    const fresh = critical.filter((i) => i.link && !seenCriticalLinks.current.has(i.link));

    if (!firstFetchDone.current) {
      firstFetchDone.current = true;
      for (const i of critical) {
        if (i.link) seenCriticalLinks.current.add(i.link);
      }
      return;
    }

    for (const i of critical) {
      if (i.link) seenCriticalLinks.current.add(i.link);
    }

    if (!fresh.length) return;

    (async () => {
      if (notifyEnabled && 'Notification' in window) {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') {
          for (const item of fresh.slice(0, 3)) {
            // eslint-disable-next-line no-new
            new Notification('Critical threat detected', { body: item.title });
          }
        }
      }
      if (slackWebhook) {
        const lines = fresh
          .slice(0, 5)
          .map((i) => `• ${i.title} — ${i.link}`)
          .join('\n');
        try {
          await postSlackMessage(
            slackWebhook,
            `*CyberSecurity News*: new critical items\n${lines}`,
          );
        } catch {
          /* ignore */
        }
      }
    })();
  }, [data?.fetchedAt, data?.items, notifyEnabled, slackWebhook]);

  const handleExportJson = () => exportJson(items, stats);
  const handleExportCsv = () => exportCsv(items);

  const bookmarkCards = useMemo(() => {
    return bookmarks.map((b) => ({
      title: b.title,
      link: b.link,
      source: b.source,
      summary: 'Saved threat — open for details.',
      category: b.category || 'informational',
      severity_score: 0,
      cves: [],
      tags: [],
      merged_sources: [b.source],
    }));
  }, [bookmarks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 pb-16 text-ink">
      <header className="border-b border-white/5 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Threat intelligence</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">CyberSecurity News Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Aggregated RSS from leading vendors and researchers, normalized for SOC and DevSecOps monitoring with
              severity estimation, CVE extraction, and deduplicated coverage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => hardRefresh()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh feeds'}
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink-muted transition hover:border-emerald-400/40 hover:text-emerald-100"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink-muted transition hover:border-emerald-400/40 hover:text-emerald-100"
            >
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <FiltersBar
              filters={filters}
              onChange={setFilters}
              sourceOptions={sourceOptions}
              view={view}
              onViewChange={setView}
            />
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                {error}
              </div>
            ) : null}
            {data?.errors?.length ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-50">
                <span className="font-semibold">Partial feed errors ({data.errors.length}):</span>{' '}
                {data.errors.map((e) => e.feed?.replace(/^https?:\/\/(www\.)?/, '')).join(', ')}
              </div>
            ) : null}
            <SummaryWidgets stats={stats} />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
              <h2 className="text-sm font-semibold text-ink">Auto refresh</h2>
              <p className="mt-1 text-xs text-ink-muted">Polls the API and uses server-side cache TTL.</p>
              <select
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={autoRefreshMs}
                onChange={(e) => setAutoRefreshMs(Number(e.target.value))}
              >
                {REFRESH_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/40"
                />
                Browser alerts for new critical threats
              </label>
              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Slack incoming webhook (optional)
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-ink outline-none focus:border-sky-500/50"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                />
                <p className="text-[11px] text-ink-muted">
                  Stored locally in your browser. Prefer a server relay for production secrets.
                </p>
              </div>
            </div>
            <TrendsPanel trends={trends} />
          </div>
        </section>

        {view === 'bookmarks' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Saved threats</h2>
              {bookmarks.length ? (
                <button
                  type="button"
                  onClick={() => setBookmarks([])}
                  className="text-xs text-rose-300 hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {!bookmarkCards.length ? (
              <p className="text-sm text-ink-muted">No saved items yet. Use “Save” on any card.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {bookmarkCards.map((item) => (
                  <NewsCard
                    key={bookmarkKey(item)}
                    item={item}
                    bookmarked
                    onToggleBookmark={() =>
                      toggleBookmark({ link: item.link, title: item.title, source: item.source })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Critical threats</h2>
                <span className="text-xs text-ink-muted">Zero-days, active exploitation, CVSS 9+</span>
              </div>
              {!criticalItems.length ? (
                <p className="text-sm text-ink-muted">No critical items match the current filters.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {criticalItems.map((item) => (
                    <NewsCard
                      key={bookmarkKey(item)}
                      item={item}
                      dense
                      bookmarked={bookmarkSet.has(bookmarkKey(item))}
                      onToggleBookmark={toggleBookmark}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Latest security news</h2>
                <span className="text-xs text-ink-muted">
                  {loading ? 'Updating…' : `${items.length} items (deduped)`}
                </span>
              </div>
              <div className="grid gap-4">
                {latestItems.map((item) => (
                  <NewsCard
                    key={bookmarkKey(item)}
                    item={item}
                    bookmarked={bookmarkSet.has(bookmarkKey(item))}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-xs text-ink-muted">
        Data is aggregated from public RSS feeds for situational awareness — always verify with primary sources.
      </footer>
    </div>
  );
}
