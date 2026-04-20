export function AuthBar({ user, loading, onLogin, onLogout }) {
  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-xl bg-white/10" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-200">
            {(user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <span className="max-w-[140px] truncate text-xs text-ink-muted">{user.email}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-muted transition hover:border-rose-500/30 hover:text-rose-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogin}
      className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
    >
      Sign in
    </button>
  );
}
