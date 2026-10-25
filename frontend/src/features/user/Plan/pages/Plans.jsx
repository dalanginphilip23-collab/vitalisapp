import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { BottomNav } from '../../../../components/index.js';
import AppShell from '../../../../components/AppShell.jsx';
import PageHeader from '../../../../components/app/PageHeader.jsx';
import Icon from '../../../../components/Icon.jsx';
import usePlans from '../hooks/usePlan.js';
import { BRYL_CREDIT, frameUrl, getAllGuideExercises, guideFilterOptions, isHoldExercise, prescriptionForGuide, searchGuideExercises } from '../../CameraWorkout/constants/workoutGuide.js';
import { apiGet } from '../../../../lib/apiClient.js';
import Dropdown from '../../../../components/ui/Dropdown.jsx';
import {
  formatExerciseDetail,
  REST_ACTIVITY_TYPES,
  INTENSITY_OPTIONS,
  FOCUS_OPTIONS,
  DURATION_OPTIONS,
  CATEGORIES,
  TABS,
} from '../utils/planFormat.js';
import { PlanCover, FilterPill, PlanCard, TabBar } from '../components/PlanWidgets.jsx';
import PersonalPlanSheet from '../components/PersonalPlanSheet.jsx';
import TrainingPrefsSheet from '../components/TrainingPrefsSheet.jsx';
import AdaptiveTipsCard from '../components/AdaptiveTipsCard.jsx';
import { useTrainingPrefs, useTrainingInsights } from '../hooks/useTrainingPrefs.js';
import { muscleFor, summarizeMuscles, suggestAlternatives } from '../utils/exerciseMatch.js';
import { fitDayToMinutes } from '../utils/sessionFit.js';


const ExerciseLibrary = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');
  const [type, setType] = useState('');
  const [openSlug, setOpenSlug] = useState(null);
  const filters = useMemo(() => guideFilterOptions(), []);
  const results = useMemo(
    () => searchGuideExercises(query, {
      ...(equipment ? { equipment } : {}),
      ...(muscle ? { primaryMuscle: muscle } : {}),
      ...(type ? { exerciseType: type } : {}),
    }),
    [query, equipment, muscle, type]
  );
  const total = getAllGuideExercises().length;
  const open = openSlug ? getAllGuideExercises().find(e => e.slug === openSlug) : null;
  const openRx = open ? prescriptionForGuide(open) : null;
  return (
    <div>
      <p className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--text-muted)' }}>Search</p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, equipment, or muscle"
        className="w-full h-12 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 text-[length:var(--fs-13)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)]" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        {[
          { label: 'Equipment', value: equipment, set: setEquipment, options: filters.equipment, all: 'All equipment' },
          { label: 'Muscle', value: muscle, set: setMuscle, options: filters.muscles, all: 'All muscles' },
          { label: 'Type', value: type, set: setType, options: filters.types, all: 'All types' },
        ].map(f => (
          <Dropdown
            key={f.label}
            label={f.label}
            value={f.value}
            onChange={f.set}
            options={f.options}
            allLabel={f.all}
          />
        ))}
      </div>
      <p className="text-[length:var(--fs-11)] mt-3 mb-3" style={{ color: 'var(--text-muted)' }}>
        {results.length === total && !query && !equipment && !muscle && !type
          ? `Showing all ${total} exercises`
          : `Showing ${results.length} of ${total} exercises`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {results.map(ex => {
          return (
          <button key={ex.slug} onClick={() => setOpenSlug(ex.slug)}
            className="text-left rounded-[20px] border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent-border)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] glass-card h-full"
            style={{ borderColor: 'var(--border-light)' }}>
            <span className="block aspect-[4/3] w-full" style={{ background: '#1E1E1E' }}>
              {frameUrl(ex.slug, 1)
                ? <img src={frameUrl(ex.slug, 1)} alt={ex.name} className="w-full h-full object-contain p-4" loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[length:var(--fs-40)] text-white">fitness_center</span>}
            </span>
            <span className="block p-4">
              <span className="block text-[length:var(--fs-15)] font-black" style={{ color: 'var(--text-primary)' }}>{ex.name}</span>
              <span className="block text-[length:var(--fs-12)] mt-0.5" style={{ color: 'var(--text-muted)' }}>{ex.primaryMuscle} - {ex.equipment}</span>
            </span>
          </button>
          );
        })}
      </div>
      <p className="text-[length:var(--fs-10)] mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {BRYL_CREDIT}
      </p>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto"
          style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpenSlug(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                style={{ background: '#1E1E1E' }}>
                {frameUrl(open.slug, 1)
                  ? <img src={frameUrl(open.slug, 1)} alt={open.name} className="w-full h-full object-contain p-1"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <Icon name="fitness_center" className="text-[length:var(--fs-22)]" style={{ color: '#fff' }} />}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black truncate" style={{ color: 'var(--text-primary)' }}>{open.name}</h3>
                <p className="text-[length:var(--fs-11)]" style={{ color: 'var(--text-muted)' }}>
                  {open.primaryMuscle} · {open.equipment} · {isHoldExercise(open) ? 'Hold (timer)' : 'Reps (camera count)'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3].map(f => (
                frameUrl(open.slug, f)
                  ? <img key={f} src={frameUrl(open.slug, f)} alt={`${open.name} frame ${f}`} className="w-1/3 aspect-square object-contain rounded-xl border p-1" style={{ borderColor: 'var(--border-light)', background: '#1E1E1E' }} loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : null
              ))}
            </div>
            <p className="text-[length:var(--fs-11)] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              {isHoldExercise(open) ? 'Hold steady in frame to time' : 'Full range counts a rep'}
            </p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {(open.secondaryMuscles || []).length ? `Also works: ${open.secondaryMuscles.join(', ')}.` : 'Follow the guide frames and keep your form.'}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
              {[['Sets', openRx.sets], ['Target', openRx.reps], ['Gear', openRx.weight]].map(([l, v]) => (
                <div key={l} className="rounded-xl p-3 border" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}>
                  <p className="text-[length:var(--fs-9)] font-black uppercase" style={{ color: 'var(--text-muted)' }}>{l}</p>
                  <p className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpenSlug(null)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border"
                style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}>
                Close
              </button>
              <button onClick={() => navigate('/dashboard/workouts', { state: { exerciseId: open.slug } })}
                className="flex-1 py-3 rounded-xl font-black text-sm uppercase"
                style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
                Start {isHoldExercise(open) ? 'Hold' : 'Workout'}
              </button>
            </div>
            <p className="text-[length:var(--fs-9)] mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{BRYL_CREDIT}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── WORKOUT HISTORY: completed camera sessions (spec T) ──
const WorkoutHistory = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/api/workout-logs');
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch { /* empty state */ }
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) {
    return <p className="py-10 text-center text-xs uppercase tracking-widest animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading history...</p>;
  }
  if (logs.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No workouts yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Start a camera workout or pick an exercise from the Library.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-1">
        Workout History <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] tabular-nums">{logs.length}</span>
      </p>
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between rounded-xl p-3 border glass-card"
          style={{ borderColor: 'var(--border-light)' }}>
          <div>
            <p className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{String(log.workout_type || '').replace(/_/g, ' ')}</p>
            <p className="text-[length:var(--fs-11)]" style={{ color: 'var(--text-muted)' }}>
              {log.start_time ? new Date(log.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
              {log.duration_seconds ? ` · ${Math.round(log.duration_seconds / 60)} min` : ''}
              {' · '}{log.status}
              {log.difficulty_rating ? ` · felt ${log.difficulty_rating}/5` : ''}
            </p>
          </div>
          <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>{log.rep_count ?? 0} reps</span>
        </div>
      ))}
    </div>
  );
};

