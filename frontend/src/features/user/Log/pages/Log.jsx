import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "../../../../components/Icon.jsx";
import { apiFetch } from '../../../../lib/apiClient.js';
import { BottomNav } from "../../../../components/index.js";
import AppShell from "../../../../components/AppShell.jsx";
import PageHeader from "../../../../components/app/PageHeader.jsx";
import { useAuth } from "../../../../hooks/useAuth.jsx";
import AddWorkoutModal from "../components/AddWorkoutModal.jsx";
import ActivityChart from "../components/ActivityChart.jsx";
import ProgressOverviewChart from "../components/ProgressOverviewChart.jsx";
import ProgressPhotosTab from "../components/ProgressPhotosTab.jsx";
import BodyMeasurementsPanel from "../components/BodyMeasurementsPanel.jsx";
import ExportTab from "../components/ExportTab.jsx";
import "../log.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayKey = () => toDateKey(new Date());

const formatDuration = (start, end) => {
  if (!end) return 'Incomplete';
  const totalSecs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.round(totalSecs / 60);
  return `${mins} min${mins !== 1 ? 's' : ''}`;
};

// Module 5: human-readable set rollup line for sessions that have them, e.g.
// "3 exercises · 12 sets · 1,540 kg volume" (shown under the session name).
const setSummaryLine = (s) => {
  if (!s || !s.set_rows) return null;
  const parts = [];
  if (s.exercise_count) parts.push(`${s.exercise_count} exercise${s.exercise_count !== 1 ? 's' : ''}`);
  parts.push(`${s.set_rows} set${+s.set_rows !== 1 ? 's' : ''}`);
  if (s.volume_kg) parts.push(`${Math.round(s.volume_kg).toLocaleString()} kg volume`);
  return parts.join(' · ');
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
    <div className="log-calendar glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-11 h-11 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center transition-colors"
        >
          <Icon name="chevron_left" className="text-[var(--text-muted)] text-base" />
        </button>
        <span className="text-[length:var(--fs-11)] font-black uppercase tracking-widest text-[var(--text-secondary)]">
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
          <div key={d} className="text-center text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)] py-1">
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
              className={`relative mx-auto w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[length:var(--fs-11)] font-black transition-all
                ${selected
                  ? 'bg-[var(--accent)] text-[var(--text-inverse)] shadow-[var(--shadow-md)]'
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
          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)]">Has logs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-[var(--accent-border)]" />
          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)]">Today</span>
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
              : 'bg-[var(--error)]'
          }`} />
          <span className={`text-[length:var(--fs-10)] font-black uppercase tracking-widest ${
            session.status === 'completed' ? 'text-[var(--accent)]' : 'text-[var(--error)]'
          }`}>
            {session.status ?? 'unknown'}
          </span>
        </span>
      </div>

      <div>
        <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Exercise</span>
        <span className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {session.workout_type ?? '–'}
        </span>
        {(() => {
          const line = setSummaryLine(session);
          return line ? (
            <span className="block text-[length:var(--fs-9)] font-bold text-[var(--text-muted)] mt-1">{line}</span>
          ) : null;
        })()}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-light)]">
        <div>
          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Reps</span>
          <span className="text-lg font-black italic text-[var(--accent)] tracking-tighter leading-none">
            {session.rep_count ?? 0}
          </span>
        </div>
        <div>
          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Time</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div>
          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">Duration</span>
          <span className="text-xs font-black text-[var(--text-primary)] uppercase">
            {formatDuration(session.start_time, session.end_time)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Progress tabs (Body / Photos / Nutrition / Training / Goal / Export) ────────────
const TABS = [
  { key: 'body',      heading: 'Body',      headingAccent: 'Metrics',   icon: 'monitor_weight', subtitle: 'Weight, height & BMI history' },
  { key: 'photos',    heading: 'Photos',    headingAccent: 'Studio',    icon: 'photo_library',  subtitle: 'Front · side · back progress photos, reviewed by Gemini AI' },
  { key: 'nutrition', heading: 'Nutrition', headingAccent: 'Log',       icon: 'restaurant',     subtitle: 'Calories & macro intake history' },
  { key: 'training',  heading: 'Session',   headingAccent: 'History',   icon: 'exercise',       subtitle: 'Neural Tracking & Performance Archives' },
  { key: 'goal',      heading: 'Goal',      headingAccent: 'Tracker',   icon: 'flag',           subtitle: 'Active goal & progress to target' },
  { key: 'export',    heading: 'Export',    headingAccent: 'Data',      icon: 'download',       subtitle: 'Take your logs with you — CSV bundle + AI progress diary' },
];

function TabBar({ active, onChange }) {
  return (
    <div className="log-tabs flex gap-1.5 overflow-x-auto no-scrollbar bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-2xl p-1.5">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`log-tab flex items-center gap-2 px-4 h-10 rounded-xl text-[length:var(--fs-11)] font-black uppercase tracking-widest whitespace-nowrap border-none cursor-pointer transition-all ${
              isActive
                ? 'text-[var(--text-inverse)] bg-[var(--accent)] shadow-[var(--shadow-md)]'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon name={t.icon} className="text-[length:var(--fs-18)]" />
            {t.heading}
          </button>
        );
      })}
    </div>
  );
}

// Small data hook for the summary tabs — fetches one endpoint, exposes reload.
function usePanelData(url) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(url));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

function PanelState({ loading, error, onRetry }) {
  if (loading) return (
    <div className="glass-card border border-[var(--border-light)] rounded-3xl p-16 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest text-sm">
      Accessing Archives…
    </div>
  );
  if (error) return (
    <div className="glass-card border border-[var(--border-light)] rounded-3xl p-16 text-center text-[var(--error)] font-bold uppercase tracking-widest text-sm" role="alert">
      ⚠ {error}
      <button onClick={onRetry} className="block mx-auto mt-4 h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
        Try again
      </button>
    </div>
  );
  return null;
}

function StatCard({ label, value, unit = undefined }) {
  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl p-4">
      <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1">{label}</span>
      <span className="text-2xl font-black italic text-[var(--accent)] tracking-tighter leading-none">{value}</span>
      {unit && <span className="text-[length:var(--fs-9)] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">{unit}</span>}
    </div>
  );
}

function EmptyPanel({ message }) {
  return (
    <div className="glass-card border border-[var(--border-light)] rounded-3xl p-16 text-center">
      <Icon name="inbox" className="text-[length:var(--fs-36)] opacity-20 text-[var(--accent)]" />
      <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-sm mt-3">{message}</p>
    </div>
  );
}

function BodyTab({ userId }) {
  const { data, loading, error, reload } = usePanelData(userId ? `/api/bmi/${userId}` : null);
  const records = data?.records ?? [];

  if (loading || error) return <PanelState loading={loading} error={error} onRetry={reload} />;
  if (records.length === 0) return <EmptyPanel message="No body measurements yet — add your weight and height in Profile" />;

  const latest = records[0];
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Weight"   value={latest.weight_kg ?? '–'} unit="kg" />
        <StatCard label="Height"   value={latest.height_cm ?? '–'} unit="cm" />
        <StatCard label="BMI"      value={latest.bmi ?? '–'} />
        <StatCard label="Category" value={latest.bmi_category ?? '–'} />
      </div>
      <div className="glass-card border border-[var(--border-light)] rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[480px]">
            <thead>
              <tr className="border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                {['Recorded', 'Weight (kg)', 'Height (cm)', 'BMI', 'Category'].map((h) => (
                  <th key={h} className="px-4 xl:px-7 py-4 text-[length:var(--fs-10)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--bg-hover)] transition-all">
                  <td className="px-4 xl:px-7 py-4 text-sm font-medium text-[var(--text-secondary)]">{r.recorded_at}</td>
                  <td className="px-4 xl:px-7 py-4 text-lg font-black italic text-[var(--accent)] tracking-tighter">{r.weight_kg}</td>
                  <td className="px-4 xl:px-7 py-4 text-sm font-medium text-[var(--text-secondary)]">{r.height_cm}</td>
                  <td className="px-4 xl:px-7 py-4 text-sm font-black text-[var(--text-primary)]">{r.bmi}</td>
                  <td className="px-4 xl:px-7 py-4 text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-muted)]">{r.bmi_category ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NutritionTab({ userId }) {
  const { data, loading, error, reload } = usePanelData(userId ? `/api/food-logs/${userId}` : null);
  const records = data?.records ?? [];

  if (loading || error) return <PanelState loading={loading} error={error} onRetry={reload} />;
  if (records.length === 0) return <EmptyPanel message="No meals logged yet — log a meal to start tracking" />;

  const today  = todayKey();
  const todays = records.filter((r) => String(r.logged_at || '').slice(0, 10) === today);
  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const totals = {
    calories: Math.round(sum(todays, 'calories')),
    protein:  Math.round(sum(todays, 'protein')),
    carbs:    Math.round(sum(todays, 'carbs')),
    fat:      Math.round(sum(todays, 'fat')),
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <p className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-muted)]">
        Today · {todays.length} meal{todays.length === 1 ? '' : 's'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Calories" value={totals.calories} unit="kcal" />
        <StatCard label="Protein"  value={totals.protein}  unit="g" />
        <StatCard label="Carbs"    value={totals.carbs}    unit="g" />
        <StatCard label="Fat"      value={totals.fat}      unit="g" />
      </div>
      <div className="glass-card border border-[var(--border-light)] rounded-3xl p-4 sm:p-6">
        <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Recent Meals</p>
        <div className="divide-y divide-[var(--border-light)]">
          {records.slice(0, 8).map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[var(--text-primary)] truncate">{r.food_name}</span>
                <span className="block text-[length:var(--fs-10)] text-[var(--text-muted)]">{r.logged_at}{r.serving ? ` · ${r.serving}` : ''}</span>
              </div>
              <span className="text-sm font-black italic text-[var(--accent)] tracking-tighter shrink-0 ml-3">
                {Math.round(Number(r.calories) || 0)} <span className="text-[length:var(--fs-9)] not-italic text-[var(--text-muted)]">kcal</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalTab({ userId }) {
  const { data, loading, error, reload } = usePanelData(userId ? `/api/goals/active/${userId}` : null);
  const goal = data?.goal;

  if (loading || error) return <PanelState loading={loading} error={error} onRetry={reload} />;
  if (!goal) return <EmptyPanel message="No active goal — set one from onboarding or your profile" />;

  const pct = Math.max(0, Math.min(100, Math.round(Number(data?.progressPct) || 0)));
  const fmtGoal = (g) => String(g || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="glass-card border border-[var(--border-light)] rounded-3xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1">Active Goal</span>
            <span className="text-2xl font-black italic text-[var(--accent)] tracking-tighter uppercase">{fmtGoal(goal.goalType)}</span>
            {goal.pace && (
              <span className="block text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Pace: {fmtGoal(goal.pace)}</span>
            )}
          </div>
          <span className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">{pct}%</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${pct}%`, boxShadow: '0 0 12px var(--accent)' }} />
        </div>
        <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-2">
          {goal.weightKg != null ? `${goal.weightKg} kg` : '–'}
          {goal.targetWeightKg != null ? ` → ${goal.targetWeightKg} kg` : ''}
          {data?.currentWeightKg != null ? ` · current ${Math.round(data.currentWeightKg * 10) / 10} kg` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Daily Calories" value={goal.dailyKcal ?? '–'} unit="kcal" />
        <StatCard label="Protein"        value={goal.proteinG ?? '–'}  unit="g" />
        <StatCard label="Carbs"          value={goal.carbsG ?? '–'}    unit="g" />
        <StatCard label="Fat"            value={goal.fatG ?? '–'}      unit="g" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const Log = () => {
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('section');
  const [activeTab, setActiveTabState] = useState(
    ['training', 'body', 'photos', 'nutrition', 'goal', 'export'].includes(initialTab) ? initialTab : 'training'
  );
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'training') next.delete('section');
    else next.set('section', tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const { user }  = useAuth();

  const activeTabMeta = TABS.find((t) => t.key === activeTab) ?? TABS.find((t) => t.key === 'training') ?? TABS[0];

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/workout-logs?with_sets=1`);
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
    <AppShell userId={user?.id} mobileTitle="Progress" bottomNav={<BottomNav />}>
      <PageHeader
        eyebrow="Progress"
        title={<>{activeTabMeta.heading} <em>{activeTabMeta.headingAccent}</em></>}
        description={activeTabMeta.subtitle}
        actions={activeTab === 'training' ? (
          <div className="log-head-actions">
            <div className="log-head-summary">
              <span className="log-head-date">{selectedLabel}</span>
              <span className="log-head-count">
                {filtered.length.toString().padStart(2, '0')} <small>sessions</small>
              </span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="app-btn app-btn--primary log-head-btn"
            >
              <Icon name="add" className="text-[length:var(--fs-16)]" /> Log workout
            </button>
          </div>
        ) : null}
      />

      {showAddModal && (
        <AddWorkoutModal onClose={() => setShowAddModal(false)} onSaved={() => fetchLogs()} />
      )}

      <div className="log-page">
        <ProgressOverviewChart userId={user?.id} />

        <TabBar active={activeTab} onChange={setActiveTab} />

        <div className="log-tab-panels">

          {activeTab === 'training' && (
          <div className="log-training">
            <ActivityChart />

            <div className="log-training__grid">
              <aside className="log-side">

                <MiniCalendar
                  activeDays={activeDays}
                  selectedKey={selectedDay}
                  onSelect={setSelectedDay}
                />

                {selectedDay && (
                  <>
                    <div className="log-day-stats flex gap-2 md:hidden">
                      {[
                        { label: 'Sessions',  val: dayStats.sessions  },
                        { label: 'Reps',      val: dayStats.totalReps },
                        { label: 'Done',      val: dayStats.completed  },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex-1 glass-card border border-[var(--border-light)] rounded-xl p-3 text-center">
                          <span className="text-[var(--accent)] text-xl font-black italic block leading-none">{val}</span>
                          <span className="text-[length:var(--fs-8)] font-black uppercase tracking-widest text-[var(--text-muted)] mt-1 block">{label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="log-day-summary hidden md:block glass-card border border-[var(--border-light)] rounded-3xl p-6 space-y-3">
                      <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
                        Day Summary
                      </p>
                      {[
                        { label: 'Sessions',  val: dayStats.sessions  },
                        { label: 'Total Reps', val: dayStats.totalReps },
                        { label: 'Completed', val: dayStats.completed  },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-[length:var(--fs-10)] font-bold text-[var(--text-muted)] uppercase tracking-widest">{label}</span>
                          <span className="text-base font-black italic text-[var(--accent)] tracking-tighter">{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedDay && (
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="log-show-all text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-center"
                  >
                    ↺ Show all time
                  </button>
                )}
              </aside>

              <div className="log-main-col">

                <div className="log-sessions-list flex flex-col gap-3 md:hidden">
                  {loading ? (
                    <div className="p-16 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest text-sm">
                      Accessing Archives…
                    </div>
                  ) : error ? (
                    <div className="p-16 text-center text-[var(--error)] font-bold uppercase tracking-widest text-sm" role="alert">
                      ⚠ {error}
                      <span className="block text-[var(--text-muted)] text-xs mt-2">Is your backend running?</span>
                      <button onClick={fetchLogs} className="mt-4 h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
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

                <div className="log-sessions hidden md:block glass-card border border-[var(--border-light)] rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                      {['Ref ID', 'Exercise', 'Reps', 'Status', 'Time', 'Duration'].map(h => (
                        <th key={h} className="px-4 xl:px-7 py-4 xl:py-6 text-[length:var(--fs-10)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center animate-pulse text-[var(--accent)] font-black uppercase tracking-widest">
                          Accessing Archives…
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-[var(--error)] font-bold uppercase tracking-widest" role="alert">
                          ⚠ {error}
                          <span className="block text-[var(--text-muted)] text-xs mt-2">Is your backend running?</span>
                          <button onClick={fetchLogs} className="mt-4 h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold normal-case tracking-normal hover:brightness-110 active:scale-95 transition-all">
                            Try again
                          </button>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-16 text-center">
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
                            <span className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                              {session.workout_type ?? '–'}
                            </span>
                            {(() => {
                              const line = setSummaryLine(session);
                              return line ? (
                                <span className="block text-[length:var(--fs-9)] font-bold text-[var(--text-muted)] mt-1">{line}</span>
                              ) : null;
                            })()}
                          </td>
                          <td className="px-7 py-6">
                            <span className="text-lg font-black italic text-[var(--accent)] tracking-tighter">
                              {session.rep_count ?? 0}
                            </span>
                            <span className="text-[length:var(--fs-8)] text-[var(--text-muted)] font-bold uppercase ml-1">reps</span>
                          </td>
                          <td className="px-7 py-6">
                            <span className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                session.status === 'completed'
                                  ? 'bg-[var(--accent)] shadow-[var(--shadow-sm)]'
                                  : 'bg-[var(--error)]'
                              }`} />
                              <span className={`text-[length:var(--fs-10)] font-black uppercase tracking-widest ${
                                session.status === 'completed' ? 'text-[var(--accent)]' : 'text-[var(--error)]'
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
          </div>
          )}

          {activeTab === 'body' && (
            <div className="flex flex-col gap-4 md:gap-6">
              {/* Module 6 — tape + BF% logging; weight auto-mirrors to BMI */}
              <BodyMeasurementsPanel userId={user?.id} />
              {/* Existing BMI history (weight mirror lands here) */}
              <BodyTab userId={user?.id} />
            </div>
          )}
          {activeTab === 'photos'    && <ProgressPhotosTab    userId={user?.id} />}
          {activeTab === 'nutrition' && <NutritionTab userId={user?.id} />}
          {activeTab === 'goal'      && <GoalTab      userId={user?.id} />}
          {activeTab === 'export'    && <ExportTab    userId={user?.id} />}
        </div>
      </div>
    </AppShell>
  );
};

export default Log;