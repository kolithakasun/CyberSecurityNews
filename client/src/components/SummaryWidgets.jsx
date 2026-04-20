import { useState } from 'react';
import {
  CriticalDetailModal,
  CveDetailModal,
  SourceDetailModal,
} from './DetailModal.jsx';

function WidgetButton({ children, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl p-5 text-left ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${className}`}
    >
      {children}
    </button>
  );
}

export function SummaryWidgets({ stats, items = [] }) {
  const [modal, setModal] = useState(null); // 'critical' | 'cves' | source-name

  if (!stats) return null;
  const top = stats.top_sources?.slice(0, 6) || [];
  const maxCount = top[0]?.count || 1;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {/* Critical threats today */}
        <WidgetButton
          onClick={() => setModal('critical')}
          className="border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent ring-rose-500/20 hover:border-rose-400/40 hover:from-rose-500/15"
        >
          <div className="text-sm text-rose-100/80">Critical threats today</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-4xl font-semibold tracking-tight text-rose-50">
              {stats.critical_threats_today ?? 0}
            </span>
            <span className="mb-1 text-xs text-rose-300/60 opacity-0 transition group-hover:opacity-100">
              View details →
            </span>
          </div>
          <p className="mt-2 text-xs text-rose-100/60">
            Items classified critical with today&apos;s publish date.
          </p>
        </WidgetButton>

        {/* CVE mentions today */}
        <WidgetButton
          onClick={() => setModal('cves')}
          className="border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent ring-sky-500/20 hover:border-sky-400/40 hover:from-sky-500/15"
        >
          <div className="text-sm text-sky-100/80">New CVE mentions today</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-4xl font-semibold tracking-tight text-sky-50">
              {stats.new_cves_today ?? 0}
            </span>
            <span className="mb-1 text-xs text-sky-300/60 opacity-0 transition group-hover:opacity-100">
              View details →
            </span>
          </div>
          <p className="mt-2 text-xs text-sky-100/60">
            Distinct CVE IDs appearing in items dated today.
          </p>
        </WidgetButton>

        {/* Top contributing sources */}
        <div className="rounded-2xl border border-white/10 bg-surface-muted/50 p-5 ring-1 ring-white/10">
          <div className="mb-3 text-sm text-ink-muted">Top contributing sources</div>
          {!top.length ? (
            <p className="text-sm text-ink-muted">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {top.map((s) => (
                <li key={s.source}>
                  <button
                    type="button"
                    onClick={() => setModal(s.source)}
                    className="group w-full space-y-1 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink group-hover:text-sky-200">{s.source}</span>
                      <span className="font-mono text-xs text-ink-muted">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500/70 to-indigo-400/70 transition-all group-hover:from-sky-400 group-hover:to-indigo-300"
                        style={{ width: `${Math.max(8, (s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'critical' && (
        <CriticalDetailModal items={items} onClose={() => setModal(null)} />
      )}
      {modal === 'cves' && (
        <CveDetailModal items={items} onClose={() => setModal(null)} />
      )}
      {modal && modal !== 'critical' && modal !== 'cves' && (
        <SourceDetailModal
          source={modal}
          items={items}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
