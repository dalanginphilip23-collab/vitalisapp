import { Link } from 'react-router-dom';

// pages/NotFound — real 404 so broken links don't silently mask as home
export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center bg-[var(--bg-primary)]">
      <span className="material-symbols-outlined text-[length:var(--fs-48)] text-[var(--text-muted)]">search_off</span>
      <h1 className="text-2xl font-black text-[var(--text-primary)]">Page not found</h1>
      <p className="text-sm text-[var(--text-muted)] max-w-[40ch]">
        The link you followed doesn&apos;t exist. Check the URL or head back to your dashboard.
      </p>
      <div className="flex gap-2">
        <Link
          to="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-xs font-black uppercase tracking-widest"
        >
          Dashboard
        </Link>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl border border-[var(--border-light)] text-xs font-bold text-[var(--text-secondary)]"
        >
          Landing
        </Link>
      </div>
    </div>
  );
}
