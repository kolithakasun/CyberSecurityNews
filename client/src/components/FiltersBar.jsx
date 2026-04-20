import { MultiSourceSelect } from './MultiSourceSelect.jsx';

const severities = [
  { id: 'all', label: 'All severities' },
  { id: 'critical', label: '🔴 Critical' },
  { id: 'high', label: '🟠 High' },
  { id: 'medium', label: '🟡 Medium' },
  { id: 'informational', label: '🔵 Informational' },
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
        {/* Keyword search — 2 cols */}
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Search</span>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none transition focus:border-sky-500/50"
            placeholder="Keyword in title, summary, tags…"
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </label>

        {/* Multi-source picker — 2 cols */}
        <div className="lg:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Sources</span>
          <MultiSourceSelect
            options={sourceOptions}
            selected={filters.sources || []}
            onChange={(next) => onChange({ ...filters, sources: next })}
          />
        </div>

        {/* Severity */}
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

        {/* Date from */}
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">From</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
          />
        </label>
      </div>

      {/* Date to + active-filter chips row */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-48">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">To</span>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
          />
        </label>

        {/* Active filter chips */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {(filters.sources || []).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-200 ring-1 ring-sky-500/25"
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, sources: (filters.sources || []).filter((x) => x !== s) })
                }
                className="text-sky-300/70 hover:text-sky-100"
              >
                ✕
              </button>
            </span>
          ))}
          {filters.severity && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-white/10">
              {severities.find((sv) => sv.id === filters.severity)?.label || filters.severity}
              <button
                type="button"
                onClick={() => onChange({ ...filters, severity: '' })}
                className="text-ink-muted hover:text-rose-300"
              >
                ✕
              </button>
            </span>
          )}
          {filters.keyword && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-white/10">
              "{filters.keyword}"
              <button
                type="button"
                onClick={() => onChange({ ...filters, keyword: '' })}
                className="text-ink-muted hover:text-rose-300"
              >
                ✕
              </button>
            </span>
          )}
          {((filters.sources || []).length > 0 || filters.severity || filters.keyword || filters.from || filters.to) && (
            <button
              type="button"
              onClick={() => onChange({ keyword: '', sources: [], severity: '', from: '', to: '' })}
              className="text-xs text-rose-300/70 hover:text-rose-200"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
