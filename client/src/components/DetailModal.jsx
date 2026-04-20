import { useEffect } from 'react';
import { NewsCard } from './NewsCard.jsx';
import { SeverityBadge } from './SeverityBadge.jsx';
import { cveNvdUrl } from '../utils/cves.js';

function Backdrop({ onClick }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      onClick={onClick}
      aria-hidden
    />
  );
}

export function DetailModal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 bottom-0 top-12 z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl md:inset-x-auto md:left-1/2 md:w-full md:-translate-x-1/2"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink"
          >
            Close ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

export function CriticalDetailModal({ items, onClose }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();

  const todayItems = items
    .filter((i) => i.category === 'critical' && i.published_date && i.published_date >= iso)
    .sort((a, b) => Date.parse(b.published_date) - Date.parse(a.published_date));

  return (
    <DetailModal title={`Critical threats today (${todayItems.length})`} onClose={onClose}>
      {!todayItems.length ? (
        <p className="text-sm text-ink-muted">No critical items dated today yet.</p>
      ) : (
        <div className="space-y-3">
          {todayItems.map((item) => (
            <NewsCard
              key={item.link || item.title}
              item={item}
              bookmarked={false}
              onToggleBookmark={() => {}}
              dense
            />
          ))}
        </div>
      )}
    </DetailModal>
  );
}

export function CveDetailModal({ items, onClose }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();

  const cveMap = new Map();
  for (const item of items) {
    if (!item.published_date || item.published_date < iso) continue;
    for (const cve of item.cves || []) {
      if (!cveMap.has(cve)) cveMap.set(cve, []);
      cveMap.get(cve).push(item);
    }
  }
  const entries = [...cveMap.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <DetailModal title={`New CVE mentions today (${cveMap.size})`} onClose={onClose}>
      {!entries.length ? (
        <p className="text-sm text-ink-muted">No CVE-tagged items dated today.</p>
      ) : (
        <div className="space-y-4">
          {entries.map(([cve, cveItems]) => (
            <div key={cve} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-3">
                <a
                  href={cveNvdUrl(cve)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-sky-300 hover:underline"
                >
                  {cve}
                </a>
                <span className="text-xs text-ink-muted">{cveItems.length} article{cveItems.length > 1 ? 's' : ''}</span>
              </div>
              <ul className="space-y-2">
                {cveItems.map((item) => (
                  <li key={item.link || item.title} className="flex items-start gap-2">
                    <SeverityBadge category={item.category} />
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink hover:text-sky-200"
                    >
                      {item.title}
                      <span className="ml-2 text-xs text-ink-muted">— {item.source}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </DetailModal>
  );
}

export function SourceDetailModal({ source, items, onClose }) {
  const sourceItems = items
    .filter((i) => {
      const hay = `${i.source} ${(i.merged_sources || []).join(' ')}`.toLowerCase();
      return hay.includes(source.toLowerCase());
    })
    .sort((a, b) => {
      const catOrder = { critical: 4, high: 3, medium: 2, informational: 1 };
      const co = (catOrder[b.category] || 0) - (catOrder[a.category] || 0);
      if (co !== 0) return co;
      return Date.parse(b.published_date || 0) - Date.parse(a.published_date || 0);
    });

  return (
    <DetailModal title={`${source} — ${sourceItems.length} items`} onClose={onClose}>
      {!sourceItems.length ? (
        <p className="text-sm text-ink-muted">No items found for this source.</p>
      ) : (
        <div className="space-y-3">
          {sourceItems.map((item) => (
            <NewsCard
              key={item.link || item.title}
              item={item}
              bookmarked={false}
              onToggleBookmark={() => {}}
              dense
            />
          ))}
        </div>
      )}
    </DetailModal>
  );
}
