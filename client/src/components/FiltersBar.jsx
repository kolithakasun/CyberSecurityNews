const severities = [
  { id: 'all', label: 'All severities' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'informational', label: 'Informational' },
];

export function FiltersBar({ filters, onChange, sourceOptions, view, onViewChange }) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-black/20 p-1 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => onViewChange('dashboard')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === 'dashboard' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onViewChange('bookmarks')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === 'bookmarks' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Saved threats
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Search</span>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none ring-0 transition focus:border-sky-500/50"
            placeholder="Keyword in title, summary, tags…"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Source</span>
          <select
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.source}
            onChange={(e) => onChange({ ...filters, source: e.target.value })}
          >
            <option value="">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Severity</span>
          <select
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.severity}
            onChange={(e) => onChange({ ...filters, severity: e.target.value })}
          >
            {severities.map((s) => (
              <option key={s.id} value={s.id === 'all' ? '' : s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">From</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">To</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
