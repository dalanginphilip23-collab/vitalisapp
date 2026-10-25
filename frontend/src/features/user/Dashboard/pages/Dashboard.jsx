import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { Sidebar, Topbar, BottomNav, LogActivityModal, AppQuickJump } from '../../../../components/index.js';
import Icon from '../../../../components/Icon.jsx';
import { useActivityLogger } from '../hooks/useActivityLogger.js';
import { useDashboardData }  from '../hooks/useDashboardData.js';
import { useActiveGoal } from '../../Onboarding/hooks/useActiveGoal.js';
import { useTodayMeals } from '../hooks/useTodayMeals.js';
import { useSidebarCollapsed } from '../../../../hooks/useSidebarCollapsed.js';
import { goalLabel, humanizeOption } from '../../Onboarding/constants/goals.js';
import CheckInModal from '../components/CheckInModal.jsx';
import QuickLog from '../components/QuickLog.jsx';
import GoalDetailSheet from '../components/GoalDetailSheet.jsx';
import { apiFetch, apiGet } from '../../../../lib/apiClient.js';
import { safeGet } from '../../../../lib/storage.js';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import {
  DashboardGreeting,
  DashboardHero,
  NextSessionCard,
  TodaysPlanCard,
  QuickActions,
  StatCard,
  MacroFocusCard,
  WorkoutProgressCard,
  RecoveryCard,
  MotivationCard,
  ThisWeekCard,
  RecentWorkoutsCard,
  AiCoachCard,
} from '../components/DashboardWidgets.jsx';
import WeekCalendarCard from '../components/WeekCalendarCard.jsx';
import { clampPct, minutesFromSeconds, workoutLabel, isToday } from '../lib/dashboardFormat.js';
import '../dashboard.css';

// Live date/time line — kept from the previous dashboard (1s tick).
const LiveClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return <>{s} • {t}</>;
};

const NUTRIENT_META = {
  PROTEIN: { label: 'Protein', key: 'protein' },
  CARBOHYDRATES: { label: 'Carbs', key: 'carbs' },
  FAT: { label: 'Fat', key: 'fat' },
  TRANS_FAT: { label: 'Trans fat', key: 'trans_fat' },
  SATURATED_FAT: { label: 'Saturated fat', key: 'saturated_fat' },
  POLYUNSATURATED_FAT: { label: 'Polyunsaturated', key: 'polyunsaturated_fat' },
  MONOUNSATURATED_FAT: { label: 'Monounsaturated', key: 'monounsaturated_fat' },
};

const EMPTY_STATS = {
  steps: 0, calories_burned: 0, workout_duration_mins: 0,
  sleep_duration: 0, readiness: null, readinessNote: '',
};
const EMPTY_MEALS = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const isoLongDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
};

