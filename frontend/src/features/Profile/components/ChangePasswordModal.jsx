import React, { useState } from 'react';
import { apiPost } from '../../../lib/apiClient.js';

const labelCls = 'block text-[9px] font-black tracking-[0.2em] uppercase text-[var(--text-muted)] mb-2';
const inputCls =
  'w-full rounded-xl px-3.5 py-2.5 text-[13px] font-medium outline-none transition-all ' +
  'bg-[var(--input-bg,var(--bg-hover))] border border-[var(--border-medium)] text-[var(--text-primary)] ' +
  'focus:border-[var(--accent)]/50 focus:bg-[var(--accent)]/[0.03] placeholder:text-[var(--text-disabled)]';

const getStrength = (pw) => {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'var(--error)', pct: '33%' };
  if (score <= 3) return { label: 'Medium', color: 'var(--warning)', pct: '66%' };
  return { label: 'Strong', color: 'var(--accent)', pct: '100%' };
};

/**
 * ChangePasswordModal
 *
 * Props:
 *   onClose   — () => void
 *   onSuccess — () => void   (called after a confirmed successful update,
 *               before onClose — use it to fire a toast etc.)
 *
 * No userId prop needed — the backend identifies the logged-in user from
 * the `vitalis_session` JWT cookie (sent automatically via credentials:
 * 'include'), the same way /api/auth/me does.
 */
const ChangePasswordModal = ({ onClose, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    if (newPassword === currentPassword) return setError('New password must be different from the current one.');

    setLoading(true);
    try {
      await apiPost('/api/auth/change-password', { currentPassword, newPassword });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pw-title"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-sm glass-panel border border-[var(--border-light)] rounded-2xl p-7 my-auto max-h-[90dvh] overflow-y-auto"
        style={{ animation: 'fadeScale 0.2s ease forwards' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="change-pw-title" className="text-sm font-display font-black text-[var(--text-primary)] uppercase tracking-tighter">
            Change Password
          </h3>
          <button onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-semibold tracking-[0.05em] py-2.5 px-3.5 mb-4 text-center">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className={labelCls}>Current password</label>
            <input
              type={showPw ? 'text' : 'password'}
              className={inputCls}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className={labelCls}>New password</label>
            <input
              type={showPw ? 'text' : 'password'}
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
            {strength && (
              <div className="mt-2">
                <div className="h-[2px] bg-[var(--border-light)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: strength.pct, background: strength.color }}
                  />
                </div>
                <p className="text-[10px] mt-1 font-semibold" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          <div className="mb-2">
            <label className={labelCls}>Confirm new password</label>
            <input
              type={showPw ? 'text' : 'password'}
              className={inputCls}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2 mt-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPw}
              onChange={(e) => setShowPw(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Show passwords
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
              className="w-full py-3 bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ChangePasswordModal;