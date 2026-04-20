export function SummaryWidgets({ stats }) {
  if (!stats) return null;
  const top = stats.top_sources?.slice(0, 4) || [];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent p-5 ring-1 ring-rose-500/20">
        <div className="text-sm text-rose-100/80">Critical threats today</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight text-rose-50">
          {stats.critical_threats_today ?? 0}
        </div>
        <p className="mt-2 text-xs text-rose-100/60">Items classified critical with today&apos;s publish date.</p>
      </div>
      <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent p-5 ring-1 ring-sky-500/20">
        <div className="text-sm text-sky-100/80">New CVE mentions today</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight text-sky-50">{stats.new_cves_today ?? 0}</div>
        <p className="mt-2 text-xs text-sky-100/60">Distinct CVE IDs appearing in items dated today.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-surface-muted/50 p-5 ring-1 ring-white/10">
        <div className="text-sm text-ink-muted">Top contributing sources</div>
        <ul className="mt-3 space-y-2 text-sm">
          {top.map((s) => (
            <li key={s.source} className="flex items-center justify-between gap-3">
              <span className="truncate text-ink">{s.source}</span>
              <span className="font-mono text-xs text-ink-muted">{s.count}</span>
            </li>
          ))}
          {!top.length ? <li className="text-ink-muted">No data yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
