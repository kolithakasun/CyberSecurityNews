const styles = {
  critical: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
  high: 'bg-orange-500/15 text-orange-200 ring-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-100 ring-amber-500/25',
  informational: 'bg-sky-500/15 text-sky-100 ring-sky-500/25',
};

const emoji = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  informational: '🔵',
};

export function SeverityBadge({ category, score }) {
  const cls = styles[category] || styles.informational;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      <span aria-hidden>{emoji[category] || '🔵'}</span>
      <span className="capitalize">{category}</span>
      {typeof score === 'number' ? <span className="font-mono text-[11px] opacity-80">({score})</span> : null}
    </span>
  );
}
