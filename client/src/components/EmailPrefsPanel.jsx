import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PREFS = { alertEmails: [], criticalAlerts: true, dailyDigest: true };
const DEFAULT_ADMIN = { slackWebhook: '', teamsWebhook: '', notifyOnCritical: true, notifyOnDigest: true };

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className={`h-5 w-9 rounded-full border transition ${checked ? 'border-sky-500 bg-sky-500' : 'border-white/20 bg-white/10'}`}>
          <div className={`mt-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <div>
        <div className={`text-sm font-medium ${checked ? 'text-ink' : 'text-ink-muted'}`}>{label}</div>
        {description && <div className="mt-0.5 text-xs text-ink-muted">{description}</div>}
      </div>
    </label>
  );
}

// ─── Multi-email tag input ────────────────────────────────────────────────────

function EmailTagInput({ emails, onChange }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  function addEmail(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    if (!emails.includes(trimmed)) onChange([...emails, trimmed]);
    setDraft('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addEmail(draft);
    }
    if (e.key === 'Backspace' && !draft && emails.length) {
      onChange(emails.slice(0, -1));
    }
  }

  function onBlur() {
    if (draft.trim()) addEmail(draft);
  }

  function onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const parts = text.split(/[\s,;]+/);
    const next = new Set(emails);
    for (const p of parts) {
      const t = p.trim().toLowerCase();
      if (t.includes('@')) next.add(t);
    }
    onChange([...next]);
    setDraft('');
  }

  return (
    <div
      className="flex min-h-[40px] w-full cursor-text flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 focus-within:border-sky-500/50"
      onClick={() => inputRef.current?.focus()}
    >
      {emails.map((email) => (
        <span key={email} className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-200 ring-1 ring-sky-500/20">
          {email}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(emails.filter((x) => x !== email)); }}
            className="ml-0.5 text-sky-300/70 hover:text-rose-300"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        placeholder={emails.length ? '' : 'Add email addresses…'}
        className="min-w-[160px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
    </div>
  );
}

// ─── Save-state helper ────────────────────────────────────────────────────────

function SaveStatus({ status }) {
  if (!status) return null;
  if (status === 'saved') return <span className="text-xs text-emerald-300">✓ Saved</span>;
  if (status === 'saving') return <span className="text-xs text-ink-muted">Saving…</span>;
  return <span className="text-xs text-rose-300">{status}</span>;
}

// ─── Admin webhook panel ──────────────────────────────────────────────────────

function AdminWebhookPanel({ authHeaders }) {
  const [cfg, setCfg] = useState(DEFAULT_ADMIN);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin-config', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => { setCfg({ ...DEFAULT_ADMIN, ...data }); setLoaded(true); })
      .catch(() => setLoaded(false));
  }, [authHeaders]);

  const save = useCallback(async () => {
    setStatus('saving');
    try {
      const res = await fetch('/api/admin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('saved');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus(e.message || 'Save failed');
    }
  }, [cfg, authHeaders]);

  if (!loaded) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-amber-500/20 pt-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-500/25">
          Admin
        </span>
        <span className="text-xs text-ink-muted">Global channel webhooks</span>
      </div>

      <label>
        <span className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
          <img src="https://cdn.simpleicons.org/slack/white" alt="" className="h-3 w-3 opacity-60" />
          Slack incoming webhook
        </span>
        <input
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-ink outline-none focus:border-sky-500/50"
          placeholder="https://hooks.slack.com/services/…"
          value={cfg.slackWebhook}
          onChange={(e) => setCfg((c) => ({ ...c, slackWebhook: e.target.value }))}
        />
      </label>

      <label>
        <span className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
          <img src="https://cdn.simpleicons.org/microsoftteams/white" alt="" className="h-3 w-3 opacity-60" />
          Microsoft Teams incoming webhook
        </span>
        <input
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-ink outline-none focus:border-sky-500/50"
          placeholder="https://outlook.office.com/webhook/…"
          value={cfg.teamsWebhook}
          onChange={(e) => setCfg((c) => ({ ...c, teamsWebhook: e.target.value }))}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Notify on critical"
          description="Send to channels on critical threats."
          checked={cfg.notifyOnCritical}
          onChange={(v) => setCfg((c) => ({ ...c, notifyOnCritical: v }))}
        />
        <Toggle
          label="Include in digest"
          description="Post daily digest to channels."
          checked={cfg.notifyOnDigest}
          onChange={(v) => setCfg((c) => ({ ...c, notifyOnDigest: v }))}
        />
      </div>

      <p className="text-[11px] text-ink-muted">
        <strong className="text-amber-200/70">Teams</strong>: In Teams, right-click a channel → Connectors → Incoming Webhook → copy URL.<br />
        <strong className="text-amber-200/70">Slack</strong>: slack.com/apps/manage → Incoming Webhooks → Add.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          Save channel config
        </button>
        <SaveStatus status={status} />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function EmailPrefsPanel({ user, authHeaders }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/prefs', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => {
        setIsAdmin(Boolean(data.isAdmin));
        // Migrate legacy single alertEmail → array
        const emails = data.alertEmails?.length
          ? data.alertEmails
          : (data.alertEmail ? [data.alertEmail] : (user.email ? [user.email] : []));
        setPrefs({ ...DEFAULT_PREFS, ...data, alertEmails: emails });
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
      setStatus(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [prefs, authHeaders]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="text-lg">✉️</span>
          <span>Sign in to configure email &amp; channel notifications.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-muted/40 p-4 ring-1 ring-white/5">
      <h2 className="text-sm font-semibold text-ink">Notifications</h2>
      {loadError && <p className="mt-2 text-xs text-amber-300">Could not load prefs: {loadError}</p>}

      <div className="mt-4 space-y-4">
        {/* Multi-email input */}
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
            Notification emails
          </span>
          <EmailTagInput
            emails={prefs.alertEmails}
            onChange={(v) => setPrefs((p) => ({ ...p, alertEmails: v }))}
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            Type an address then press <kbd className="rounded bg-white/10 px-1">Enter</kbd> or <kbd className="rounded bg-white/10 px-1">,</kbd> to add. Paste multiple addresses at once.
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-3 border-t border-white/5 pt-3">
          <Toggle
            label="Critical threat alerts"
            description="Email all addresses instantly when new critical items appear."
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

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !prefs.alertEmails.length}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
          <SaveStatus status={status} />
        </div>

        <p className="text-[11px] text-ink-muted">
          Email powered by Resend (<span className="font-mono">RESEND_API_KEY</span> env var).
        </p>

        {/* Admin: channel webhooks */}
        {isAdmin && <AdminWebhookPanel authHeaders={authHeaders} />}
      </div>
    </div>
  );
}
