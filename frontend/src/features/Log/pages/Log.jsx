import React, { useState, useEffect, useMemo, useCallback } from "react";
import SidebarAnalytics from "../../../components/SidebarAnalytics.jsx";
import Icon from "../../../components/Icon.jsx";
import { apiFetch } from '../../../lib/apiClient.js';
import { BottomNav } from "../../../components/index.js";
import { useAuth } from "../../../hooks/useAuth.jsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayKey = () => toDateKey(new Date());

const formatDuration = (start, end) => {
  if (!end) return 'Incomplete';
  const totalSecs = Math.round((new Date(end) - new Date(start)) / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.round(totalSecs / 60);
  return `${mins} min${mins !== 1 ? 's' : ''}`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ activeDays, selectedKey, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-11 h-11 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center transition-colors"
        >
          <Icon name="chevron_left" className="text-[var(--text-muted)] text-base" />
        </button>
        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="w-11 h-11 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center transition-colors"
        >
          <Icon name="chevron_right" className="text-[var(--text-muted)] text-base" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const key      = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday  = key === todayKey();
          const hasLogs  = activeDays.has(key);
          const selected = key === selectedKey;

          return (
            <button
              key={key}
              onClick={() => onSelect(selected ? null : key)}
              aria-label={`Select ${key}`}
              className={`relative mx-auto w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-all min-w-0
                ${selected
                  ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] shadow-[var(--shadow-md)]'
                  : isToday
                    ? 'border border-[var(--accent-border)] text-[var(--accent)]'
                    : hasLogs
                      ? 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      : 'text-[var(--text-disabled)] cursor-default'
                }`}
              disabled={!hasLogs && !selected}
            >
              {day}
              {hasLogs && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Has logs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-[var(--accent-border)]" />
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Today</span>
        </div>
      </div>
    </div>
  );
}

// ─── Session Card (mobile) ────────────────────────────────────────────────────
function SessionCard({ session }) {
  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--text-muted)]">
          #VTL-{session.id.toString().padStart(4, '0')}
        </span>
        <span className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            session.status === 'completed'
              ? 'bg-[var(--accent)] shadow-[var(--shadow-sm)]'
              : 'bg-red-400'
          }`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            session.status === 'completed' ? 'text-[var(--accent)]' : 'text-red-400'
          }`}>
            {session.status ?? 'unknown'}
          </span>
        </span>
      </div>

      <div>
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Exercise</span>
        <span className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {session.workout_type ?? '–'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-light)]">
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Reps</span>
          <span className="text-lg font-black italic text-[var(--accent)] tracking-tighter leading-none">
            {session.rep_count ?? 0}
          </span>
        </div>
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Time</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Duration</span>
          <span className="text-xs font-black text-[var(--text-primary)] uppercase">
            {formatDuration(session.start_time, session.end_time)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Progress Chart (sessions / reps trend, last 7 days) ──────────────
function ProgressChart({ history }) {
  const [mode, setMode] = useState('sessions'); // 'sessions' | 'reps' | 'minutes'

  const minutesOf = (s) => {
    if (!s.end_time) return 0;
    const ms = new Date(s.end_time) - new Date(s.start_time);
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
  };

  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      const dayLogs = history.filter(h => toDateKey(h.start_time) === key);
      out.push({
        key,
        weekday: DAYS[d.getDay()],
        isToday: i === 0,
        sessions: dayLogs.length,
        reps: dayLogs.reduce((s, x) => s + (x.rep_count ?? 0), 0),
        minutes: dayLogs.reduce((s, x) => s + minutesOf(x), 0),
      });
    }
    return out;
  }, [history]);

  const valueOf = (d) => (mode === 'reps' ? d.reps : mode === 'minutes' ? d.minutes : d.sessions);
  const unitOf = mode === 'reps' ? 'reps' : mode === 'minutes' ? 'min' : 'sessions';
  const values = days.map(valueOf);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const best = days.reduce((b, d) => (valueOf(d) > valueOf(b) ? d : b), days[0]);
  const hasAny = total > 0;

  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-[15px] font-extrabold tracking-tight">Weekly Activity</h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Last 7 days · <span className="font-bold text-[var(--text-secondary)]">{total} {unitOf}</span>
            {hasAny && valueOf(best) > 0 && (
              <> · Best: <span className="font-bold text-[var(--accent)]">{best.weekday}</span></>
            )}
          </p>
        </div>
        <div className="flex bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg p-0.5">
          {['sessions', 'reps', 'minutes'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-md border-none cursor-pointer transition-all capitalize ${
                mode === m
                  ? 'text-[var(--accent-solid-fg)] shadow-lg bg-[var(--accent-solid)]'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {!hasAny ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 select-none">
          <span className="material-symbols-outlined text-[32px] opacity-20 text-[var(--accent)]">show_chart</span>
          <p className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider uppercase">No activity this week — complete a workout to start your trend</p>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 pt-4" role="img" aria-label={`Bar chart of ${mode} over the last 7 days`}>
          {days.map((d) => {
            const v = valueOf(d);
            const pct = Math.max(4, Math.round((v / max) * 100));
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className={`text-[10px] font-black tabular-nums ${v > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-disabled)]'}`}>
                  {v}
                </span>
                <div className="w-full max-w-[36px] h-28 flex items-end rounded-lg bg-[var(--bg-hover)] overflow-hidden">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${d.isToday ? 'bg-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-hover)]' : 'bg-[var(--accent)]/60'}`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${d.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {d.isToday ? 'Today' : d.weekday}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const Log = () => {
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const { user }  = useAuth();

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/workout-logs`);
      setHistory(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const activeDays = useMemo(() => {
    const s = new Set();
    history.forEach(h => s.add(toDateKey(h.start_time)));
    return s;
  }, [history]);

  const filtered = useMemo(() => {
    if (!selectedDay) return history;
    return history.filter(h => toDateKey(h.start_time) === selectedDay);
  }, [history, selectedDay]);

  const dayStats = useMemo(() => ({
    sessions:  filtered.length,
    totalReps: filtered.reduce((sum, s) => sum + (s.rep_count ?? 0), 0),
    completed: filtered.filter(s => s.status === 'completed').length,
  }), [filtered]);

  const selectedLabel = selectedDay
    ? selectedDay === todayKey()
      ? 'Today'
      : new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'All Time';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans flex flex-col md:flex-row relative">
      <div className="glass-content flex flex-col md:flex-row flex-1 min-w-0 w-full">
      <SidebarAnalytics />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-500 overflow-hidden md:ml-[72px]">

        <header className="p-4 sm:p-5 md:p-8 border-b border-[var(--border-light)] flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter text-[var(--text-primary)] leading-none">
              Session <span className="text-[var(--accent)]">History</span>
            </h1>
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[var(--text-muted)] mt-2 md:mt-3">
              Neural Tracking & Performance Archives
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest block">
              {selectedLabel}
            </span>
            <span className="text-2xl md:text-3xl font-black text-[var(--text-primary)]">
              {filtered.length.toString().padStart(2, '0')} sessions
            </span>
          </div>
        </header>

        <main className="p-4 md:p-8 flex flex-col gap-4 md:gap-6 pb-24 md:pb-8 w-full max-w-7xl 2xl:max-w-[1400px] mx-auto">

          {!loading && !error && <ProgressChart history={history} />}

          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-[280px] xl:w-[300px] flex-shrink-0 flex flex-col gap-4">

            <MiniCalendar
              activeDays={activeDays}
              selectedKey={selectedDay}
              onSelect={setSelectedDay}
            />

            {selectedDay && (
              <>
                <div className="flex gap-2 md:hidden">
                  {[
                    { label: 'Sessions',  val: dayStats.sessions  },
                    { label: 'Reps',      val: dayStats.totalReps },
                    { label: 'Done',      val: dayStats.completed  },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex-1 glass-card border border-[var(--border-light)] rounded-xl p-3 text-center">
                      <span className="text-[var(--accent)] text-xl font-black italic block leading-none">{val}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-1 block">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block glass-card border border-[var(--border-light)] rounded-3xl p-6 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
                    Day Summary
                  </p>
                  {[
                    { label: 'Sessions',  val: dayStats.sessions  },
                    { label: 'Total Reps', val: dayStats.totalReps },
                    { label: 'Completed', val: dayStats.completed  },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
                      <span className="text-base font-black italic text-[var(--accent)] tracking-tighter">{val}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-center"
              >
                ↺ Show all time
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">

            <div className="flex flex-col gap-3 md:hidden">
              {loading ? (
                <div className="p-16 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest text-sm">
                  Accessing Archives…
                </div>
              ) : error ? (
                <div className="p-16 text-center text-red-400 font-bold uppercase tracking-widest text-sm" role="alert">
                  ⚠ {error}
                  <span className="block text-[var(--text-muted)] text-xs mt-2">Is your backend running?</span>
                  <button onClick={fetchLogs} className="mt-4 h-10 px-5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
                    Try again
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="text-3xl mb-3">🏋️</div>
                  <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-sm">
                    No sessions on {selectedLabel}
                  </p>
                  <p className="text-[var(--text-disabled)] text-xs mt-1">Pick another day or complete a workout</p>
                </div>
              ) : (
                filtered.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))
              )}
            </div>

            <div className="hidden md:block glass-card border border-[var(--border-light)] rounded-3xl overflow-hidden">
              <div className="overflow-x-auto table-scroll">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                      {['Ref ID', 'Exercise', 'Reps', 'Status', 'Time', 'Duration'].map(h => (
                        <th key={h} className="px-4 xl:px-7 py-4 xl:py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="p-20 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest">
                          Accessing Archives…
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="6" className="p-20 text-center text-red-400 font-bold uppercase tracking-widest" role="alert">
                          ⚠ {error}
                          <span className="block text-[var(--text-muted)] text-xs mt-2">Is your backend running?</span>
                          <button onClick={fetchLogs} className="mt-4 h-10 px-5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
                            Try again
                          </button>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-16 text-center">
                          <div className="text-3xl mb-3">🏋️</div>
                          <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-sm">
                            No sessions on {selectedLabel}
                          </p>
                          <p className="text-[var(--text-disabled)] text-xs mt-1">Pick another day or complete a workout</p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((session) => (
                        <tr key={session.id} className="hover:bg-[var(--bg-hover)] transition-all group">
                          <td className="px-7 py-6 font-mono text-xs text-[var(--text-muted)]">
                            #VTL-{session.id.toString().padStart(4, '0')}
                          </td>
                          <td className="px-7 py-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                              {session.workout_type ?? '–'}
                            </span>
                          </td>
                          <td className="px-7 py-6">
                            <span className="text-lg font-black italic text-[var(--accent)] tracking-tighter">
                              {session.rep_count ?? 0}
                            </span>
                            <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase ml-1">reps</span>
                          </td>
                          <td className="px-7 py-6">
                            <span className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                session.status === 'completed'
                                  ? 'bg-[var(--accent)] shadow-[var(--shadow-sm)]'
                                  : 'bg-red-400'
                              }`} />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${
                                session.status === 'completed' ? 'text-[var(--accent)]' : 'text-red-400'
                              }`}>
                                {session.status ?? 'unknown'}
                              </span>
                            </span>
                          </td>
                          <td className="px-7 py-6 text-sm font-medium text-[var(--text-secondary)]">
                            {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-7 py-6 font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors uppercase text-sm">
                            {formatDuration(session.start_time, session.end_time)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          </div>
        </main>
      </div>

      <BottomNav />
      </div>
    </div>
  );
};

export default Log;