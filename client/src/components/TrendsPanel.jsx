import { cveNvdUrl } from '../utils/cves.js';

export function TrendsPanel({ trends }) {
  if (!trends?.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 text-sm text-ink-muted ring-1 ring-white/5">
        No CVE recurrence data yet.
      </div>
    );
  }
  const max = trends[0]?.count || 1;
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-5 ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Trend analysis</h2>
        <span className="text-xs text-ink-muted">Top recurring CVE mentions</span>
      </div>
      <ul className="mt-4 space-y-3">
        {trends.map((row) => (
          <li key={row.cve} className="flex items-center gap-3">
            <a
              href={cveNvdUrl(row.cve)}
              target="_blank"
              rel="noreferrer"
              className="w-36 shrink-0 font-mono text-xs text-accent hover:underline"
            >
              {row.cve}
            </a>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400"
                style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-xs text-ink-muted">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
