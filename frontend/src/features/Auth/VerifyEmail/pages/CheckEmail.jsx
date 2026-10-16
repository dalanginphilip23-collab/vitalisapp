import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiPost, apiPatch } from '../../../../lib/apiClient.js';

// CHECK YOUR EMAIL — shown after register or when an unverified user signs in.
// Resend link, change email, back to sign in. Unverified users cannot proceed.
const CheckEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [devLink, setDevLink] = useState(location.state?.devLink || null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isProd = import.meta.env.PROD;

  const resend = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter your email address first.'); return; }
    if (!EMAIL_RE.test(trimmed)) { setError('Enter a valid email address.'); return; }
    if (trimmed !== email) setEmail(trimmed);
    setBusy(true); setError(''); setStatus('');
    try {
      const data = await apiPost('/api/auth/send-verification', { email: trimmed });
      setStatus('Verification email sent. Check your inbox.');
      if (data.devVerificationLink) setDevLink(data.devVerificationLink);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = async (e) => {
    e.preventDefault();
    if (busy) return;
    const cur = email.trim();
    const next = newEmail.trim();
    if (!EMAIL_RE.test(cur)) { setError('Current email looks invalid.'); return; }
    if (!EMAIL_RE.test(next)) { setError('Enter a valid new email address.'); return; }
    if (next.toLowerCase() === cur.toLowerCase()) { setError('New email must be different.'); return; }
    if (!password) { setError('Enter your current password.'); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      const data = await apiPatch('/api/auth/change-email', { email: cur, password, newEmail: next });
      setEmail(data.email);
      setChanging(false); setPassword(''); setNewEmail('');
      setStatus('Email updated. Check your new inbox to verify.');
      if (data.devVerificationLink) setDevLink(data.devVerificationLink);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme="dark" className="relative min-h-screen w-full bg-[#0e0e0e] font-sans text-[#e5e2e1] overflow-x-hidden overflow-y-auto flex">
      <div className="fixed inset-0 z-0 bg-[url('/auth-gym.jpg')] bg-cover bg-[center_30%] brightness-[0.28] saturate-[0.7]" />

      <div className="relative z-10 m-auto w-full max-w-[440px] p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full bg-[#121210]/65 backdrop-blur-[32px] border border-[var(--accent)]/10 rounded-[20px] p-5 sm:p-10 text-center">
          <div className="w-16 h-16 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[28px] text-[var(--accent)]">mark_email_unread</span>
          </div>
          <h1 className="font-display font-extrabold text-[28px] sm:text-[32px] tracking-wider leading-[1.1] mb-2">CHECK YOUR EMAIL</h1>
          <p className="text-xs text-[#c4c9b0]/60 mb-1">We sent a verification link to:</p>
          <p className="text-sm font-bold text-[var(--accent)] mb-6 break-all">{email || 'your inbox'}</p>

          {error && <p className="bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-semibold tracking-widest uppercase p-2.5 mb-4 break-words text-center">{error}</p>}
          {status && <p className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg text-[var(--accent)] text-[10px] font-semibold tracking-widest uppercase p-2.5 mb-4 break-words text-center">{status}</p>}

          {!isProd && devLink && (
            <a href={devLink} className="block bg-white/5 border border-dashed border-white/20 rounded-lg text-[11px] text-white/60 p-3 mb-4 break-all hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors">
              Dev mode: open verification link →
            </a>
          )}

          <button onClick={() => navigate('/login')}
            className="w-full bg-white/5 border border-white/10 rounded-xl text-[11px] font-semibold tracking-widest uppercase p-3.5 mb-3 hover:bg-white/10 transition-colors">
            Back to Sign In
          </button>

          {!changing ? (
            <div className="mt-2 text-[12px] text-[#c4c9b0]/50 space-y-2">
              <p>Didn't receive it?{' '}
                <button onClick={resend} disabled={busy} className="text-[var(--accent-dark)] font-semibold hover:text-[var(--accent)] disabled:opacity-50 bg-transparent border-none cursor-pointer p-0">
                  {busy ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </p>
              <p>Wrong email?{' '}
                <button onClick={() => setChanging(true)} className="text-[var(--accent-dark)] font-semibold hover:text-[var(--accent)] bg-transparent border-none cursor-pointer p-0">
                  Change Email Address
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={changeEmail} className="mt-2 space-y-3 text-left">
              <input type="password" required placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-[16px] sm:text-sm p-3.5 outline-none focus:border-[var(--accent)]/50 placeholder:text-white/10" />
              <input type="email" required placeholder="New email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-[16px] sm:text-sm p-3.5 outline-none focus:border-[var(--accent)]/50 placeholder:text-white/10" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setChanging(false)} className="flex-1 bg-white/5 border border-white/10 rounded-xl text-[11px] font-semibold uppercase p-3 min-h-[44px]">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] font-bold text-[11px] uppercase p-3 min-h-[44px] rounded-xl disabled:opacity-50">
                  {busy ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckEmail;
