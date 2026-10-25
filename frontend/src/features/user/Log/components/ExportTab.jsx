// Module 6 — export tab: one CSV bundle (workouts + measurements + photos
// index) produced by GET /api/progress/export.csv, plus the AI progress
// diary letter (text/plain). Both download as files; nothing leaves the
// user's own session.
import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { API_BASE_URL } from '../../../../app/config/env.js';

// Raw fetch (not apiClient — apiFetch only returns parsed JSON bodies) with
// cookie credentials, then a triggered client-side download.
async function downloadTextFile(url, filename) {
  const res = await fetch(`${API_BASE_URL}${url}`, { credentials: 'include' });
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch { /* plain-text error path */ }
    throw new Error(msg);
  }
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

export default function ExportTab({ userId }) {
  const [busy,   setBusy]   = useState(null); // 'csv' | 'diary'
  const [error,  setError]  = useState('');
  const [done,   setDone]   = useState('');

  const run = async (kind) => {
    if (busy) return;
    setBusy(kind);
    setError('');
    setDone('');
    try {
      if (kind === 'csv') {
        await downloadTextFile('/api/progress/export.csv', `vitalis-progress-${new Date().toISOString().slice(0, 10)}.csv`);
        setDone('CSV downloaded — opens in Excel or Google Sheets.');
      } else {
        await downloadTextFile('/api/progress/diary.txt', `vitalis-diary-${new Date().toISOString().slice(0, 10)}.txt`);
        setDone('Progress diary downloaded.');
      }
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full space-y-4" data-user={userId}>
      <div>
        <h3 className="text-[length:var(--fs-15)] font-extrabold tracking-tight">Export your progress</h3>
        <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">
          Take everything you logged with you — workouts, body measurements and your photo index in one CSV,
          and a Gemini-written progress diary built from your real numbers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--border-light)] p-4 space-y-2">
          <span className="flex items-center gap-2 text-[length:var(--fs-12)] font-black uppercase tracking-widest text-[var(--text-primary)]">
            <Icon name="table_view" className="text-[length:var(--fs-16)] text-[var(--accent)]" /> Progress CSV
          </span>
          <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] leading-relaxed">
            Three sections: workouts (with paused time + sets), body measurements, photos index with Gemini ratings.
          </p>
          <Button
            onClick={() => run('csv')}
            loading={busy === 'csv'}
            disabled={!!busy}
            fullWidth
            className="!py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest"
          >
            Download CSV
          </Button>
        </div>

        <div className="rounded-2xl border border-[var(--border-light)] p-4 space-y-2">
          <span className="flex items-center gap-2 text-[length:var(--fs-12)] font-black uppercase tracking-widest text-[var(--text-primary)]">
            <Icon name="auto_stories" className="text-[length:var(--fs-16)] text-[var(--accent)]" /> AI progress diary
          </span>
          <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] leading-relaxed">
            A short letter summarizing the last 8 weeks from your real logged data — the same numbers
            behind the charts. General fitness info, never medical advice.
          </p>
          <Button
            onClick={() => run('diary')}
            loading={busy === 'diary'}
            disabled={!!busy}
            fullWidth
            className="!py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest"
          >
            Generate diary (.txt)
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-[length:var(--fs-11)] font-bold text-[var(--error)] bg-[var(--error-bg)] border border-[var(--error)]/25 rounded-xl px-3 py-2" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="text-[length:var(--fs-11)] font-bold text-[var(--accent)] bg-[var(--accent-bg)] rounded-xl px-3 py-2" role="status">
          {done}
        </p>
      )}
    </div>
  );
}
