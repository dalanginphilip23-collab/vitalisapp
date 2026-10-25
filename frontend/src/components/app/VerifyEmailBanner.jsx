import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { apiPost } from '../../lib/apiClient.js';

// Soft verification (Option A) — no hard email wall, just this slim reminder
// while the account is unverified. Dismiss lives for the browser session;
// "Resend" re-throttles client-side and relies on the backend limiter too.
const DISMISS_KEY = 'vitalis:emailverify:dismissed';
const RESEND_COOLDOWN = 60;

function isDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

const VerifyEmailBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(isDismissed);
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(0);
  const [note, setNote] = useState(null); // 'sent' | 'error'

  // 60s resend cooldown ticker — only while visible.
  useEffect(() => {
    if (cool <= 0) return undefined;
    const t = setInterval(() => setCool((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cool]);

  if (!(user?.email) || user?.isVerified === true || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  };

  const resend = async () => {
    if (busy || cool > 0) return;
    setBusy(true);
    setNote(null);
    try {
      await apiPost('/api/auth/send-verification', { email: user.email }, { skipAuthRedirect: true });
      setNote('sent');
      setCool(RESEND_COOLDOWN);
    } catch {
      setNote('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-6 py-2.5
                 border-b border-[var(--warning-border,var(--border-light))] bg-[var(--warning-bg,rgba(245,197,24,0.08))]">
      <span className="material-symbols-outlined text-[18px] text-[var(--warning,var(--accent))]" aria-hidden="true">
        mark_email_unread
      </span>
      <p className="text-[12px] font-semibold text-[var(--text-primary)]">
        Confirm your email to keep account recovery working.
      </p>
      <p className="text-[12px] text-[var(--text-muted)] break-all">Sent to <span className="font-bold">{user.email}</span></p>

      <button
        type="button"
        onClick={resend}
        disabled={busy || cool > 0}
        className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent)] hover:text-[var(--accent-dark)]
                   disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer p-0">
        {busy ? 'Sending…' : cool > 0 ? `Resend in ${cool}s` : 'Resend email'}
      </button>

      {note === 'sent' && <span className="text-[11px] font-semibold text-[var(--success,var(--accent))]">Link sent — check your inbox.</span>}
      {note === 'error' && <span className="text-[11px] font-semibold text-[var(--error)]">Couldn't send. Try again in a minute.</span>}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss verify email reminder"
        className="ml-auto material-symbols-outlined text-[18px] text-[var(--text-muted)] hover:text-[var(--text-primary)]
                   transition-colors bg-transparent border-none cursor-pointer p-1">
        close
      </button>
    </div>
  );
};

export default VerifyEmailBanner;
