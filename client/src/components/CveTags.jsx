import { cveNvdUrl } from '../utils/cves.js';

export function CveTags({ cves }) {
  if (!cves?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {cves.map((cve) => (
        <a
          key={cve}
          href={cveNvdUrl(cve)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-accent ring-1 ring-white/10 transition hover:bg-white/10"
        >
          {cve}
        </a>
      ))}
    </div>
  );
}