// EXERCISE FORMATTING HELPERS


// PLAN DETAIL OVERLAY COMPONENT
const PlanDetailOverlay = ({ plan, onClose, onStart }) => {
  if (!plan) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 md:p-6 overflow-y-auto"
      style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg lg:max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl sm:my-auto max-h-[92vh] max-h-[92dvh] flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* drag pill for mobile sheet */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-medium)' }} />
        </div>
        <div className="overflow-y-auto flex-1">
          <div className="aspect-[16/7] relative overflow-hidden flex-shrink-0">
            <PlanCover seed={plan.image_seed} title={plan.title} opacity={0.3} />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, var(--bg-secondary) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
            />
            <div className="absolute bottom-3 sm:bottom-4 left-4 sm:left-6 flex gap-2">
              <span
                className="px-2 py-0.5 rounded text-[length:var(--fs-9)] font-black tracking-widest uppercase"
                style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
              >
                {plan.tag}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[length:var(--fs-9)] font-bold tracking-widest uppercase"
                style={{ background: 'var(--bg-hover)', backdropFilter: 'blur(4px)', color: 'var(--text-secondary)' }}
              >
                {plan.intensity}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close plan details"
              className="absolute top-3 sm:top-4 right-3 sm:right-4 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.45)', color: 'var(--text-muted)' }}
            >
              <Icon name="close" className="text-[length:var(--fs-18)]" />
            </button>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 max-w-[420px] sm:max-w-xl mx-auto w-full">
            <h2 className="text-xl sm:text-2xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>{plan.title}</h2>
            <p className="text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 sm:mb-6 text-center">
              {[
                { label: 'Duration',  value: plan.duration,      sub: 'program', icon: 'schedule' },
                { label: 'Level', value: plan.intensity,     sub: 'intensity', icon: 'bolt' },
                { label: 'Focus',     value: (plan.target_focus || '').split(' ')[0] || 'Full', sub: 'body', icon: 'track_changes' },
                { label: 'Equipment', value: 'None', sub: 'needed', icon: 'block' },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-2.5 text-center border"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}
                >
                  <p className="text-[length:var(--fs-9)] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  <p className="text-[length:var(--fs-13)] font-black" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                  <p className="text-[length:var(--fs-9)]" style={{ color: 'var(--text-muted)' }}>{stat.sub}</p>
                </div>
              ))}
            </div>
            <div
              className="rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border"
              style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
            >
              <p className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-black uppercase tracking-widest mb-1.5 sm:mb-2" style={{ color: 'var(--accent)' }}>
                What this plan does
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                This structured {plan.duration} program targets{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{plan.target_focus}</strong> with daily progressive
                sessions. Each day builds on the last — follow the protocol, complete every task, and unlock the next day.
              </p>
            </div>
            <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
              <span className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                {plan.price === 0 || plan.price === '0.00' ? 'Free' : `$${plan.price}`}
              </span>
              {plan.price > 0 && plan.is_enrolled !== 1 && (
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  One-time purchase
                </span>
              )}
            </div>
            <button
              onClick={onStart}
              className="w-full py-3.5 pl-5 pr-2 rounded-full font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-all duration-200"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              <span>{plan.is_enrolled === 1 ? 'Open Plan Tracker' : 'Start Workout'}</span>
              <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <span className="material-symbols-outlined text-[length:var(--fs-20)]">play_arrow</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Module 5 — day-cycling schedule ──────────────────────────────────────────
// Maps training days across the user's preferred weekdays: training day #1 →
// first preferred day, #2 → second, cycling. Rest days are just rest.
const WEEKDAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function mapPlanSchedule(content, preferredDays) {
  const days = Array.isArray(preferredDays) ? preferredDays.filter((d) => Number.isInteger(d)) : [];
  if (days.length === 0 || !Array.isArray(content)) return {};
  const map = {};
  let trainIdx = 0;
  for (const day of content) {
    if (day == null) continue;
    if (REST_ACTIVITY_TYPES.has(day.activity_type)) {
      map[day.day_number] = { isRest: true };
      continue;
    }
    map[day.day_number] = { isRest: false, weekday: Number(days[trainIdx % days.length]) };
    trainIdx += 1;
  }
  return map;
}

// DAY TRACKER COMPONENT
const DayTracker = ({ plan, content, progress, onClose, onCompleteDay, prefs }) => {
  const navigate = useNavigate();
  const completedDays = progress.filter(p => p.is_completed).map(p => p.day_number);
  const totalDays     = content.length;
  const currentDay    = content.find(d => !completedDays.includes(d.day_number)) || content[0];
  const [activeDay,  setActiveDay]  = useState(currentDay?.day_number || 1);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeDayData = content.find(d => d.day_number === activeDay);
  const isDayComplete = completedDays.includes(activeDay);
  const progressPct   = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;
  const isRestDay = REST_ACTIVITY_TYPES.has(activeDayData?.activity_type);

  // ── Module 5 — fit-to-minutes + alternatives state ─────────────────────────
  const [localFit,  setLocalFit]  = useState(0);       // 0 = full session
  const [altExName, setAltExName] = useState(null);    // alternatives sheet source
  const sessionMins = prefs?.sessionDurationMins ?? null;

  // Trimming is derived (never stored): a fresh budget recomputes safely.
  const trimmedPlan = useMemo(() => (
    localFit ? fitDayToMinutes(activeDayData, localFit) : null
  ), [activeDayData, localFit]);
  const plannedMins = trimmedPlan?.trimmed
    ? trimmedPlan.durationMins
    : (activeDayData?.duration_mins ?? null);
  const fitChoices = useMemo(() => {
    const base = Number(activeDayData?.duration_mins ?? 0);
    const presets = [20, 30, 45, 60];
    const allowed = base > 0 ? presets.filter((m) => m < base) : [];
    // Preselect the user's saved session length when a sensible preset exists.
    if (allowed.length && sessionMins && allowed.includes(Number(sessionMins))) return allowed;
    return allowed;
  }, [activeDayData, sessionMins]);

  useEffect(() => {
    // Reset per-day fit choice; auto-apply the saved session minutes once.
    setLocalFit(sessionMins && Number(activeDayData?.duration_mins ?? 0) > sessionMins ? sessionMins : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayData?.day_number, activeDayData?.duration_mins]);

  const altList = useMemo(() => (
    altExName ? suggestAlternatives(altExName, prefs?.equipment ?? []) : []
  ), [altExName, prefs]);

  const muscleTags = useMemo(() => summarizeMuscles(activeDayData?.exercises), [activeDayData]);

  const activeExercises = trimmedPlan?.trimmed ? trimmedPlan.exercises : activeDayData?.exercises;

  // Day-cycling schedule: which weekday each plan day is suggested on.
  const daySchedule = useMemo(() => mapPlanSchedule(content, prefs?.preferredDays), [content, prefs]);
  const todayWeekday = new Date().getDay();

  // EMPTY STATE
  if (totalDays === 0) {
    return (
      <div
        className="fixed inset-0 z-[110] flex flex-col"
        style={{ background: 'var(--bg-primary)', animation: 'fadeIn 0.25s ease' }}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
        >
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon name="arrow_back" className="text-[length:var(--fs-18)]" />
            <span className="hidden min-[480px]:inline">Back to Plans</span>
          </button>
          <div className="text-center">
            <p className="text-[length:var(--fs-10)] uppercase font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {plan.title}
            </p>
          </div>
          <div className="w-8 sm:w-[88px]" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border"
            style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
          >
            <Icon name="hourglass_empty" className="text-[length:var(--fs-24)] sm:text-[length:var(--fs-28)]" style={{ color: 'var(--accent)' }} fill={1} />
          </div>
          <p className="text-base sm:text-lg font-black" style={{ color: 'var(--text-primary)' }}>Schedule coming soon</p>
          <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            "{plan.title}" doesn't have its daily content set up yet. Check back shortly.
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-lg font-bold text-sm"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (isDayComplete || completing) return;
    setCompleting(true);
    await onCompleteDay(activeDay);
    setCompleting(false);
    const nextDay = content.find(d => d.day_number > activeDay && !completedDays.includes(d.day_number));
    if (nextDay) setTimeout(() => setActiveDay(nextDay.day_number), 400);
  };

  const handleStartWorkout = () => {
    if (!activeDayData) return;
    navigate('/dashboard/workouts', {
      state: {
        fromPlan: {
          planId:       plan.id,
          planTitle:    plan.title,
          dayNumber:    activeDayData.day_number,
          dayTitle:     activeDayData.title,
          activityType: activeDayData.activity_type,
          description:  activeDayData.description,
          // Module 5: fit-to-minutes — the camera completion target follows
          // the trimmed session instead of the full plan day.
          durationMins: plannedMins ?? activeDayData.duration_mins,
        },
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col"
      style={{ background: 'var(--bg-primary)', animation: 'fadeIn 0.25s ease' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Icon name="arrow_back" className="text-[length:var(--fs-16)] sm:text-[length:var(--fs-18)]" />
          <span className="hidden min-[480px]:inline">Back to Plans</span>
        </button>
        <div className="text-center flex-1 px-2 min-w-0">
          <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase font-black tracking-widest truncate max-w-[140px] sm:max-w-none mx-auto" style={{ color: 'var(--text-muted)' }}>
            {plan.title}
          </p>
          <p className="text-[length:var(--fs-10)] sm:text-xs font-bold" style={{ color: 'var(--accent)' }}>
            {completedDays.length}/{totalDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden min-[480px]:block shrink-0">
            <p className="text-base sm:text-lg font-black" style={{ color: 'var(--accent)' }}>{progressPct}%</p>
            <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Progress</p>
          </div>
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle day list"
          >
            <Icon name="calendar_view_week" className="text-[length:var(--fs-18)]" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 sm:h-1 w-full flex-shrink-0" style={{ background: 'var(--border-light)' }}>
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%`, background: 'var(--accent)' }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile day list overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-20"
            style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-64 overflow-y-auto"
              style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Days</p>
                <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }}>
                  <Icon name="close" className="text-[length:var(--fs-18)]" />
                </button>
              </div>
              {content.map(day => {
                const done     = completedDays.includes(day.day_number);
                const isActive = day.day_number === activeDay;
                return (
                  <button
                    key={day.day_number}
                    onClick={() => { setActiveDay(day.day_number); setSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-l-2"
                    style={{
                      background:      isActive ? 'var(--bg-active)' : 'transparent',
                      borderLeftColor: isActive ? 'var(--accent)'    : 'transparent',
                      color:           isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <div
                      className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black"
                      style={{
                        background: done ? 'var(--accent)' : isActive ? 'var(--accent-bg)' : 'var(--bg-hover)',
                        color:      done ? 'var(--text-inverse)'       : isActive ? 'var(--accent)'    : 'var(--text-muted)',
                      }}
                    >
                      {done ? <Icon name="check" className="text-[length:var(--fs-14)]" weight={700} /> : day.day_number}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {day.title}
                      </p>
                      <p className="text-[length:var(--fs-10)]" style={{ color: 'var(--text-muted)' }}>
                        {day.duration_mins} mins
                        {(() => {
                          const s = daySchedule[day.day_number];
                          if (!s || s.isRest || !Number.isInteger(s.weekday)) return null;
                          const isToday = s.weekday === todayWeekday;
                          return (
                            <span style={{ color: isToday ? 'var(--accent)' : undefined, fontWeight: isToday ? 900 : undefined }}>
                            {' · '}{WEEKDAY_LETTERS[s.weekday]}{isToday ? ' · today' : ''}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop day list sidebar */}
        <div
          className="hidden md:flex w-20 lg:w-56 border-r overflow-y-auto flex-shrink-0 flex-col"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
        >
          {content.map(day => {
            const done     = completedDays.includes(day.day_number);
            const isActive = day.day_number === activeDay;
            return (
              <button
                key={day.day_number}
                onClick={() => setActiveDay(day.day_number)}
                className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 lg:py-3.5 text-left transition-all border-l-2"
                style={{
                  background:      isActive ? 'var(--bg-active)' : 'transparent',
                  borderLeftColor: isActive ? 'var(--accent)'    : 'transparent',
                  color:           isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <div
                  className="w-7 h-7 lg:w-8 lg:h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black"
                  style={{
                    background: done ? 'var(--accent)' : isActive ? 'var(--accent-bg)' : 'var(--bg-hover)',
                    color:      done ? 'var(--text-inverse)'       : isActive ? 'var(--accent)'    : 'var(--text-muted)',
                  }}
                >
                  {done ? <Icon name="check" className="text-[length:var(--fs-12)] lg:text-[length:var(--fs-14)]" weight={700} /> : day.day_number}
                </div>
                <div className="hidden lg:block overflow-hidden">
                  <p className="text-xs font-bold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {day.title}
                  </p>
                  <p className="text-[length:var(--fs-10)]" style={{ color: 'var(--text-muted)' }}>
                    {day.duration_mins} mins
                    {/* Module 5 — day-cycling schedule: suggested weekday */}
                    {(() => {
                      const s = daySchedule[day.day_number];
                      if (!s || s.isRest || !Number.isInteger(s.weekday)) return null;
                      const isToday = s.weekday === todayWeekday;
                      return (
                        <span style={{ color: isToday ? 'var(--accent)' : undefined, fontWeight: isToday ? 900 : undefined }}>
                          {' · '}{WEEKDAY_LETTERS[s.weekday]}{isToday ? ' · today' : ''}
                        </span>
                      );
                    })()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10">
          {activeDayData && (
            <div className="max-w-2xl mx-auto" key={activeDay} style={{ animation: 'slideUp 0.2s ease' }}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                  style={{ color: 'var(--accent)', background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
                >
                  Day {activeDayData.day_number}
                </span>
                <span
                  className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-bold uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                >
                  {activeDayData.activity_type}
                </span>
                {isDayComplete && (
                  <span
                    className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                    style={{ color: 'var(--success)', background: 'var(--success-bg)', borderColor: 'var(--success)' }}
                  >
                    ✓ Completed
                  </span>
                )}
                {/* Module 5 — day-cycling schedule chip */}
                {(() => {
                  const s = daySchedule[activeDayData.day_number];
                  if (!s || s.isRest || !Number.isInteger(s.weekday)) return null;
                  return (
                    <span
                      className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-bold uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                      style={{ color: s.weekday === todayWeekday ? 'var(--accent)' : 'var(--text-muted)', background: 'var(--bg-hover)' }}
                    >
                      {s.weekday === todayWeekday ? 'Scheduled today' : `Usually ${WEEKDAY_LETTERS[s.weekday]}`}
                    </span>
                  );
                })()}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4 leading-tight" style={{ color: 'var(--text-primary)' }}>
                {activeDayData.title}
              </h1>
              <p className="text-sm leading-relaxed mb-6 sm:mb-8" style={{ color: 'var(--text-muted)' }}>
                {activeDayData.description}
              </p>

              <div
                className="rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}
              >
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border flex-shrink-0"
                    style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
                  >
                    <Icon name="fitness_center" className="text-[length:var(--fs-18)] sm:text-[length:var(--fs-20)]" style={{ color: 'var(--accent)' }} fill={1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[length:var(--fs-10)] sm:text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Today's Session
                    </p>
                    <p className="text-xs sm:text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {activeDayData.activity_type}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                      {plannedMins ?? '–'}
                    </p>
                    <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>minutes</p>
                  </div>
                </div>

                {/* Module 5 — fit-to-minutes: user-declared capacity, never stored */}
                {!isRestDay && !isDayComplete && fitChoices.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>
                      Have less time?
                    </span>
                    <button
                      onClick={() => setLocalFit(0)}
                      className="px-2.5 h-8 rounded-lg text-[length:var(--fs-10)] font-black border cursor-pointer transition-all"
                      style={{
                        background: !localFit ? 'var(--accent)' : 'var(--bg-hover)',
                        borderColor: !localFit ? 'var(--accent)' : 'var(--border-light)',
                        color: !localFit ? 'var(--text-inverse)' : 'var(--text-muted)',
                      }}
                    >
                      Full · {activeDayData.duration_mins}m
                    </button>
                    {fitChoices.map((m) => (
                      <button
                        key={m}
                        onClick={() => setLocalFit(m)}
                        className="px-2.5 h-8 rounded-lg text-[length:var(--fs-10)] font-black border cursor-pointer transition-all"
                        style={{
                          background: localFit === m ? 'var(--accent)' : 'var(--bg-hover)',
                          borderColor: localFit === m ? 'var(--accent)' : 'var(--border-light)',
                          color: localFit === m ? 'var(--text-inverse)' : 'var(--text-muted)',
                        }}
                      >
                        {m}m
                      </button>
                    ))}
                    {trimmedPlan?.trimmed && (
                      <span className="w-full text-[length:var(--fs-9)] font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                        Fit to {trimmedPlan.durationMins} min — {trimmedPlan.exercises.length} of {activeDayData.exercises.length} exercises
                        {trimmedPlan.reduced ? ' · sets capped at 2' : ''}
                        {trimmedPlan.dropped ? ` · ${trimmedPlan.dropped} dropped` : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Module 5 — muscle-group tags for scheduling awareness */}
                {muscleTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>Focus:</span>
                    {muscleTags.map(({ tag, n }) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full text-[length:var(--fs-9)] font-black uppercase tracking-widest border"
                        style={{ color: 'var(--accent)', background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
                        {tag}{n > 1 ? ` ×${n}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-2 sm:space-y-3">
                  {activeExercises && activeExercises.length > 0 ? (
                    activeExercises.map((ex, idx) => {
                      const muscle = muscleFor(ex.name);
                      return (
                      <div
                        key={`${activeDayData.day_number}-${idx}`}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border"
                        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}
                      >
                        <span className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black w-5 sm:w-6 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <Icon name="fitness_center" className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-16)] flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill={1} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <span className="truncate">{ex.name}</span>
                            {muscle && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[length:var(--fs-8)] font-black uppercase tracking-widest"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                {muscle}
                              </span>
                            )}
                          </p>
                          <p className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] truncate" style={{ color: 'var(--text-muted)' }}>{formatExerciseDetail(ex)}</p>
                        </div>
                        {/* Module 5 — equipment-compatible alternatives (user's gear) */}
                        <button
                          onClick={() => setAltExName(ex.name)}
                          title={`Alternatives for ${ex.name}`}
                          aria-label={`Show alternatives for ${ex.name}`}
                          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--bg-active)]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Icon name="swap_horiz" className="text-[length:var(--fs-16)]" />
                        </button>
                      </div>
                      );
                    })
                  ) : (
                    <div
                      className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}
                    >
                      <Icon name="info" className="text-[length:var(--fs-16)] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-[length:var(--fs-11)]" style={{ color: 'var(--text-muted)' }}>
                        Exercise breakdown for this day hasn't been added yet — follow the description above for now.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col min-[480px]:flex-row gap-2 sm:gap-3">
                {!isDayComplete && (
                  <button
                    onClick={() => {
                      const next = content.find(d => d.day_number > activeDay);
                      if (next) setActiveDay(next.day_number);
                    }}
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
                    style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
                  >
                    <Icon name="skip_next" className="text-[length:var(--fs-18)] shrink-0" />
                    <span className="hidden min-[480px]:inline">Skip for Now</span>
                    <span className="min-[480px]:hidden">Skip</span>
                  </button>
                )}

                {isDayComplete ? (
                  <button
                    disabled
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2"
                    style={{
                      background: 'var(--success-bg)',
                      color:      'var(--success)',
                      border:     '1px solid var(--success)',
                      cursor:     'default',
                    }}
                  >
                    <Icon name="verified" className="text-[length:var(--fs-18)] shrink-0" fill={1} /> Day Complete
                  </button>
                ) : isRestDay ? (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: 'var(--text-inverse)', opacity: completing ? 0.7 : 1 }}
                  >
                    {completing ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><Icon name="check_circle" className="text-[length:var(--fs-18)] shrink-0" fill={1} /> Mark Complete</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleStartWorkout}
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
                  >
                    <Icon name="play_circle" className="text-[length:var(--fs-18)] shrink-0" fill={1} /> Start Workout
                  </button>
                )}
              </div>

              {!isDayComplete && (
                <p className="text-center text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] mt-3 sm:mt-4" style={{ color: 'var(--text-muted)' }}>
                  {isRestDay
                    ? `Complete this day to unlock Day ${activeDayData.day_number + 1}`
                    : `Finish your workout session to automatically unlock Day ${activeDayData.day_number + 1}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Module 5 — alternatives sheet: same muscle, user-compatible equipment */}
      {altExName && (
        <div
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
          onClick={() => setAltExName(null)}
          role="dialog" aria-modal="true" aria-label="Exercise alternatives"
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[85dvh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Swap in</p>
              <button onClick={() => setAltExName(null)} aria-label="Close alternatives" style={{ color: 'var(--text-muted)' }}>
                <Icon name="close" className="text-[length:var(--fs-18)]" />
              </button>
            </div>
            <h3 className="text-base font-black mb-1 truncate" style={{ color: 'var(--text-primary)' }}>{altExName}</h3>
            <p className="text-[length:var(--fs-10)] mb-4" style={{ color: 'var(--text-muted)' }}>
              Same muscle, matching your available equipment{prefs?.equipment?.length ? ` (${prefs.equipment.join(', ')})` : ' (bodyweight)'}.
            </p>
            {altList.length > 0 ? (
              <div className="flex flex-col gap-2">
                {altList.map((alt) => (
                  <div key={alt.slug} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{alt.name}</p>
                      <p className="text-[length:var(--fs-10)] truncate" style={{ color: 'var(--text-muted)' }}>
                        {alt.muscle} · {String(alt.equipment || '').replace(/_/g, ' ')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setAltExName(null);
                        navigate('/dashboard/workouts', { state: { exerciseId: alt.slug } });
                      }}
                      className="h-9 px-3 shrink-0 rounded-lg bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-9)] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No equipment-compatible substitute found</p>
                <p className="text-[length:var(--fs-10)] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Update preferences with your gear, or browse the Exercise library tab.
                </p>
              </div>
            )}
            <p className="text-[length:var(--fs-9)] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
              Swapping here starts the alternative directly — your plan stays unchanged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// MY PLANS TAB — real user data: enrolled templates + owned personal plans
const humanizeGoalType = (t) => String(t || 'Fitness').toLowerCase().split('_').map((w) => w.slice(0, 1).toUpperCase() + w.slice(1)).join(' ');

const GoalLinkBanner = ({ goalStatus, plans, onContinue, onGenerate, generating }) => {
  const { goal, linkedPlan } = goalStatus || {};
  if (!goal) return null;
  const label = humanizeGoalType(goal.goalType);
  const kcal = goal.dailyKcal != null ? `${Number(goal.dailyKcal).toLocaleString()} kcal/day` : null;
  const linked = linkedPlan ? plans.find((p) => String(p.id) === String(linkedPlan.id)) : null;
  if (linkedPlan && linked) {
    return (
      <div className="mb-4 sm:mb-6 rounded-2xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:px-4 sm:py-3 sm:gap-3" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
        <p className="text-[length:var(--fs-12)] font-bold flex-1 leading-relaxed break-words" style={{ color: 'var(--text-primary)' }}>
          Training for {label}{kcal ? ` · ${kcal}` : ''} — linked plan: {linked.title}
        </p>
        <button
          onClick={() => onContinue(linked)}
          className="h-11 min-h-[44px] px-4 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-11)] font-bold uppercase tracking-widest w-full sm:w-auto active:scale-95 transition-all"
        >
          Open plan
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4 sm:mb-6 rounded-2xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:px-4 sm:py-3 sm:gap-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}>
      <p className="text-[length:var(--fs-12)] font-bold flex-1 leading-relaxed break-words" style={{ color: 'var(--text-primary)' }}>
        Your {label} goal{kcal ? ` (${kcal})` : ''} has no training plan yet
        {linkedPlan ? ' — its plan was deleted' : ''}.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="h-11 min-h-[44px] px-4 rounded-xl border border-[var(--border-medium)] text-[length:var(--fs-11)] font-bold uppercase tracking-widest w-full sm:w-auto disabled:opacity-40"
        style={{ color: 'var(--text-primary)' }}
      >
        {generating ? 'Generating…' : 'Generate from my goal'}
      </button>
    </div>
  );
};

const MyPlans = ({ plans, goalStatus, onOpen, onContinue, onCreateClick, onGenerate, onDelete, onEdit, generating, prefs, onOpenPrefs }) => {
  const enrolled = plans.filter(p => p.is_enrolled === 1 || p.is_owner === 1);
  if (enrolled.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-28 gap-4 text-center" style={{ animation: 'fadeIn 0.3s ease' }}>
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-2 border"
          style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
        >
          <Icon name="fitness_center" className="text-[length:var(--fs-28)] sm:text-[length:var(--fs-36)]" style={{ color: 'var(--accent)' }} fill={1} />
        </div>
        <h3 className="text-lg sm:text-xl font-black" style={{ color: 'var(--text-primary)' }}>No plans yet</h3>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Create your own plan, generate one from your goal, or head to{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Explore</span> to enroll in a blueprint.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <button
            onClick={onCreateClick}
            className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            Create personal plan
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="h-10 px-5 rounded-full border border-[var(--border-medium)] text-[length:var(--fs-12)] font-bold disabled:opacity-40"
            style={{ color: 'var(--text-primary)' }}
          >
            {generating ? 'Generating…' : 'Generate from my goal'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <GoalLinkBanner goalStatus={goalStatus} plans={plans} onContinue={onContinue} onGenerate={onGenerate} generating={generating} />
      {/* Module 5 — training preferences: schedule + duration + alternatives inputs. */}
      <div
        className="mb-4 rounded-2xl border px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}
      >
        <p className="text-[length:var(--fs-11)] font-bold flex-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {prefs && (prefs.equipment?.length || prefs.preferredDays?.length || prefs.sessionDurationMins)
            ? prefs.equipment?.length > 0
              ? prefs.equipment.join(' · ')
              : 'Bodyweight · '
            : 'No training preferences yet — '}
          {prefs && prefs.equipment?.length ? `${prefs.preferredDays?.length ?? 0} day${(prefs.preferredDays?.length ?? 0) !== 1 ? 's' : ''}/week · ` : ''}
          {prefs?.sessionDurationMins ? `${prefs.sessionDurationMins} min sessions · ` : ''}
          {prefs && (prefs.equipment?.length || prefs.sessionDurationMins) ? 'used for scheduling, alternatives & plan fit.' : 'recommendations use them to fit your time and equipment.'}
        </p>
        <button
          onClick={onOpenPrefs}
          className="h-10 shrink-0 px-4 rounded-xl border text-[length:var(--fs-10)] font-black uppercase tracking-widest transition-all hover:border-[var(--accent-border)]"
          style={{ borderColor: 'var(--border-medium)', color: 'var(--text-primary)', background: 'var(--bg-hover)' }}
        >
          {prefs && prefs.sessionDurationMins ? 'Edit' : 'Set preferences'}
        </button>
      </div>
      {(() => {
        const active      = enrolled[0];
        const progressPct = active.progress_pct ?? 0;
        const isLinked = goalStatus?.linkedPlan && String(active.id) === String(goalStatus.linkedPlan.id);
        return (
          <div
            className="mb-6 sm:mb-10 rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group glass-panel"
            style={{ borderColor: 'var(--accent-border)' }}
            onClick={() => onOpen(active)}
          >
            <div className="relative overflow-hidden" style={{ background: 'var(--bg-card)' }}>
              <div className="absolute inset-0">
                <PlanCover seed={active.image_seed} title={active.title} className="group-hover:scale-105 transition-transform duration-700" opacity={0.2} />
              </div>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to right, var(--bg-card) 30%, transparent 100%)' }}
              />
              <div className="relative flex flex-col min-[560px]:flex-row min-[560px]:items-center gap-3 px-4 sm:px-8 py-4 sm:py-6">
                <div className="flex-1 min-w-0">
                  <span className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                    Currently Active{isLinked ? ' · Goal-linked' : active.is_owner === 1 ? ' · Yours' : ''}
                  </span>
                  <h2 className="text-[length:var(--fs-17)] leading-snug sm:text-2xl font-black mt-0.5 mb-2 break-words line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {active.title}
                  </h2>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 h-2 sm:h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-medium)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%`, background: 'var(--accent)' }}
                      />
                    </div>
                    <span className="text-xs font-black tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
                      {progressPct}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 shrink-0 w-full min-[560px]:w-auto min-[560px]:flex min-[560px]:items-center">
                  <button
                    onClick={e => { e.stopPropagation(); onContinue(active); }}
                    className="col-span-2 min-[560px]:col-span-1 px-5 py-3 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase active:scale-95 transition-all"
                    style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
                  >
                    Continue →
                  </button>
                  {active.is_owner === 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); onEdit?.(active); }}
                      aria-label={`Edit plan: ${active.title}`}
                      className="px-4 py-3 min-h-[48px] rounded-xl text-[length:var(--fs-11)] font-bold uppercase border"
                      style={{ borderColor: 'var(--border-medium)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                    >
                      Edit
                    </button>
                  )}
                  {active.is_owner === 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); onDelete?.(active); }}
                      aria-label={`Delete plan: ${active.title}`}
                      className="px-4 py-3 min-h-[48px] rounded-xl text-[length:var(--fs-11)] font-bold uppercase border"
                      style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)', background: 'var(--bg-primary)' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {enrolled.length > 1 && (
        <>
          <p className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-black uppercase tracking-widest mb-3 sm:mb-4" style={{ color: 'var(--text-muted)' }}>
            All Enrolled Plans
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
            {enrolled.slice(1).map((plan, i) => (
              <div key={plan.id} className="min-w-0 h-full">
                <PlanCard
                  plan={plan} onOpen={onOpen} onEnroll={() => {}} onContinue={onContinue}
                  style={{ animation: `slideUp 0.3s ease ${i * 0.06}s both` }}
                />
                {plan.is_owner === 1 && (
                  <span className="mt-1.5 flex gap-3">
                    <button
                      onClick={() => onEdit?.(plan)}
                      aria-label={`Edit plan: ${plan.title}`}
                      className="text-[length:var(--fs-11)] font-bold uppercase tracking-widest hover:underline"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete?.(plan)}
                      aria-label={`Delete plan: ${plan.title}`}
                      className="text-[length:var(--fs-11)] font-bold uppercase tracking-widest hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Delete mine
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// FIND PLANS TAB WITH FILTERS


const FindPlan = ({ plans, onOpen, onEnroll, onContinue }) => {
  const [query,     setQuery]     = useState('');
  const [intensity, setIntensity] = useState('All');
  const [focus,     setFocus]     = useState('All');
  const [duration,  setDuration]  = useState('All');

  const filtered = useMemo(() => plans.filter(p => {
    const q = query.toLowerCase();
    return (
      (!q || p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.tag?.toLowerCase().includes(q)) &&
      (intensity === 'All' || p.intensity === intensity) &&
      (focus     === 'All' || p.target_focus?.toLowerCase().includes(focus.toLowerCase())) &&
      (duration  === 'All' || p.duration === duration)
    );
  }), [plans, query, intensity, focus, duration]);

  const clearAll = () => { setQuery(''); setIntensity('All'); setFocus('All'); setDuration('All'); };
  const hasFilters = query || intensity !== 'All' || focus !== 'All' || duration !== 'All';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="relative mb-4 sm:mb-6">
        <Icon name="search" className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[length:var(--fs-18)] sm:text-[length:var(--fs-20)]" style={{ color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search blueprints..."
          className="w-full rounded-xl pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-sm outline-none border border-[var(--border-medium)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon name="close" className="text-[length:var(--fs-18)]" />
          </button>
        )}
      </div>
      <div className="rounded-xl p-3 sm:p-5 mb-6 sm:mb-8 space-y-3 sm:space-y-4 border glass-card" style={{ borderColor: 'var(--border-light)' }}>
        {[
          { label: 'Intensity', opts: INTENSITY_OPTIONS, active: intensity, set: setIntensity },
          { label: 'Focus Area', opts: FOCUS_OPTIONS,    active: focus,     set: setFocus     },
          { label: 'Duration',  opts: DURATION_OPTIONS,  active: duration,  set: setDuration  },
        ].map(({ label, opts, active, set }) => (
          <div key={label}>
            <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <FilterPill options={opts} active={active} onSelect={set} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{filtered.length}</span>{' '}
          blueprint{filtered.length !== 1 ? 's' : ''} found
        </p>
        {hasFilters && (
          <button onClick={clearAll} className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-bold uppercase tracking-widest hover:underline" style={{ color: 'var(--accent)' }}>
            Clear All
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 sm:py-20 gap-3 text-center">
          <Icon name="search_off" className="text-[length:var(--fs-40)] sm:text-[length:var(--fs-48)]" style={{ color: 'var(--border-medium)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No blueprints match your filters.</p>
          <button onClick={clearAll} className="text-sm font-bold hover:underline" style={{ color: 'var(--accent)' }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {filtered.map((plan, i) => (
            <PlanCard
              key={plan.id} plan={plan} onOpen={onOpen} onEnroll={onEnroll} onContinue={onContinue}
              style={{ animation: `slideUp 0.3s ease ${i * 0.05}s both` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};



const Explore = ({ plans, onOpen, onEnroll, onContinue }) => {
  const [activeCategory, setActiveCategory] = useState(null);
  const featured  = plans.slice(0, 2);
  const displayed = activeCategory ? plans.filter(p => p.tag === activeCategory) : plans;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {featured.length > 0 && (
        <div className="mb-6 sm:mb-10">
          <p className="text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-black uppercase tracking-widest mb-3 sm:mb-4" style={{ color: 'var(--text-muted)' }}>
            Featured Blueprints
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {featured.map((plan, i) => (
              <div
                key={plan.id}
                role="button"
                tabIndex={0}
                aria-label={`Open plan: ${plan.title}`}
                className="relative overflow-hidden rounded-2xl cursor-pointer group border transition-all duration-500"
                style={{ borderColor: 'var(--border-light)', animation: `slideUp 0.4s ease ${i * 0.1}s both` }}
                onClick={() => onOpen(plan)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(plan); } }}
              >
                <div className="aspect-[16/10] sm:aspect-[21/9] overflow-hidden">
                  <PlanCover seed={plan.image_seed} title={plan.title} className="group-hover:scale-105 transition-transform duration-700" opacity={0.3} />
                </div>
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, var(--bg-card) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 min-w-0">
                  <div className="flex gap-2 mb-1.5 sm:mb-2">
                    <span className="px-2 py-0.5 rounded text-[length:var(--fs-9)] font-black tracking-widest uppercase" style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
                      {plan.tag}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[length:var(--fs-9)] font-bold tracking-widest uppercase" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', backdropFilter: 'blur(4px)' }}>
                      {plan.intensity}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black" style={{ color: 'var(--text-primary)' }}>{plan.title}</h3>
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
                </div>
                {plan.is_enrolled === 1 && (
                  <div
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 py-1 rounded text-[length:var(--fs-9)] font-black tracking-widest uppercase"
                    style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
                  >
                    Owned
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-6 sm:mb-8" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(cat.tag)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[length:var(--fs-10)] sm:text-xs font-bold uppercase tracking-widest flex-shrink-0 transition-all border"
            style={{
              background:  activeCategory === cat.tag ? 'var(--accent)'     : 'var(--bg-tertiary)',
              color:       activeCategory === cat.tag ? 'var(--text-inverse)'           : 'var(--text-muted)',
              borderColor: activeCategory === cat.tag ? 'var(--accent)'     : 'var(--border-light)',
            }}
          >
            <Icon name={cat.icon} className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-16)]" fill={activeCategory === cat.tag ? 1 : 0} />
            {cat.label}
          </button>
        ))}
      </div>
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center py-16 sm:py-20 gap-3 text-center">
          <Icon name="category" className="text-[length:var(--fs-40)] sm:text-[length:var(--fs-48)]" style={{ color: 'var(--border-medium)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No blueprints in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {displayed.map((plan, i) => (
            <PlanCard
              key={plan.id} plan={plan} onOpen={onOpen} onEnroll={onEnroll} onContinue={onContinue}
              style={{ animation: `slideUp 0.3s ease ${i * 0.05}s both` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};



// MAIN PLANS PAGE COMPONENT
const Plans = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'explore'
  );

  const {
    loading, authError, actionError, actionOk, acting, reload, trainingPlans, enrolledCount, goalStatus,
    detailPlan, trackerPlan, trackerContent, trackerProgress,
    setDetailPlan, setActionError, setActionOk, handleEnroll, createPersonal, updatePersonal, autoFromGoal, removePersonal, startTracker, handleCompleteDay, closeTracker,
  } = usePlans();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  // Module 5 — preferences + adaptive tips (silent on failure).
  const prefsCtl = useTrainingPrefs();
  const insightsCtl = useTrainingInsights();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const openCreate = () => { setActionError(null); setActionOk(null); setEditingPlan(null); setSheetOpen(true); };
  const openEdit = (plan) => {
    if (!plan || plan.is_owner !== 1) return;
    setActionError(null); setActionOk(null); setEditingPlan(plan); setSheetOpen(true);
  };
  const closeSheet = () => { setSheetOpen(false); setEditingPlan(null); };

  // Module 5 — save training preferences, then surface server feedback via the
  // page's normal action banner (same pattern as create/edit).
  const handleSavePrefs = async (body) => {
    try {
      const saved = await prefsCtl.save(body);
      setActionError(null);
      setActionOk('Training preferences saved — recommendations now respect your equipment, days and session length.');
      return saved ?? {};
    } catch (e) {
      setActionOk(null);
      setActionError(e.message || 'Could not save training preferences');
      return null;
    }
  };

  // Module 5 — one-click Apply of an adaptive tip (mode 'shorter' | 'gentle').
  const handleApplyTip = async (mode) => {
    const msg = await insightsCtl.apply(mode);
    if (msg) {
      setActionError(null);
      setActionOk(msg);
      await reload();
      await insightsCtl.reload();
    } else {
      setActionOk(null);
      setActionError('Could not adjust the plan — is a plan linked to your active goal?');
    }
    return null;
  };

  const handleSaveEdit = async (planId, patch) => {
    const saved = await updatePersonal(planId, patch);
    if (saved) closeSheet();
    return saved;
  };

  // Mount-only URL cleanup; reacting to searchParams identity would re-run on every navigation.
  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get('mine') === '1') {
      setActiveTab('my-plans');
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-shot deep-link: openTracker navigation opens the tracker once. startTracker
  // is intentionally excluded — it is re-created per render and would re-trigger this.
  useEffect(() => {
    const openTrackerId = location.state?.openTracker;
    if (!openTrackerId || loading || trainingPlans.length === 0) return;
    const plan = trainingPlans.find(p => String(p.id) === String(openTrackerId));
    if (plan) {
      setActiveTab('my-plans');
      startTracker(plan);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.openTracker, trainingPlans, loading]);

  const requestedPlanId = searchParams.get('planId');
  const autoOpenedRef   = useRef(false);
  useEffect(() => {
    if (!requestedPlanId || autoOpenedRef.current || loading) return;
    const match = trainingPlans.find(p => String(p.id) === String(requestedPlanId));
    if (match) {
      setDetailPlan(match);
      autoOpenedRef.current = true;
      setSearchParams({}, { replace: true });
    }
  }, [requestedPlanId, trainingPlans, loading, setDetailPlan, setSearchParams]);

  const handleEnrollAndSwitch = async (planId) => {
    await handleEnroll(planId);
    setActiveTab('my-plans');
  };

  const handleGenerateAndSwitch = async () => {
    const data = await autoFromGoal();
    if (data?.planId) setActiveTab('my-plans');
  };

  const handleDelete = async (plan) => {
    if (!plan || plan.is_owner !== 1) return;
    if (!window.confirm(`Delete "${plan.title}"? This removes its days and progress.`)) return;
    await removePersonal(plan.id);
  };

  return (
    <AppShell mobileTitle="Plans" bottomNav={<BottomNav variant="biometrics" />}>
        <div className="min-w-0">
          <PageHeader
            eyebrow="Training Store"
            title={<>Performance <em>Blueprints</em></>}
            description="Enroll in a program, build your own split, or open the exercise library."
            actions={(
              <>
                {enrolledCount > 0 && (
                  <div className="flex items-center gap-2 rounded-full px-4 py-2.5 border" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
                    <Icon name="trophy" className="text-[length:var(--fs-18)] shrink-0" style={{ color: 'var(--accent)' }} fill={1} />
                    <span className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                      {enrolledCount} plan{enrolledCount !== 1 ? 's' : ''} active
                    </span>
                  </div>
                )}
                {/* Module 5 — training preferences (equipment/days/minutes). */}
                <button
                  onClick={() => setPrefsOpen(true)}
                  title="Training preferences — equipment, training days, session minutes"
                  className="flex items-center gap-1.5 h-10 px-4 rounded-full border text-[length:var(--fs-11)] font-bold uppercase tracking-widest transition-all hover:border-[var(--accent-border)]"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                >
                  <Icon name="tune" className="text-[length:var(--fs-16)]" />
                  <span className="hidden sm:inline">Preferences</span>
                </button>
                <button onClick={openCreate} className="app-btn app-btn--primary">
                  + New plan
                </button>
              </>
            )}
          />

          <TabBar active={activeTab} onChange={setActiveTab} enrolledCount={enrolledCount} />

          {actionError ? (
            <p role="alert" className="mb-4 rounded-xl border border-[var(--border-medium)] bg-[var(--error-bg)] px-4 py-2.5 text-[length:var(--fs-12)] font-semibold text-[var(--error)]">{actionError}</p>
          ) : null}
          {actionOk ? (
            <p role="status" className="mb-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-4 py-2.5 text-[length:var(--fs-12)] font-semibold" style={{ color: 'var(--accent)' }}>{actionOk}</p>
          ) : null}

          {loading ? (
            <div className="py-16 sm:py-20 text-center animate-pulse text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Synchronizing Blueprints...
            </div>
          ) : authError ? (
            <div className="flex flex-col items-center py-16 sm:py-20 gap-3 text-center" role="alert">
              <Icon name="error" className="text-[length:var(--fs-36)] sm:text-[length:var(--fs-40)]" style={{ color: 'var(--error)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Couldn't load your blueprints</p>
              <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>{authError}</p>
              <button onClick={reload} className="mt-1 h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold hover:brightness-110 active:scale-95 transition-all">
                Try again
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'my-plans' && (
                <>
                  <AdaptiveTipsCard
                    tips={insightsCtl.tips}
                    loading={insightsCtl.loading}
                    applying={insightsCtl.applying}
                    onApply={handleApplyTip}
                  />
                  <MyPlans
                    plans={trainingPlans}
                    goalStatus={goalStatus}
                    onOpen={setDetailPlan}
                    onContinue={startTracker}
                    onCreateClick={openCreate}
                    onGenerate={handleGenerateAndSwitch}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                    generating={acting}
                    prefs={prefsCtl.prefs}
                    onOpenPrefs={() => setPrefsOpen(true)}
                  />
                </>
              )}
              {activeTab === 'find'     && <FindPlan plans={trainingPlans} onOpen={setDetailPlan} onEnroll={handleEnrollAndSwitch} onContinue={startTracker} />}
              {activeTab === 'explore'  && <Explore  plans={trainingPlans} onOpen={setDetailPlan} onEnroll={handleEnrollAndSwitch} onContinue={startTracker} />}
              {activeTab === 'library'  && <ExerciseLibrary />}
              {activeTab === 'history'  && <WorkoutHistory />}
            </>
          )}
        </div>

      {detailPlan && (
        <PlanDetailOverlay
          plan={detailPlan}
          onClose={() => setDetailPlan(null)}
          onStart={() => {
            if (detailPlan.is_enrolled === 1) {
              startTracker(detailPlan);
            } else {
              handleEnrollAndSwitch(detailPlan.id);
              setDetailPlan(null);
            }
          }}
        />
      )}

      {trackerPlan && (
        <DayTracker
          plan={trackerPlan}
          content={trackerContent}
          progress={trackerProgress}
          onClose={closeTracker}
          onCompleteDay={handleCompleteDay}
          prefs={prefsCtl.prefs}
        />
      )}

      {/* Module 5 — training preferences editor (equipment/days/minutes/local). */}
      <TrainingPrefsSheet
        key={prefsOpen ? 'prefs-open' : 'prefs-closed'}
        open={prefsOpen}
        preferences={prefsCtl.prefs}
        options={prefsCtl.options}
        onClose={() => setPrefsOpen(false)}
        onSave={handleSavePrefs}
      />

      <PersonalPlanSheet
        key={editingPlan ? `edit-${editingPlan.id}` : (sheetOpen ? 'open' : 'closed')}
        open={sheetOpen}
        onClose={closeSheet}
        acting={acting}
        error={actionError}
        onCreate={createPersonal}
        onGenerate={autoFromGoal}
        initial={editingPlan}
        onSave={handleSaveEdit}
      />

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        input::placeholder { color: var(--text-muted); opacity: 1; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </AppShell>
  );
};

export default Plans;