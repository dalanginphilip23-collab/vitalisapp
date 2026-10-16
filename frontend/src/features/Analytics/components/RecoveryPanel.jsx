import React from 'react';
import { apiGet } from '../../../lib/apiClient.js';
import ErrorState from '../../../components/feedback/ErrorState.jsx';
import CheckInModal from '../../Dashboard/components/CheckInModal.jsx';

export default function RecoveryPanel({ userId }) {
  const [rows, setRows] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [checkInOpen, setCheckInOpen] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const [r, s] = await Promise.all([
        apiGet(`/api/analytics/recovery/${userId}`).catch((e) => { throw e; }),
        apiGet(`/api/analytics/summary/${userId}`).catch(() => null),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setSummary(s);
    } catch (err) {
      setRows([]);
      setSummary(null);
      setLoadError(err);
    }
  }, [userId]);
  React.useEffect(() => {
    if (!userId) return;
    load();
  }, [userId, load]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
      <div className="col-span-1 lg:col-span-12">
        <button onClick={() => setCheckInOpen(true)}
          className="w-full p-4 rounded-2xl bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] font-bold text-[13px] flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          <span className="material-symbols-outlined text-[18px]">fact_check</span> Daily Check-In
        </button>
      </div>
      {loadError && (
        <div className="col-span-1 lg:col-span-12">
          <ErrorState message={loadError.message || 'Could not load recovery data.'} onRetry={load} />
        </div>
      )}
      <div className="col-span-1 lg:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg sleep', value: summary?.avg_sleep_hours != null ? `${summary.avg_sleep_hours}h` : '—' },
          { label: 'Sleep quality', value: summary?.avg_sleep_quality != null ? `${summary.avg_sleep_quality}/10` : '—' },
          { label: 'Recovery', value: summary?.avg_recovery_score != null ? `${summary.avg_recovery_score}/10` : '—' },
          { label: 'Water', value: summary?.avg_water_ml != null ? `${summary.avg_water_ml} ml` : '—' },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-2xl bg-(--bg-tertiary) border border-(--border-light)">
            <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-muted)">{c.label}</p>
            <p className="text-xl font-black mt-1">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="col-span-1 lg:col-span-12 bg-(--bg-tertiary) rounded-2xl p-4 sm:p-6 border border-(--border-light)">
        <h3 className="font-bold text-[10px] uppercase tracking-[0.25em] text-(--text-muted) mb-4">14-day recovery trend</h3>
        {rows.length === 0 ? (
          <p className="text-(--text-muted) text-[11px] font-bold uppercase tracking-widest text-center py-6">No recovery logs yet — save a sleep log below.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[12px] border-b border-(--border-light) py-2">
                <span className="font-bold shrink-0">{r.date}</span>
                <span className="text-(--text-muted) min-w-0 truncate text-right">{r.sleep_hours ?? '—'}h · Q{r.sleep_quality ?? '—'}/10 · R{r.recovery_score ?? '—'}/10 · {r.water_ml ?? 0} ml</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-(--text-muted) mt-3">Manual logging only — automatic wearable sync isn't available yet. General fitness info, not medical advice.</p>
      </div>
      {checkInOpen && (
        <CheckInModal userId={userId} initial={null}
          onClose={() => setCheckInOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
