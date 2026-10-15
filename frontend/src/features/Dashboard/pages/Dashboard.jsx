import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { Sidebar, Topbar, BottomNav, FAB } from '../../../components/index.js';
import FeedbackModal from '../../../components/FeedbackModal.jsx';
import { useActivityLogger } from '../hooks/useActivityLogger.js';
import { useDashboardData }  from '../hooks/useDashboardData.js';
import { useActiveGoal } from '../../Onboarding/hooks/useActiveGoal.js';
import { useTodayMeals } from '../hooks/useTodayMeals.js';
import { goalLabel } from '../../Onboarding/constants/goals.js';
import CheckInModal from '../components/CheckInModal.jsx';
import QuickLog from '../components/QuickLog.jsx';
import GoalDetailSheet from '../components/GoalDetailSheet.jsx';
import { apiFetch } from '../../../lib/apiClient.js';
import { safeGet } from '../../../lib/storage.js';
import { useUnits } from '../../../hooks/useUnits.js';
import { formatWeight } from '../../../lib/units.js';
import ErrorState from '../../../components/feedback/ErrorState.jsx';

// Dashboard follows the app 2-color theme (white + deep green) via CSS vars,
// so light and dark mode both render correctly. All icons use the accent.
const LiveDateTime = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const s = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return <span className="text-[12px] font-medium text-[var(--text-muted)]">{s} • {t}</span>;
};

// Calorie ring: gray track + remaining arc + food tip.
const CaloriesRing = ({ remaining, goal, food, size = 112, stroke = 10 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clampedRemaining = Math.max(0, Math.min(goal || 1, remaining));
  const pctRemaining = goal ? (clampedRemaining / goal) * 100 : 0;
  const pctFood = goal ? Math.min(100, (food / goal) * 100) : 0;
  const blueDash = (pctRemaining / 100) * c;
  const orangeDash = (pctFood / 100) * c * 0.22; // small orange tip like MFP
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-light)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${blueDash} ${c - blueDash}`} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${orangeDash} ${c - orangeDash}`} className="opacity-45" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-black text-[26px] tracking-tighter text-[var(--text-primary)]">{remaining.toLocaleString()}</span>
        <span className="text-[11px] font-bold text-[var(--text-muted)] mt-0.5">Remaining</span>
      </div>
    </div>
  );
};

const MiniCard = ({ title, icon, value, sub, progress, onClick, actionIcon }) => (
  <button onClick={onClick} className="text-left glass-card border border-[var(--border-light)] rounded-[16px] p-4 hover:shadow-[0_4px_16px_rgba(46,82,51,0.12)] transition-all w-full min-w-0">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] truncate">{title}</p>
      {actionIcon && <span className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center -mt-1 shrink-0"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">{actionIcon}</span></span>}
    </div>
    <div className="flex items-center gap-2 mt-1.5 min-w-0">
      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-[var(--accent-border)] bg-[var(--bg-card)]">
        <span className="material-symbols-outlined text-[16px] text-[var(--accent)]">{icon}</span>
      </span>
      <span className="text-[20px] font-black tracking-tight text-[var(--text-primary)] truncate">{value}</span>
    </div>
    <p className="text-[12px] text-[var(--text-muted)] mt-1 truncate">{sub}</p>
    <div className="h-1.5 bg-[var(--bg-hover)] rounded-full mt-2.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500 bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.round(progress))}%` }} />
    </div>
  </button>
);

