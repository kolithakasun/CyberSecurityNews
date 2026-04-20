import { useCallback, useEffect, useState } from 'react';

const DEFAULT_PREFS = {
  alertEmail: '',
  criticalAlerts: true,
  dailyDigest: true,
};

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full border transition ${
            checked
              ? 'border-sky-500 bg-sky-500'
              : 'border-white/20 bg-white/10'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          <div
            className={`mt-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
      <div>
        <div className={`text-sm font-medium ${checked ? 'text-ink' : 'text-ink-muted'}`}>{label}</div>
        {description && <div className="mt-0.5 text-xs text-ink-muted">{description}</div>}
      </div>
    </label>
  );
}

export function EmailPrefsPanel({ user, authHeaders }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'saved' | 'error'
  const [loadError, setLoadError] = useState(null);

  // Pre-fill email from Identity
  useEffect(() => {
    if (user?.email) {
      setPrefs((p) => ({ ...p, alertEmail: p.alertEmail || user.email }));
    }
  }, [user?.email]);

  // Fetch saved prefs
  useEffect(() => {
    if (!user) return;
    fetch('/api/prefs', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => {
        setPrefs((p) => ({ ...DEFAULT_PREFS, alertEmail: user.email, ...data }));
      })
      .catch((e) => setLoadError(String(e)));
  }, [user, authHeaders]);

  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('saved');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus('error:' + e.message);
    } finally {
      setSaving(false);
    }
  }, [prefs, authHeaders]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="text-lg">✉️</span>
          <span>Sign in to configure email notifications.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
      <h2 className="text-sm font-semibold text-ink">Email notifications</h2>
      {loadError && (
        <p className="mt-2 text-xs text-amber-300">Could not load saved prefs: {loadError}</p>
      )}

      <div className="mt-4 space-y-4">
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">
            Notification email
          </span>
          <input
            type="email"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink outline-none focus:border-sky-500/50"
            placeholder="you@example.com"
            value={prefs.alertEmail}
            onChange={(e) => setPrefs((p) => ({ ...p, alertEmail: e.target.value }))}
          />
        </label>

        <div className="space-y-3 border-t border-white/5 pt-3">
          <Toggle
            label="Critical threat alerts"
            description="Instant email when new critical-severity items appear."
            checked={prefs.criticalAlerts}
            onChange={(v) => setPrefs((p) => ({ ...p, criticalAlerts: v }))}
          />
          <Toggle
            label="Daily digest"
            description="Morning summary every day at 08:00 UTC."
            checked={prefs.dailyDigest}
            onChange={(v) => setPrefs((p) => ({ ...p, dailyDigest: v }))}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !prefs.alertEmail}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
          {status === 'saved' && (
            <span className="text-xs text-emerald-300">✓ Saved</span>
          )}
          {status?.startsWith('error:') && (
            <span className="text-xs text-rose-300">{status.slice(6)}</span>
          )}
        </div>

        <p className="text-[11px] text-ink-muted">
          Powered by Resend. Requires <span className="font-mono">RESEND_API_KEY</span> in Netlify environment variables.
        </p>
      </div>
    </div>
  );
}
