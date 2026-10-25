// Module 6 — How-active-are-you analytics. Data comes from REAL workout_logs
// aggregates (GET /api/progress/activity — active minutes exclude paused
// time), grouped by ISO week (8 weeks) or by day for the running month.
// Same CSS-bar language as the old 7-day chart it replaces.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { apiFetch } from '../../../../lib/apiClient.js';

const METRICS = ['minutes', 'sessions', 'reps'];

export default function ActivityChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [granularity, setGranularity] = useState('weeks'); // 'weeks' | 'month'
  const [metric, setMetric] = useState('minutes');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch('/api/progress/activity'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return granularity === 'weeks' ? (data.weeks || []) : (data.month || []);
  }, [data, granularity]);

  const valueOf = (r) => Number(r?.[metric] || 0);
  const values = rows.map(valueOf);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const best = rows.reduce((b, r) => (valueOf(r) > valueOf(b) ? r : b), rows[0]);
  const hasAny = total > 0;

  const labelOf = (r) => {
    if (granularity === 'weeks') {
      if (r.label === 'This week') return 'Now';
      const [, m, d] = r.week_start.split('-').map(Number);
      return `${m}/${d}`;
    }
    return Number(r.day.split('-')[2]);
  };

  const unitOf = metric === 'reps' ? 'reps' : metric === 'minutes' ? 'min' : 'sessions';

  return (
    <div className="log-activity glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
      <div className="log-activity__head flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-[length:var(--fs-15)] font-extrabold tracking-tight">Activity Analytics</h3>
          <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">
            {granularity === 'weeks' ? 'Last 8 weeks' : 'This month'} ·{' '}
            <span className="font-bold text-[var(--text-secondary)]">{total.toLocaleString()} {unitOf}</span>
            {hasAny && best && valueOf(best) > 0 && (
              <>
                {' '}· Best:{' '}
                <span className="font-bold text-[var(--accent)]">
                  {granularity === 'weeks' ? (best.label === 'This week' ? 'this week' : best.week_start) : best.day}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="log-activity__controls flex flex-col gap-1.5 items-end">
          {/* Week / Month granularity — the analytics view switch */}
          <div className="log-activity__seg flex bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg p-0.5">
            {[['weeks', 'Week'], ['month', 'Month']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGranularity(key)}
                aria-pressed={granularity === key}
                className={`log-activity__seg-btn ${granularity === key ? 'is-active ' : ''}px-3 py-1.5 text-[length:var(--fs-10)] font-bold rounded-md border-none cursor-pointer transition-all ${
                  granularity === key
                    ? 'text-[var(--text-inverse)] shadow-lg bg-[var(--accent)]'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="log-activity__seg flex bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg p-0.5">
            {METRICS.map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`log-activity__seg-btn ${metric === m ? 'is-active ' : ''}px-3 py-1.5 text-[length:var(--fs-10)] font-bold rounded-md border-none cursor-pointer transition-all capitalize ${
                  metric === m
                    ? 'text-[var(--text-inverse)] shadow-lg bg-[var(--accent)]'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest text-[length:var(--fs-11)]">
          Loading your activity…
        </div>
      ) : error ? (
        <p className="py-8 text-center text-[var(--error)] font-bold uppercase tracking-widest text-[length:var(--fs-11)]" role="alert">
          {error}
          <button onClick={load} className="block mx-auto mt-3 h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-10)] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
            Try again
          </button>
        </p>
      ) : !hasAny ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 select-none">
          <span className="material-symbols-outlined text-[length:var(--fs-32)] opacity-20 text-[var(--accent)]">show_chart</span>
          <p className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)] tracking-wider uppercase">
            No activity yet — complete a workout to start your trend
          </p>
        </div>
      ) : (
        <div className="log-activity__bars flex items-end justify-between gap-1 sm:gap-2 pt-4 overflow-x-auto no-scrollbar" role="img" aria-label={`Bar chart of ${metric} by ${granularity === 'weeks' ? 'week' : 'day'}`}>
          {rows.map((r) => {
            const v = valueOf(r);
            const pct = v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0;
            const isLast = granularity === 'weeks' ? r.label === 'This week' : r.day === (data?.month?.[data.month.length - 1]?.day);
            return (
              <div key={granularity === 'weeks' ? r.week_start : r.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${granularity === 'weeks' ? r.week_start : r.day}: ${v} ${unitOf}`}>
                <span className={`log-activity__value text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black tabular-nums ${v > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-disabled)]'}`}>
                  {v > 0 ? (metric === 'minutes' && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : ''}
                </span>
                <div className="log-activity__track w-full max-w-[36px] h-28 flex items-end rounded-lg bg-[var(--bg-hover)] overflow-hidden">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${isLast ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/60'}`}
                    style={{ height: `${pct}%`, boxShadow: isLast && v > 0 ? '0 0 12px var(--accent)' : undefined }}
                  />
                </div>
                <span className={`log-activity__label text-[length:var(--fs-7)] sm:text-[length:var(--fs-8)] font-black uppercase tracking-widest whitespace-nowrap ${isLast ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {labelOf(r)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Module 6 wiring note for the user — same stats drive the AI tips */}
      <p className="mt-3 text-[length:var(--fs-10)] text-[var(--text-muted)] leading-relaxed m-0">
        <Icon name="psychology" className="inline text-[length:var(--fs-12)] align-[-2px] text-[var(--accent)]" /> This is your real
        logged activity (paused time excluded) — Training tips use the same numbers.
      </p>
    </div>
  );
}
