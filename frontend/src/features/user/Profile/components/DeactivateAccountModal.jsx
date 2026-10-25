import { useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { apiFetch } from '../../../../lib/apiClient.js';

// Module 1 — soft account deactivation (Profile → Security → Danger Zone).
// Password-confirmed; the server revokes every session and keeps all data.
// Reactivation is one click at the next sign-in.
export default function DeactivateAccountModal({ onClose, onDeactivated }) {
  const [password, setPassword]     = useState('');
  const [confirmed, setConfirmed]   = useState(false);
  const [error,     setError]       = useState('');
  const [busy,      setBusy]        = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!password) { setError('Enter your password to confirm.'); return; }
    if (!confirmed) { setError('Tick the confirmation first — this signs you out everywhere.'); return; }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/deactivate', {
        method: 'POST',
        body: JSON.stringify({ password }),
        skipAuthRedirect: true,
      });
      onDeactivated?.();
    } catch (err) {
      setError(err.message || 'Could not deactivate. Check your password and try again.');
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Deactivate account"
      subtitle="Reversible — your data is kept, sessions end now"
      icon="pause_circle"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={busy}>
            {busy ? 'Deactivating…' : 'Deactivate account'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ul className="text-[length:var(--fs-12)] text-[var(--text-muted)] leading-relaxed space-y-1.5 list-disc pl-4">
          <li>Your profile, logs, plans and history are <strong className="text-[var(--text-primary)]">kept</strong> — nothing is deleted.</li>
          <li>You are signed out on <strong className="text-[var(--text-primary)]">all devices</strong> immediately.</li>
          <li>Signing in again offers <strong className="text-[var(--text-primary)]">one-click reactivation</strong>.</li>
        </ul>

        <div>
          <label htmlFor="deactivate-password" className="block text-[length:var(--fs-10)] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Password
          </label>
          <input
            id="deactivate-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••"
            className="mt-1.5 w-full h-11 rounded-[var(--radius-md)] bg-[var(--input-bg)] border border-[var(--input-border)] px-3.5 text-[length:var(--fs-14)] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/12 disabled:opacity-60"
          />
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => { setConfirmed(e.target.checked); setError(''); }}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)] cursor-pointer shrink-0"
          />
          <span className="text-[length:var(--fs-12)] text-[var(--text-muted)] leading-relaxed">
            I understand this signs me out everywhere and that I can reactivate by signing in again.
          </span>
        </label>

        {error && <p className="text-[length:var(--fs-12)] font-semibold text-[var(--error)]" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
