import { CveTags } from './CveTags.jsx';
import { SeverityBadge } from './SeverityBadge.jsx';

function formatDate(iso) {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function NewsCard({ item, bookmarked, onToggleBookmark, dense }) {
  const merged = item.merged_sources?.length > 1;
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => item.link && window.open(item.link, '_blank', 'noopener')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.link && window.open(item.link, '_blank', 'noopener');
        }
      }}
      className={`group cursor-pointer rounded-xl border border-white/5 bg-surface-muted/60 p-4 shadow-card ring-1 ring-white/5 transition hover:border-sky-500/30 hover:bg-surface-muted ${
        dense ? 'p-3' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge category={item.category} score={item.severity_score} />
            {merged ? (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-white/10">
                Merged: {item.merged_sources.length} sources
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold leading-snug text-ink group-hover:text-sky-200">{item.title}</h3>
          <p className="line-clamp-2 text-sm text-ink-muted">{item.summary || 'No summary available.'}</p>
          <CveTags cves={item.cves} />
          {item.tags?.filter((t) => !String(t).startsWith('CVE-')).length ? (
            <div className="flex flex-wrap gap-1">
              {item.tags
                .filter((t) => !String(t).startsWith('CVE-'))
                .slice(0, 8)
                .map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-white/10"
                  >
                    {t}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 text-right text-xs text-ink-muted">
          <div className="font-medium text-ink">{item.source}</div>
          <div>{formatDate(item.published_date)}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(item);
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-ink-muted transition hover:border-amber-400/40 hover:text-amber-200"
          >
            {bookmarked ? '★ Saved' : '☆ Save'}
          </button>
        </div>
      </div>
    </article>
  );
}