// 7-day strip: today is the filled pill.
const WeekStrip = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const isToday = (d) => d.toDateString() === today.toDateString();
  return (
    <div className="flex items-center gap-1 mt-3 px-1 overflow-x-auto no-scrollbar" role="list" aria-label="This week">
      {days.map((d) => (
        <div
          key={d.toISOString()}
          role="listitem"
          aria-current={isToday(d) ? 'date' : undefined}
          className={`flex flex-col items-center gap-1 py-2 px-2.5 rounded-full min-w-[40px] flex-1 outline-none shadow-none ${
            isToday(d)
              ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border border-transparent'
              : 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--accent-border)]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase opacity-80">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
          <span className="text-[13px] font-black">{d.getDate()}</span>
          <span className={`w-1 h-1 rounded-full ${isToday(d) ? 'bg-[var(--text-inverse)]' : 'bg-[var(--accent-bg)]'}`} />
        </div>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const USER_ID = user?.id || null;
  const handleLogout = async () => { await logout(); navigate('/login'); };
  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);
  const [nutrientGoals, setNutrientGoals] = useState([]);
  const [heroPage, setHeroPage] = useState(0);
  const heroRef = useRef(null);
  // Dots only make sense with something to page through — count the actual
  // rendered slides so a single-slide hero never shows a lone dot.
  const [heroSlideCount, setHeroSlideCount] = useState(0);
  // Mount-time DOM measurement (runs once): refs don't re-render on their own.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHeroSlideCount(heroRef.current?.childElementCount ?? 0); }, []);
  const onHeroScroll = () => {
    const el = heroRef.current;
    if (!el || el.clientWidth === 0) return;
    setHeroPage(Math.min(3, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const goHero = (i) => {
    const el = heroRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  const { data, biometrics, workouts, dashboardError, setData, setBiometrics, setAuthOverride, mergeData, refresh: refreshDashboard, generateClinicalInsight } = useDashboardData(USER_ID);
  const { goal, currentWeightKg, progressPct, refresh: refreshGoal } = useActiveGoal(USER_ID);
  const units = useUnits();
  const fmtW = (v) => (v == null || v === '—' ? '—' : formatWeight(Number(v), units));
  const { meals, refreshMeals } = useTodayMeals(USER_ID);
  useEffect(() => { if (!user) return; setAuthOverride(user.name || null, user.avatar || null); }, [user, setAuthOverride]);
  const { handleLogActivity } = useActivityLogger(USER_ID, { setData, setBiometrics, biometrics, mergeData, generateClinicalInsight });
  const steps = data.stats?.steps || 0;
  // Real step target from Preferences (cached on save/load) — was hardcoded 10,000.
  const stepGoalTarget = Number(safeGet('vitalis:stepGoal', '10000')) || 10000;
  const caloriesBurned = data.stats?.calories_burned || 0;
  const workoutMins = data.stats?.workout_duration_mins || 0;
  const checkin = data.checkin || null;
  const tKcal = goal?.dailyKcal ?? 1500;
  const foodKcal = meals.kcal || 0;
  const remaining = Math.max(0, tKcal - foodKcal + caloriesBurned);
  const onCheckInSaved = () => { refreshDashboard(); refreshMeals(); };
  // Refetch when returning from other pages (MealTracker, etc.)
  useEffect(() => {
    const onFocus = () => { refreshDashboard(); refreshMeals(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [refreshDashboard, refreshMeals]);

  const [todayPlans, setTodayPlans] = useState([]);
  const [todayPlansLoading, setTodayPlansLoading] = useState(true);
  useEffect(() => {
    if (!USER_ID) return;
    let cancelled = false;
    apiFetch(`/api/plans/${USER_ID}`)
      .then((d) => {
        if (cancelled) return;
        const enrolled = Array.isArray(d) ? d.filter((p) => p.is_enrolled === 1) : [];
        setTodayPlans(enrolled.slice(0, 2));
      })
      .catch(() => { if (!cancelled) setTodayPlans([]); })
      .finally(() => { if (!cancelled) setTodayPlansLoading(false); });
    return () => { cancelled = true; };
  }, [USER_ID]);
  const refreshNutrients = async () => {
    if (!USER_ID) return;
    try {
      const d = await apiFetch(`/api/nutrient-goals/${USER_ID}`);
      setNutrientGoals(d.goals||[]);
    } catch {
      setNutrientGoals([]);
    }
  };
  const nutrientActive = (k) => nutrientGoals.some(g=>g.nutrient===k);
  const nutrientTarget = (k, fallback) => {
    const f = nutrientGoals.find(g=>g.nutrient===k);
    return f?.target_value != null ? Number(f.target_value) : fallback;
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refreshNutrients(); }, [USER_ID]); // eslint-disable-line react-hooks/exhaustive-deps
  const onboardingSkipped = useMemo(() => safeGet('vitalis:onboarding') === 'skipped', []);
  const showOnboardingBanner = user?.onboardingCompleted === false && !onboardingSkipped;
  if (loading) return null;
  if (!USER_ID) return null;
  const hrs = Math.floor(workoutMins / 60);
  const mins = workoutMins % 60;

  // Today's sessions, local-day match. Cancelled sessions never count.
  const isTodayLog = (l) => {
    const d = new Date(l.start_time);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const todayWorkouts = (workouts || []).filter((l) => l.status !== 'cancelled' && isTodayLog(l));
  const workoutSecsToday = todayWorkouts.reduce((s, l) => s + (Number(l.duration_seconds) || 0), 0);
  const workoutMinToday = Math.floor(workoutSecsToday / 60);
  const workoutGoalMin = goal?.goalType === 'BUILD_MUSCLE' || goal?.goalType === 'PERFORMANCE' ? 60
    : goal?.goalType === 'LOSE_WEIGHT' || goal?.goalType === 'GAIN_WEIGHT' ? 45 : 30;
  // Empty-state gates: bare zeros read as broken data, so cards with no
  // intake/activity yet show an em dash plus a next-step hint instead.
  const hasMeals = (meals.kcal || 0) > 0 || (meals.protein || 0) > 0 || (meals.carbs || 0) > 0;
  const hasActivity = steps > 0 || caloriesBurned > 0 || workoutMinToday > 0;
  const workoutLabel = (t) => {
    const s = String(t || 'general').replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const fmtDur = (sec) => {
    const s = Number(sec) || 0;
    if (s < 60) return `${s}s`;
    return `${Math.round(s / 60)} min`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-x-hidden">
      <div className="hidden md:block"><Sidebar onClick={handleLogout} expanded={sidebarExpanded} setExpanded={setSidebarExpanded} onFeedback={() => setFeedbackOpen(true)} /></div>
      <Topbar sidebarExpanded={sidebarExpanded} userId={USER_ID} />
      <main className={`pt-[56px] pb-20 md:pb-6 transition-all duration-300 ${sidebarExpanded ? 'md:ml-[240px]' : 'md:ml-[72px] ml-0'}`}>
        <div className="max-w-[420px] mx-auto w-full px-3 pt-4 pb-6 md:max-w-3xl md:px-6 lg:max-w-5xl xl:max-w-6xl relative">
          <div className="glass-content">
          {/* Header */}
          {dashboardError && (            <div className="mt-3">
              <ErrorState message={dashboardError.message || 'Could not load your dashboard.'} onRetry={() => { refreshDashboard(); refreshMeals(); refreshNutrients(); }} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-black tracking-tight text-[var(--text-primary)]">Today</h1>
          </div>
          <div className="mt-1"><LiveDateTime /></div>

          {/* Complete-profile prompt — only while setup isn't finished */}
          {showOnboardingBanner && (
            <div className="mt-4 p-4 rounded-[16px] glass-panel border border-[var(--accent-border)] flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[var(--accent-solid)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-[var(--accent-solid-fg)]">person_add</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-[var(--text-primary)]">Complete your profile</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Finish your goal and body profile to unlock personalized targets — about 1 min.</p>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="shrink-0 w-full min-[420px]:w-auto px-4 py-2.5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-black whitespace-nowrap hover:brightness-105 active:scale-95 transition-all"
              >
                Complete Profile
              </button>
            </div>
          )}

          {/* Hero carousel: Calories / Macros / Activity / Recovery */}
          <div className="mt-4 glass-panel rounded-[16px] border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
            <div
              ref={heroRef}
              onScroll={onHeroScroll}
              className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden no-scrollbar"
            >
              <div className="min-w-full snap-center px-4 py-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[18px] font-black text-[var(--text-primary)] leading-none">Calories</p>
                    <p className="text-[12px] text-[var(--text-muted)] mt-1">Goal − food + exercise</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 mt-4 min-w-0">
                  <CaloriesRing remaining={remaining} goal={tKcal} food={foodKcal} />
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] dark:bg-[var(--bg-hover)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">flag</span></span>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-[13px] text-[var(--text-muted)]">Base Goal</span>
                        <span className="text-[15px] font-black text-[var(--text-primary)]">{tKcal.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">restaurant</span></span>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-[13px] text-[var(--text-muted)]">Food</span>
                        <span className="text-[15px] font-black text-[var(--text-primary)]">{foodKcal.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">local_fire_department</span></span>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-[13px] text-[var(--text-muted)]">Exercise</span>
                        <span className="text-[15px] font-black text-[var(--text-primary)]">{caloriesBurned.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="min-w-full snap-center p-4 sm:p-5">
                <p className="text-[18px] font-black text-[var(--text-primary)] leading-none">Macros</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">Today&apos;s intake</p>
                <div className="mt-4 space-y-3.5">
                  {[
                    { label: 'Protein', actual: meals.protein, target: goal?.proteinG ?? 50, unit: 'g', color: 'var(--accent)' },
                    { label: 'Carbs', actual: meals.carbs, target: goal?.carbsG ?? 275, unit: 'g', color: 'var(--accent)' },
                    { label: 'Fat', actual: meals.fat, target: goal?.fatG ?? 78, unit: 'g', color: 'var(--accent)' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[var(--text-muted)]">{m.label}</span>
                        <span className="font-black text-[var(--text-primary)]">{m.actual}{m.unit} <span className="font-bold text-[var(--text-muted)]">/ {m.target}{m.unit}</span></span>
                      </div>
                      <div className="h-2 bg-[var(--bg-hover)] rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.target ? Math.min(100, (m.actual / m.target) * 100) : 0}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-full snap-center p-4 sm:p-5">
                <p className="text-[18px] font-black text-[var(--text-primary)] leading-none">Activity</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">Workouts and rest today</p>
                {goal && (
                  <p className="text-[12px] font-bold text-[var(--accent)] mt-1.5 truncate">
                    {goalLabel(goal.goalType)}{goal.targetWeightKg != null ? ` · ${fmtW(currentWeightKg ?? goal.weightKg)} → ${fmtW(goal.targetWeightKg)}` : ''}
                  </p>
                )}
                <div className="mt-4 space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-muted)]">Workout</span>
                      <span className="font-black text-[var(--text-primary)]">{workoutMinToday} <span className="font-bold text-[var(--text-muted)]">/ {workoutGoalMin} min</span></span>
                    </div>
                    <div className="h-2 bg-[var(--bg-hover)] rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${workoutGoalMin ? Math.min(100, (workoutMinToday / workoutGoalMin) * 100) : 0}%` }} />
                    </div>
                  </div>
                  {todayWorkouts.length === 0 ? (
                    <button onClick={() => navigate('/dashboard/workouts')} className="w-full flex items-center gap-3 rounded-xl bg-[var(--bg-hover)] px-3 py-2.5 text-left hover:bg-[var(--bg-active)] transition-colors">
                      <span className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px] text-[var(--accent)]">fitness_center</span></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold">No workouts yet today</span>
                        <span className="block text-[12px] text-[var(--text-muted)]">Start a camera workout</span>
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)]">arrow_forward</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {todayWorkouts.slice(0, 3).map((w) => (
                        <div key={w.id} className="flex items-center gap-3 rounded-xl bg-[var(--bg-hover)] px-3 py-2.5">
                          <span className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">fitness_center</span></span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-bold truncate">{workoutLabel(w.workout_type)}</span>
                            <span className="block text-[12px] text-[var(--text-muted)]">
                              {w.status === 'active' ? 'In progress' : fmtDur(w.duration_seconds)}{Number(w.rep_count) > 0 ? ` · ${w.rep_count} reps` : ''}
                            </span>
                          </span>
                          {w.status === 'active' && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] shrink-0">Live</span>
                          )}
                        </div>
                      ))}
                      {todayWorkouts.length > 3 && (
                        <p className="text-[12px] font-bold text-[var(--text-muted)] text-center">+{todayWorkouts.length - 3} more today</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-muted)]">Sleep</span>
                    <span className="font-black text-[var(--text-primary)]">{data.stats?.sleep_duration ? `${data.stats.sleep_duration}h` : '—'} <span className="font-bold text-[var(--text-muted)]">/ 8h ref</span></span>
                  </div>
                </div>
              </div>
              <div className="min-w-full snap-center p-4 sm:p-5">
                <p className="text-[18px] font-black text-[var(--text-primary)] leading-none">Recovery</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">Rest and readiness</p>
                <div className="mt-4 space-y-3.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-muted)]">Sleep quality</span>
                    <span className="font-black text-[var(--text-primary)]">{data.stats?.sleep_quality ?? checkin?.sleep_quality ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-muted)]">Check-in</span>
                    <span className="font-black text-[var(--text-primary)]">{checkin ? `${checkin.sleep_hours ?? '—'}h • ${checkin.sleep_quality ?? ''}` : 'Not yet'}</span>
                  </div>
                  <button
                    onClick={() => setCheckInOpen(true)}
                    className="w-full py-2.5 rounded-[12px] bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[13px] font-bold text-[var(--text-primary)] transition-colors"
                  >
                    {checkin ? 'Update check-in' : 'Check in now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {heroSlideCount > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {[0, 1, 2, 3].slice(0, heroSlideCount).map(i => (
              <button
                key={i}
                onClick={() => goHero(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all ${heroPage === i ? 'w-5 h-2 bg-[var(--accent)] dark:bg-[var(--accent)]' : 'w-1.5 h-1.5 bg-[var(--accent-bg)] dark:bg-[var(--text-inverse)]/20 hover:bg-[var(--accent-bg)] dark:hover:bg-[var(--text-inverse)]/40'}`}
              />
            ))}
          </div>
          )}

          <div className="mt-3"><QuickLog userId={USER_ID} onWeightLogged={() => refreshDashboard()} onCheckIn={() => setCheckInOpen(true)} /></div>

          <WeekStrip />

          <div className="flex items-center justify-between mt-4 mb-2">
            <h2 className="text-[16px] font-black tracking-tight">Today&apos;s Progress</h2>
            <button onClick={() => { refreshDashboard(); refreshMeals(); refreshNutrients(); }} aria-label="Refresh today's progress"
              className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center hover:bg-[var(--bg-active)] transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)]">refresh</span>
            </button>
          </div>

          {/* 2x2 grid like MFP → 4 across on wide desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <MiniCard title="Steps" icon="footprint" value={steps > 0 ? steps.toLocaleString() : '—'} sub={steps > 0 ? `Goal: ${stepGoalTarget.toLocaleString()} steps` : 'No steps yet today'} progress={(steps/stepGoalTarget)*100} onClick={() => navigate('/dashboard/activity-map')} />
            <div className="glass-card border border-black/[0.06] dark:border-white/[0.06] rounded-[14px] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Exercise</p>
                <button onClick={() => navigate('/dashboard/workouts')} className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">add</span></button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-7 h-7 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">local_fire_department</span></span>
                <span className="text-[18px] font-black text-[var(--text-primary)]">{hasActivity ? `${caloriesBurned} cal` : '—'}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-7 h-7 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center"><span className="material-symbols-outlined text-[16px] text-[var(--accent)]">timer</span></span>
                <span className="text-[16px] font-black text-[var(--text-primary)]">{hasActivity ? (hrs > 0 ? `${hrs}:${String(mins).padStart(2,'0')}` : `${mins}`) : '—'}</span>
                <span className="text-[13px] font-bold text-[var(--text-primary)]">{hasActivity ? (hrs ? 'hr' : 'min') : 'No activity yet'}</span>
              </div>
            </div>
            {nutrientActive('PROTEIN') && <MiniCard title="Protein" icon="egg_alt" value={hasMeals ? `${meals.protein}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('PROTEIN', goal?.proteinG ?? 50)} g` : 'Log your first meal'} progress={nutrientTarget('PROTEIN', goal?.proteinG ?? 50) ? (meals.protein/nutrientTarget('PROTEIN', goal?.proteinG ?? 50))*100 : 0} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('CARBOHYDRATES') && <MiniCard title="Carbohydrates" icon="bakery_dining" value={hasMeals ? `${meals.carbs}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('CARBOHYDRATES', goal?.carbsG ?? 275)} g` : 'Log your first meal'} progress={nutrientTarget('CARBOHYDRATES', goal?.carbsG ?? 275) ? (meals.carbs/nutrientTarget('CARBOHYDRATES', goal?.carbsG ?? 275))*100 : 0} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('FAT') && <MiniCard title="Fat" icon="water_drop" value={hasMeals ? `${meals.fat}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('FAT', goal?.fatG ?? 78)} g` : 'Log your first meal'} progress={nutrientTarget('FAT', goal?.fatG ?? 78) ? (meals.fat/nutrientTarget('FAT', goal?.fatG ?? 78))*100 : 0} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('TRANS_FAT') && <MiniCard title="Trans Fat" icon="warning" value={hasMeals ? `${meals.trans_fat}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('TRANS_FAT', 2)} g` : 'Log your first meal'} progress={Math.min(100, (meals.trans_fat/nutrientTarget('TRANS_FAT', 2))*100)} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('SATURATED_FAT') && <MiniCard title="Saturated Fat" icon="water_drop" value={hasMeals ? `${meals.saturated_fat}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('SATURATED_FAT', 20)} g` : 'Log your first meal'} progress={Math.min(100, (meals.saturated_fat/nutrientTarget('SATURATED_FAT', 20))*100)} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('POLYUNSATURATED_FAT') && <MiniCard title="Polyunsaturated Fat" icon="humidity_mid" value={hasMeals ? `${meals.polyunsaturated_fat}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('POLYUNSATURATED_FAT', 22)} g` : 'Log your first meal'} progress={Math.min(100, (meals.polyunsaturated_fat/nutrientTarget('POLYUNSATURATED_FAT', 22))*100)} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientActive('MONOUNSATURATED_FAT') && <MiniCard title="Monounsaturated Fat" icon="eco" value={hasMeals ? `${meals.monounsaturated_fat}g` : '—'} sub={hasMeals ? `Goal: ${nutrientTarget('MONOUNSATURATED_FAT', 22)} g` : 'Log your first meal'} progress={Math.min(100, (meals.monounsaturated_fat/nutrientTarget('MONOUNSATURATED_FAT', 22))*100)} onClick={() => navigate('/dashboard/meal-tracker')} />}
            {nutrientGoals.length===0 && (
              <>
                <MiniCard title="Protein" icon="egg_alt" value={hasMeals ? `${meals.protein}g` : '—'} sub={hasMeals ? `Goal: ${goal?.proteinG ?? 50} g` : 'Log your first meal'} progress={goal?.proteinG ? (meals.protein/goal.proteinG)*100 : 0} onClick={() => navigate('/dashboard/meal-tracker')} />
                <MiniCard title="Carbohydrates" icon="bakery_dining" value={hasMeals ? `${meals.carbs}g` : '—'} sub={hasMeals ? `Goal: ${goal?.carbsG ?? 275} g` : 'Log your first meal'} progress={goal?.carbsG ? (meals.carbs/goal.carbsG)*100 : 0} onClick={() => navigate('/dashboard/meal-tracker')} />
              </>
            )}
          </div>

          {/* Today’s Plan — real enrolled plans */}
          <div className="flex items-center justify-between mt-5 mb-2">
            <h2 className="text-[16px] font-black tracking-tight">Today&apos;s Plan</h2>
            <button onClick={() => navigate('/dashboard/plans')} className="text-[12px] font-bold text-[var(--text-muted)]">View All</button>
          </div>
          <div className="space-y-2.5">
            {todayPlansLoading && (
              <p className="text-[12px] text-[var(--text-muted)] font-bold animate-pulse px-1">Loading your plans…</p>
            )}
            {!todayPlansLoading && todayPlans.length === 0 && (
              <button onClick={() => navigate('/dashboard/plans')}
                className="w-full flex items-center gap-3 p-3 rounded-[16px] glass-card border border-dashed border-[var(--border-medium)] text-left">
                <span className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px] text-[var(--text-muted)]">fitness_center</span></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold">No enrolled plans yet</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">Explore training plans to build today&apos;s schedule</span>
                </span>
                <span className="text-[12px] font-bold text-[var(--accent)] shrink-0 flex items-center gap-0.5">Explore <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span></span>
              </button>
            )}
            {todayPlans.map((p) => (
              <button key={p.id} onClick={() => navigate('/dashboard/plans')} className="w-full flex items-center gap-3 p-3 rounded-[16px] glass-card border border-[var(--border-light)] text-left">
                <span className="w-10 h-10 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px] text-[var(--accent)]">self_improvement</span></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold truncate">{p.title || p.name || 'Training plan'}</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">{p.level || p.goal || 'Enrolled'} • Tap to open tracker</span>
                </span>
                <span className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">arrow_forward</span></span>
              </button>
            ))}
          </div>

          {/* extra row: recovery + goal as small cards like MFP bottom spacing */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button onClick={() => setCheckInOpen(true)} className="text-left glass-card border border-black/[0.06] dark:border-white/[0.06] rounded-[14px] p-4">
              <p className="text-[14px] font-bold">Recovery</p>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">{checkin ? `${checkin.sleep_hours}h • ${checkin.sleep_quality}` : 'No check-in'}</p>
              <p className="text-[12px] font-bold text-[var(--accent)] dark:text-[var(--accent)] mt-2 flex items-center gap-0.5">Check-In <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span></p>
            </button>
            <button onClick={() => { if (goal) setGoalDetailOpen(true); else navigate('/onboarding'); }} className="text-left glass-card border border-black/[0.06] dark:border-white/[0.06] rounded-[14px] p-4">
              <p className="text-[14px] font-bold">Goal</p>
              <p className="text-[13px] text-[var(--text-muted)] mt-1 truncate">{goal ? goalLabel(goal.goalType) : 'Set goal'}</p>
              {goal && goal.targetWeightKg != null ? (
                <div className="mt-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-black text-[var(--text-primary)] truncate">
                      {fmtW(currentWeightKg ?? goal.weightKg)}<span className="font-bold text-[var(--text-muted)]"> – {fmtW(goal.targetWeightKg)}</span>
                    </p>
                    {progressPct != null && (
                      <span className="text-[12px] font-black text-[var(--accent)] shrink-0">{progressPct}%</span>
                    )}
                  </div>
                  {progressPct != null && (
                    <div className="h-1.5 bg-[var(--bg-hover)] rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
                    </div>
                  )}
                </div>
              ) : goal ? (
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-2 truncate">
                  {goal.dailyKcal != null ? `${Number(goal.dailyKcal).toLocaleString()} kcal` : '—'}
                  <span className="font-semibold text-[var(--text-muted)]"> · P{goal.proteinG ?? '—'} C{goal.carbsG ?? '—'} F{goal.fatG ?? '—'}</span>
                </p>
              ) : null}
              <p className="text-[12px] font-bold text-[var(--accent)] dark:text-[var(--accent)] mt-2 flex items-center gap-0.5">{goal ? 'View' : 'Set up'} <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span></p>
            </button>
           </div>
          </div>
        </div>
      </main>

      {goalDetailOpen && (
        <GoalDetailSheet
          userId={USER_ID}
          goal={goal}
          currentWeightKg={currentWeightKg}
          progressPct={progressPct}
          onClose={() => setGoalDetailOpen(false)}
          onUpdated={() => { refreshGoal(); refreshDashboard(); }}
        />
      )}
      <div className="md:hidden"><BottomNav onCenterAction={handleLogActivity} /></div>
      <div className="hidden md:block"><FAB onSave={handleLogActivity} /></div>
      {checkInOpen && <CheckInModal userId={USER_ID} initial={checkin} onClose={() => setCheckInOpen(false)} onSaved={onCheckInSaved} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
};
export default Dashboard;
