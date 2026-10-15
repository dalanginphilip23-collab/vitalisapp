import React from 'react';
import { apiGet } from '../../../lib/apiClient.js';
import ErrorState from '../../../components/feedback/ErrorState.jsx';
import { useToastStore } from '../../../stores/toastStore.js';
import { EmptyPanel } from './PageHeader.jsx';
import { useUnits } from '../../../hooks/useUnits.js';
import { formatWeight } from '../../../lib/units.js';

export function ProgressHeader({ timeframe, setTimeframe, onBack }) {
  const opts = [
    { label: 'Week', value: 'Weekly' },
    { label: 'Month', value: 'Monthly' },
    { label: 'Year', value: 'Quarterly' },
  ];
  return (
    <section className="w-full max-w-xl mx-auto mb-4">
      <div className="flex items-center justify-between py-1">
        <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
          <span className="material-symbols-outlined text-[22px]">chevron_left</span>
        </button>
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Progress</h2>
        <button aria-label="Share progress" onClick={async () => {
          const text = 'My Vitalis progress';
          try {
            if (navigator.share) { await navigator.share({ title: 'My Progress', text }); return; }
            await navigator.clipboard?.writeText(text);
            useToastStore.getState().addToast('Progress summary copied to clipboard.', 'success');
          } catch {
            useToastStore.getState().addToast('Sharing is not available on this device.', 'error');
          }
        }} className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
          <span className="material-symbols-outlined text-[20px]">share</span>
        </button>
      </div>
      <div className="mt-2 flex bg-[var(--bg-tertiary)] rounded-full p-1 gap-1 border border-[var(--border-light)]">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => setTimeframe(o.value)}
            className={`flex-1 py-2 rounded-full text-[11px] font-bold transition-all ${
              timeframe === o.value ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ProgressPanel({ userId, navigate }) {
  const units = useUnits();
  const [data, setData] = React.useState({ bmi: [], volume: [] });
  const [loadError, setLoadError] = React.useState(null);
  const load = React.useCallback(() => {
    if (!userId) return;
    setLoadError(null);
    apiGet(`/api/analytics/progress/${userId}`)
      .then((d) => setData(d || { bmi: [], volume: [] }))
      .catch((err) => setLoadError(err));
  }, [userId]);
  React.useEffect(() => { load(); }, [load]);
  // Real Activity Overview — last 7 days of training volume from /api/analytics/progress.
  const last7 = (data.volume || []).slice(-7);
  const maxSteps = Math.max(1, ...last7.map((v) => Number(v.steps) || 0));
  const fmtTick = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
  const yTicks = [maxSteps, (maxSteps * 2) / 3, maxSteps / 3, 0].map(fmtTick);
  const weekBars = last7.length ? last7.map((v) => Math.max(6, Math.round(((Number(v.steps) || 0) / maxSteps) * 100))) : [];
  const weekDays = last7.length
    ? last7.map((v) => new Date(`${v.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }))
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const peak = weekBars.length ? weekBars.indexOf(Math.max(...weekBars)) : -1;
  const totalWorkouts = (data.volume || []).length;
  const totalKcal = (data.volume || []).reduce((s, v) => s + (Number(v.calories_burned) || 0), 0);
  const totalMins = (data.volume || []).reduce((s, v) => s + (Number(v.workout_duration_mins) || 0), 0);
  const totalHrs = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  const completedPct = totalWorkouts ? Math.min(100, Math.round((totalWorkouts / 14) * 100)) : 0;
  const ringR = 15.5;
  const ringC = 2 * Math.PI * ringR;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
      {loadError && (
        <div className="col-span-1 lg:col-span-12">
          <ErrorState message={loadError.message || 'Could not load progress data.'} onRetry={load} />
        </div>
      )}
      {/* Activity Overview — real 14-day training volume */}
      <div className="col-span-1 lg:col-span-7 glass-panel rounded-[20px] p-4 sm:p-6 border border-[var(--border-light)] w-full">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-[var(--text-primary)]">Activity Overview</h3>
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] inline-block" />Steps</span>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex flex-col justify-between text-[9px] text-[var(--text-muted)] h-36 py-0.5">
            {yTicks.map((t) => <span key={t}>{t}</span>)}
          </div>
          <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 h-36">
            {weekBars.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] font-bold self-center">No step data yet — log activity to fill this chart.</p>
            ) : weekBars.map((h, i) => (
              <div key={`${weekDays[i]}-${i}`} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end" title={`${last7[i]?.steps ?? 0} steps`}>
                <div
                  className="w-full rounded-full"
                  style={{
                    height: `${h}%`,
                    background: i === peak ? 'var(--text-primary)' : 'var(--border-medium)',
                  }}
                />
                <span className="text-[9px] text-[var(--text-muted)] truncate max-w-full">{weekDays[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { v: String(totalWorkouts), l: 'Active days', s: 'Last 14d', icon: 'fitness_center' },
            { v: totalKcal.toLocaleString(), l: 'Calories', s: 'Last 14d', icon: 'local_fire_department' },
            { v: `${totalHrs}h ${remMins}m`, l: 'Active Time', s: 'Last 14d', icon: 'schedule' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-[var(--border-light)] glass-card p-3 text-center">
              <p className="text-[9px] uppercase font-bold text-[var(--text-muted)]">{s.l}</p>
              <p className="text-[15px] font-black text-[var(--text-primary)] mt-0.5">{s.v}</p>
              <p className="text-[9px] text-[var(--text-muted)] mt-0.5 flex items-center justify-center gap-1">{s.s}<span className="material-symbols-outlined text-[11px]">{s.icon}</span></p>
            </div>
          ))}
        </div>
      </div>
      {/* Workout Progress — real 14-day completion */}
      <div className="col-span-1 lg:col-span-5 flex flex-col gap-3 w-full">
        <div className="glass-card rounded-[20px] px-4 py-3.5 border border-[var(--border-light)] flex items-center justify-between">
          <div>
            <p className="font-bold text-[13px] text-[var(--text-primary)]">Workout Progress</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{totalWorkouts} / 14 active days (14d window)</p>
          </div>
          <div className="relative w-12 h-12 shrink-0">
            <svg viewBox="0 0 40 40" className="w-12 h-12 -rotate-90">
              <circle cx="20" cy="20" r={ringR} fill="none" stroke="var(--border-light)" strokeWidth="4" />
              <circle cx="20" cy="20" r={ringR} fill="none" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(completedPct / 100) * ringC} ${ringC}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[var(--text-primary)]">{completedPct}%</span>
          </div>
        </div>
      </div>
      <div className="col-span-1 lg:col-span-6 bg-(--bg-tertiary) rounded-2xl p-4 sm:p-6 border border-(--border-light)">
        <h3 className="font-bold text-[10px] uppercase tracking-[0.25em] text-(--text-muted) mb-4">Weight / BMI trend</h3>
        {data.bmi.length === 0 ? (
          <EmptyPanel title="No body metrics yet" hint="Set height + weight in onboarding or Profile to start your trend." action="Set body profile" onAction={() => navigate('/onboarding')} />
        ) : (
          <div className="space-y-2">
            {data.bmi.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[12px] border-b border-(--border-light) py-2">
                <span className="font-bold">{b.date}</span>
                <span className="text-(--text-muted)">{formatWeight(b.weight_kg, units)} · BMI {b.bmi}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-1 lg:col-span-6 bg-(--bg-tertiary) rounded-2xl p-4 sm:p-6 border border-(--border-light)">
        <h3 className="font-bold text-[10px] uppercase tracking-[0.25em] text-(--text-muted) mb-4">Training volume (14d)</h3>
        {data.volume.length === 0 ? (
          <EmptyPanel title="No training volume yet" hint="Log a workout or run to see your 14-day volume." action="Log activity" onAction={() => navigate('/dashboard/workouts')} />
        ) : (
          <div className="space-y-2">
            {data.volume.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-[12px] border-b border-(--border-light) py-2">
                <span className="font-bold">{v.date}</span>
                <span className="text-(--text-muted)">{v.steps} steps · {v.calories_burned} kcal · {v.workout_duration_mins} min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