// Read-only snapshot for a past day. Keeps the last fetched date in state so
// `loading` is derivable without resetting state synchronously in the effect.
function useDaySnapshot(viewDate) {
  const [result, setResult] = useState({ date: null, data: null, error: false });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!viewDate) return undefined;
    let alive = true;
    apiGet(`/api/dashboard/calendar/${viewDate}`)
      .then((d) => { if (alive) setResult({ date: viewDate, data: d, error: false }); })
      .catch(() => { if (alive) setResult({ date: viewDate, data: null, error: true }); });
    return () => { alive = false; };
  }, [viewDate, reloadKey]);

  const matches = Boolean(viewDate) && result.date === viewDate;
  return {
    data: matches ? result.data : null,
    error: matches ? result.error : false,
    loading: Boolean(viewDate) && !matches,
    reload: () => setReloadKey((k) => k + 1),
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const USER_ID = user?.id || null;
  const handleLogout = async () => { await logout(); navigate('/login'); };
  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);
  // null = live (today); ISO date = read-only past-day view.
  const [viewDate, setViewDate] = useState(null);
  // Bumped whenever something that lands in the week calendar changes.
  const [calendarKey, setCalendarKey] = useState(0);
  const bumpCalendar = () => setCalendarKey((k) => k + 1);
  const [nutrientGoals, setNutrientGoals] = useState([]);
  const { data, biometrics, workouts, dashboardError, setData, setBiometrics, setAuthOverride, mergeData, refresh: refreshDashboard, generateFitnessInsight } = useDashboardData(USER_ID);
  const { goal, currentWeightKg, progressPct, refresh: refreshGoal } = useActiveGoal(USER_ID);
  const { meals, refreshMeals } = useTodayMeals(USER_ID);
  useEffect(() => { if (!user) return; setAuthOverride(user.name || null, user.avatar || null); }, [user, setAuthOverride]);
  const { handleLogActivity } = useActivityLogger(USER_ID, { setData, setBiometrics, biometrics, mergeData, generateFitnessInsight });
  const { data: dayView, error: dayViewError, loading: dayViewLoading, reload: reloadDayView } = useDaySnapshot(viewDate);
  const isPastView = Boolean(viewDate);

  // Everything below is "the day being viewed" — live today, or the selected
  // past day's snapshot. Widgets that are about targets stay unchanged.
  const liveStats = data.stats || EMPTY_STATS;
  const viewStats = isPastView
    ? (dayView ? {
      steps: dayView.activity.steps,
      calories_burned: dayView.activity.caloriesBurned,
      workout_duration_mins: dayView.activity.workoutMinutes,
      sleep_duration: dayView.recovery.sleepHours,
      readiness: dayView.recovery.readiness,
      readinessNote: dayView.recovery.readinessNote || '',
      sleep_quality: dayView.recovery.checkin?.sleep_quality || null,
    } : EMPTY_STATS)
    : liveStats;
  const viewMeals = isPastView ? (dayView ? dayView.nutrition.totals : EMPTY_MEALS) : meals;
  const viewCheckin = isPastView ? (dayView?.recovery?.checkin || null) : (data.checkin || null);

  const steps = viewStats.steps || 0;
  // Real step target from Preferences (cached on save/load) — was hardcoded 10,000.
  const stepGoalTarget = Number(safeGet('vitalis:stepGoal', '10000')) || 10000;
  const caloriesBurned = viewStats.calories_burned || 0;
  const sleepHours = Number(viewStats.sleep_duration) || 0;
  const readiness = viewStats.readiness ?? null;
  const readinessNote = viewStats.readinessNote || '';
  const checkin = viewCheckin;
  const tKcal = goal?.dailyKcal ?? 1500;
  const foodKcal = viewMeals.kcal || 0;
  const remaining = Math.max(0, tKcal - foodKcal + caloriesBurned);

  const onCheckInSaved = () => { refreshDashboard(); refreshMeals(); bumpCalendar(); };
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
      setNutrientGoals(d.goals || []);
    } catch {
      setNutrientGoals([]);
    }
  };
  useEffect(() => { refreshNutrients(); }, [USER_ID]); // eslint-disable-line react-hooks/exhaustive-deps

  const onboardingSkipped = useMemo(() => safeGet('vitalis:onboarding') === 'skipped', []);
  const showOnboardingBanner = user?.onboardingCompleted === false && !onboardingSkipped;

  // AI recommendations based on progress and goals
  const [aiRec, setAiRec] = useState(null);
  const [aiRecLoading, setAiRecLoading] = useState(false);
  const fetchAiRec = async () => {
    if (!USER_ID) return;
    setAiRecLoading(true);
    try {
      const res = await apiGet('/api/ai/summary');
      setAiRec(res);
    } catch {
      setAiRec(null);
    } finally {
      setAiRecLoading(false);
    }
  };
  useEffect(() => { fetchAiRec(); }, [USER_ID]); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshAll = () => {
    refreshDashboard();
    refreshMeals();
    refreshNutrients();
    fetchAiRec();
    bumpCalendar();
    if (isPastView) reloadDayView();
  };

  // ── Real workout derivations (workout logs + selected day stats) ──────
  const activeLogs = useMemo(
    () => (workouts || []).filter((l) => l.status !== 'cancelled'),
    [workouts],
  );
  // Normalize the selected day's snapshot into the same shape workout widgets
  // expect (workout_type / start_time / duration_seconds / rep_count).
  const viewWorkoutLogs = useMemo(() => {
    if (!isPastView) return activeLogs;
    return (dayView?.workouts || []).map((w, i) => ({
      id: `day-${i}`,
      workout_type: w.type,
      status: w.status,
      rep_count: w.reps,
      duration_seconds: w.minutes * 60,
      start_time: w.startTime,
    }));
  }, [activeLogs, dayView, isPastView]);
  const todayWorkouts = useMemo(() => {
    if (isPastView) {
      return [...viewWorkoutLogs].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    }
    return activeLogs
      .filter((l) => isToday(l.start_time))
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [activeLogs, viewWorkoutLogs, isPastView]);
  const recentWorkouts = useMemo(() => {
    if (isPastView) return viewWorkoutLogs.slice(0, 4);
    return [...activeLogs]
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 4);
  }, [activeLogs, viewWorkoutLogs, isPastView]);
  const logMinutesToday = todayWorkouts.reduce((s, l) => s + minutesFromSeconds(l.duration_seconds), 0);
  const statsWorkoutMin = Number(viewStats.workout_duration_mins) || 0;
  const workoutMinToday = isPastView ? logMinutesToday : Math.max(statsWorkoutMin, logMinutesToday);
  const workoutGoalMin = Number(aiRec?.profile?.workoutGoalMin)
    || (goal?.goalType === 'BUILD_MUSCLE' || goal?.goalType === 'PERFORMANCE' ? 60
      : goal?.goalType === 'LOSE_WEIGHT' || goal?.goalType === 'GAIN_WEIGHT' ? 45 : 30);

  // Rolling 7-day window ending today — bucket real log durations per local day.
  const weeklyDays = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      days.push({ date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - i), minutes: 0, sessions: 0, isToday: i === 0 });
    }
    const byKey = new Map(days.map((d) => [d.date.toDateString(), d]));
    for (const l of activeLogs) {
      const d = new Date(l.start_time);
      if (Number.isNaN(d.getTime())) continue;
      const bucket = byKey.get(d.toDateString());
      if (!bucket) continue;
      bucket.minutes += minutesFromSeconds(l.duration_seconds);
      bucket.sessions += 1;
    }
    const today = days[days.length - 1];
    if (!isPastView && workoutMinToday > today.minutes) today.minutes = workoutMinToday;
    return days;
  }, [activeLogs, workoutMinToday, isPastView]);
  const weeklyTotal = weeklyDays.reduce((s, d) => s + d.minutes, 0);
  const weeklySessions = weeklyDays.reduce((s, d) => s + d.sessions, 0);

  const streak = useMemo(() => {
    const daySet = new Set(activeLogs.map((l) => new Date(l.start_time).toDateString()));
    const cursor = new Date();
    if (!daySet.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    let n = 0;
    while (daySet.has(cursor.toDateString())) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [activeLogs]);

  // ── Goal / macro derivations ──────────────────────────────────────────
  const macroRows = useMemo(() => {
    if (nutrientGoals.length > 0) {
      return nutrientGoals
        .filter((g) => NUTRIENT_META[g.nutrient])
        .slice(0, 4)
        .map((g) => ({
          label: NUTRIENT_META[g.nutrient].label,
          actual: Math.round(viewMeals[NUTRIENT_META[g.nutrient].key] || 0),
          target: Math.round(Number(g.target_value) || 0),
          unit: 'g',
        }));
    }
    if (!goal) return [];
    return [
      { label: 'Protein', actual: viewMeals.protein, target: Number(goal.proteinG) || 0, unit: 'g' },
      { label: 'Carbs', actual: viewMeals.carbs, target: Number(goal.carbsG) || 0, unit: 'g' },
      { label: 'Fat', actual: viewMeals.fat, target: Number(goal.fatG) || 0, unit: 'g' },
    ];
  }, [nutrientGoals, goal, viewMeals]);
  const macroPct = macroRows.length
    ? Math.round(macroRows.reduce((s, m) => s + (m.target > 0 ? Math.min(100, (m.actual / m.target) * 100) : 0), 0) / macroRows.length)
    : 0;

  const planRows = [
    {
      label: 'Workout',
      icon: 'fitness_center',
      value: `${workoutMinToday}/${workoutGoalMin}`,
      valueSuffix: 'min',
      pct: workoutGoalMin ? (workoutMinToday / workoutGoalMin) * 100 : 0,
      done: workoutMinToday >= workoutGoalMin,
    },
    {
      label: 'Steps',
      icon: 'footprint',
      value: steps.toLocaleString(),
      valueSuffix: `/ ${stepGoalTarget.toLocaleString()}`,
      pct: stepGoalTarget ? (steps / stepGoalTarget) * 100 : 0,
      done: steps >= stepGoalTarget,
    },
    ...(goal?.proteinG
      ? [{
        label: 'Protein',
        icon: 'egg_alt',
        value: `${viewMeals.protein}g`,
        valueSuffix: `/ ${Number(goal.proteinG)}g`,
        pct: (viewMeals.protein / Number(goal.proteinG)) * 100,
        done: viewMeals.protein >= Number(goal.proteinG),
      }]
      : []),
  ];

  const recoveryRows = [
    { label: 'Sleep', value: `${Number(checkin?.sleep_hours ?? sleepHours) || 0} h` },
    { label: 'Quality', value: humanizeOption(checkin?.sleep_quality) || '—' },
    { label: 'Energy', value: humanizeOption(checkin?.energy_level) || '—' },
  ];

  const workoutProgressRows = [
    { label: isPastView ? 'Selected day' : 'Today', value: `${workoutMinToday}/${workoutGoalMin} min` },
    { label: 'Sessions', value: `${todayWorkouts.length}` },
    { label: 'This week', value: `${weeklyTotal} min` },
    { label: 'Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` },
  ];

  const thisWeekRows = [
    { icon: 'calendar_month', label: 'Workouts logged', value: `${weeklySessions}` },
    { icon: 'schedule', label: 'Active minutes', value: `${weeklyTotal} min` },
    { icon: 'local_fire_department', label: 'Day streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}` },
  ];

  const goalValueText = goal
    ? goal.targetWeightKg != null
      ? `${currentWeightKg ?? goal.weightKg ?? '—'} → ${goal.targetWeightKg} kg`
      : goalLabel(goal.goalType)
    : 'Not set';

  const selectedPlan = todayPlans[0] || null;
  const latestSession = todayWorkouts[0] || null;
  const nextSession = latestSession
    ? {
      kicker: latestSession.status === 'active' ? 'In progress' : 'Latest session',
      title: workoutLabel(latestSession.workout_type),
      sub: latestSession.status === 'active'
        ? 'Camera session running'
        : `${minutesFromSeconds(latestSession.duration_seconds)} min${Number(latestSession.rep_count) > 0 ? ` · ${latestSession.rep_count} reps` : ''}`,
      time: new Date(latestSession.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      onClick: () => navigate('/dashboard/workouts'),
    }
    : !isPastView && selectedPlan
      ? {
        kicker: "Today's plan",
        title: selectedPlan.title || selectedPlan.name || 'Training plan',
        sub: [selectedPlan.tag, selectedPlan.intensity].filter(Boolean).join(' · ') || 'Enrolled plan',
        time: '',
        onClick: () => navigate('/dashboard/plans'),
      }
      : {
        kicker: isPastView ? 'Past day' : 'Get started',
        title: isPastView ? 'No workout logged' : 'No workout yet today',
        sub: isPastView ? 'Nothing was recorded on this day' : 'Start a session or log your activity',
        time: '',
        onClick: () => navigate('/dashboard/workouts'),
      };

  const handleQuickAction = (key) => {
    if (key === 'meal') navigate('/dashboard/meal-tracker?manual=1');
    else if (key === 'workout') navigate('/dashboard/workouts');
    else if (key === 'activity') navigate('/dashboard/activity-map');
    // Sleep quick-action opens the Daily Recovery check-in — it captures
    // sleep duration/quality and keeps the Dashboard Sleep card updated.
    else if (key === 'sleep') setCheckInOpen(true);
    else if (key === 'checkin') setCheckInOpen(true);
  };

  if (loading) return null;
  if (!USER_ID) return null;

  const displayName = user?.name || data.profile?.name || 'Member';
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  const hourNow = new Date().getHours();
  const partOfDay = hourNow < 12 ? 'morning' : hourNow < 18 ? 'afternoon' : 'evening';
  const introCopy = isPastView
    ? `${isoLongDate(viewDate)} — ${foodKcal.toLocaleString()} kcal eaten, ${workoutMinToday} active minutes`
      + (todayWorkouts.length > 0
        ? `, ${todayWorkouts.length} session${todayWorkouts.length > 1 ? 's' : ''} logged.`
        : ', no sessions logged.')
    : `${remaining.toLocaleString()} kcal left today`
      + (todayWorkouts.length > 0
        ? ` and ${todayWorkouts.length} session${todayWorkouts.length > 1 ? 's' : ''} logged so far.`
        : ' — no sessions logged yet.');

  return (
    <div className={`vdash${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Sidebar onClick={handleLogout} collapsed={collapsed} onToggle={toggleSidebar} />
      <Topbar
        userId={USER_ID}
        leftOffsetClass="vdash-offset"
        leftSlot={(
          <>
            <div className="md:hidden">
              <DashboardGreeting name={displayName} avatar={user?.avatar || data.profile?.avatar_url} />
            </div>
            <div className="hidden md:block">
              <AppQuickJump />
            </div>
          </>
        )}
      />

      <main className="vdash-main">
        <div className="vd-container">
          {dashboardError && (
            <div className="mb-4">
              <ErrorState
                message={dashboardError.message || 'Could not load your dashboard.'}
                onRetry={refreshAll}
              />
            </div>
          )}

          {showOnboardingBanner && (
            <div className="mb-4 p-4 rounded-[16px] glass-panel border border-[var(--accent-border)] flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[length:var(--fs-20)] text-[var(--text-inverse)]">person_add</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[length:var(--fs-14)] font-black text-[var(--text-primary)]">Complete your profile</p>
                <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] mt-0.5">Finish your goal and body profile to unlock personalized targets — about 1 min.</p>
              </div>
              <button
                onClick={() => navigate('/onboarding?edit=1')}
                className="shrink-0 w-full min-[420px]:w-auto px-4 py-2.5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-black whitespace-nowrap hover:brightness-105 active:scale-95 transition-all"
              >
                Complete Profile
              </button>
            </div>
          )}

          {isPastView && (
            <div className="vd-view-banner" role="status">
              <span className="vd-view-banner-icon"><Icon name="history" /></span>
              <div className="vd-view-banner-copy">
                <strong>Viewing {isoLongDate(viewDate)}</strong>
                <span>Past-day data · read-only. Logging is available for today only.</span>
              </div>
              {dayViewLoading && <span className="vd-view-banner-note">Loading day…</span>}
              {dayViewError && (
                <button type="button" className="vd-view-banner-retry" onClick={reloadDayView}>Retry</button>
              )}
              <button type="button" className="vd-view-banner-btn" onClick={() => setViewDate(null)}>
                Back to today
              </button>
            </div>
          )}

          <div className="vd-layout">
            {/* Desktop intro band — Reference B headline + real date/quick log */}
            <section className="vd-intro">
              <span className="vd-intro-eyebrow">{isPastView ? 'Day review' : "Today's dashboard"}</span>
              <h1 className="vd-intro-title">Good {partOfDay}, <em>{firstName}</em>.</h1>
              <p className="vd-intro-sub">{introCopy}</p>
              <div className="vd-intro-foot">
                {!isPastView && (
                  <QuickLog userId={USER_ID} onWeightLogged={refreshDashboard} onCheckIn={() => setCheckInOpen(true)} />
                )}
                <span className="vd-date"><LiveClock /></span>
                <button type="button" className="vd-text-btn" onClick={refreshAll}>
                  <Icon name="refresh" style={{ fontSize: 15 }} /> Refresh
                </button>
              </div>
            </section>

            <DashboardHero
              remaining={remaining}
              goalLabelText={goal ? goalLabel(goal.goalType) : 'Vitalis'}
              foodKcal={foodKcal}
              caloriesBurned={caloriesBurned}
              workoutMinToday={workoutMinToday}
              workoutGoalMin={workoutGoalMin}
              onLogActivity={() => setLogOpen(true)}
              onStartWorkout={() => navigate('/dashboard/workouts')}
              eyebrow={isPastView ? 'Reviewing' : 'Today'}
              readOnly={isPastView}
            />

            <div className="vd-weekly-col">
              <WeekCalendarCard
                refreshKey={calendarKey}
                selectedDate={viewDate}
                onSelectDate={setViewDate}
              />
              <NextSessionCard
                kicker={nextSession.kicker}
                title={nextSession.title}
                sub={nextSession.sub}
                time={nextSession.time}
                onClick={nextSession.onClick}
              />
            </div>

            <div className="vd-plan-col">
              <TodaysPlanCard
                activeKcal={caloriesBurned}
                rows={planRows}
                plan={selectedPlan}
                plansLoading={todayPlansLoading}
                onLogActivity={() => setLogOpen(true)}
                onOpenPlan={() => navigate('/dashboard/plans')}
                onOpenPlans={() => navigate('/dashboard/plans')}
                title={isPastView ? 'Daily Targets' : "Today's Plan"}
                sub={isPastView ? 'Targets applied to this day' : 'Your targets for today'}
                readOnly={isPastView}
              />
            </div>

            {/* Mobile-only quick actions — Reference A exercise circles */}
            {!isPastView && (
              <section className="vd-quick">
                <div className="vd-quick-head">
                  <h2 className="vd-quick-title">Quick Actions</h2>
                  <button type="button" className="vd-text-btn" onClick={() => setLogOpen(true)}>
                    Log <Icon name="add" style={{ fontSize: 14 }} />
                  </button>
                </div>
                <QuickActions onAction={handleQuickAction} />
              </section>
            )}

            <div className="vd-stats">
              <div className="vd-stats-grid">
                <StatCard
                  icon="footprint"
                  label="Steps"
                  value={steps.toLocaleString()}
                  note={`of ${stepGoalTarget.toLocaleString()} step goal`}
                  footLeft="Progress"
                  footRight={`${clampPct(stepGoalTarget ? (steps / stepGoalTarget) * 100 : 0)}%`}
                  progress={stepGoalTarget ? (steps / stepGoalTarget) * 100 : 0}
                  tone="vd-stat--accent"
                />
                <StatCard
                  icon="local_fire_department"
                  label="Calories"
                  value={foodKcal.toLocaleString()}
                  unit="kcal"
                  note={`eaten of ${tKcal.toLocaleString()} kcal target`}
                  footLeft="Burned"
                  footRight={`${caloriesBurned.toLocaleString()} kcal`}
                  progress={tKcal ? (foodKcal / tKcal) * 100 : 0}
                  tone="vd-stat--warm"
                />
                <StatCard
                  icon="timer"
                  label="Workout"
                  value={`${workoutMinToday}`}
                  unit="min"
                  note={`of ${workoutGoalMin} min goal`}
                  footLeft="Sessions"
                  footRight={`${todayWorkouts.length}`}
                  progress={workoutGoalMin ? (workoutMinToday / workoutGoalMin) * 100 : 0}
                />
                <StatCard
                  icon="bedtime"
                  label="Sleep"
                  value={`${sleepHours}`}
                  unit="h"
                  note={isPastView
                    ? (Number(goal?.sleepHours) ? `of ${Number(goal.sleepHours)} h goal` : 'logged that night')
                    : (Number(goal?.sleepHours) ? `of ${Number(goal.sleepHours)} h goal` : 'logged last night')}
                  footLeft="Quality"
                  footRight={humanizeOption(checkin?.sleep_quality) || humanizeOption(viewStats?.sleep_quality) || '—'}
                  progress={Number(goal?.sleepHours) ? (sleepHours / Number(goal.sleepHours)) * 100 : (sleepHours / 8) * 100}
                />
                <MacroFocusCard
                  macroPct={macroPct}
                  rows={macroRows}
                  onAddFood={() => navigate('/dashboard/meal-tracker?manual=1')}
                  onSetGoal={() => navigate('/onboarding?edit=1')}
                  readOnly={isPastView}
                />
              </div>
            </div>

            <div className="vd-lower">
              <div className="vd-lower-grid">
                <WorkoutProgressCard
                  pct={workoutGoalMin ? (workoutMinToday / workoutGoalMin) * 100 : 0}
                  rows={workoutProgressRows}
                  onOpen={() => navigate('/dashboard/workouts')}
                />
                <RecoveryCard
                  readiness={readiness}
                  note={readinessNote}
                  rows={recoveryRows}
                  hasCheckIn={Boolean(checkin)}
                  onCheckIn={() => setCheckInOpen(true)}
                  readOnly={isPastView}
                />
                <MotivationCard streak={streak} onOpenWorkouts={() => navigate('/dashboard/workouts')} />
                <ThisWeekCard
                  rows={thisWeekRows}
                  goal={goal}
                  goalText={goalValueText}
                  progressPct={progressPct}
                  onOpenGoal={() => setGoalDetailOpen(true)}
                  onSetGoal={() => navigate('/onboarding?edit=1')}
                />
              </div>
            </div>

            <div className="vd-bottom">
              <RecentWorkoutsCard
                workouts={recentWorkouts}
                title={isPastView ? 'Workouts · selected day' : 'Recent Workouts'}
                subtitle={isPastView
                  ? (todayWorkouts.length > 0
                    ? `${todayWorkouts.length} logged on ${isoLongDate(viewDate)}`
                    : 'No sessions logged on this day')
                  : (todayWorkouts.length > 0
                    ? `${todayWorkouts.length} logged today`
                    : 'No sessions logged today yet')}
                onOpenWorkouts={() => navigate('/dashboard/workouts')}
              />
              <AiCoachCard aiRec={aiRec} loading={aiRecLoading} onRefresh={fetchAiRec} />
            </div>
          </div>
        </div>
      </main>

      <LogActivityModal isOpen={logOpen} onClose={() => setLogOpen(false)} onSave={async (a) => { await handleLogActivity(a); bumpCalendar(); }} />
      <div className="md:hidden"><BottomNav onCenterAction={handleLogActivity} /></div>

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
      {checkInOpen && <CheckInModal userId={USER_ID} initial={checkin} onClose={() => setCheckInOpen(false)} onSaved={onCheckInSaved} />}
    </div>
  );
};

export default Dashboard;
