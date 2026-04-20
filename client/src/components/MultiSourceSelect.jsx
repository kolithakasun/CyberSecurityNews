import { useEffect, useRef, useState } from 'react';

export function MultiSourceSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(source) {
    if (selected.includes(source)) {
      onChange(selected.filter((s) => s !== source));
    } else {
      onChange([...selected, source]);
    }
  }

  function toggleAll() {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  }

  const label =
    selected.length === 0
      ? 'All sources'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} sources selected`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition ${
          open
            ? 'border-sky-500/50 bg-black/30 text-ink'
            : 'border-white/10 bg-black/20 text-ink hover:border-white/20'
        }`}
      >
        <span className={`truncate ${selected.length ? 'text-sky-200' : 'text-ink-muted'}`}>
          {label}
        </span>
        <span className="shrink-0 text-ink-muted">{open ? '▲' : '▼'}</span>
      </button>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange([]); }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-rose-300"
          title="Clear selection"
        >
          ✕
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl ring-1 ring-white/5">
          {/* Search */}
          <div className="border-b border-white/10 px-3 py-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sources…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>

          {/* Select all / clear */}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full border-b border-white/5 px-3 py-2 text-left text-xs font-medium text-ink-muted transition hover:bg-white/5 hover:text-ink"
          >
            {selected.length === options.length ? '✕ Clear all' : '✓ Select all'}
          </button>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">No matches</li>
            ) : (
              filtered.map((src) => {
                const checked = selected.includes(src);
                return (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => toggle(src)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                        checked ? 'text-sky-200' : 'text-ink'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition ${
                          checked
                            ? 'border-sky-500 bg-sky-500 text-slate-950'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="truncate">{src}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="border-t border-white/10 px-3 py-2 text-xs text-ink-muted">
              {selected.length} of {options.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
