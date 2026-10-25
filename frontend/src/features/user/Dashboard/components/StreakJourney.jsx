import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Modal from '../../../../components/ui/Modal.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MILESTONES = [3, 7, 14, 30, 60, 90];
const SOURCE_LABEL = { workout: 'workout', meal: 'meal', checkin: 'check-in' };

const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatLongDate = (iso) => parseISO(iso).toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

const monthDay = (iso) => parseISO(iso).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric',
});

const rangeLabel = (start, end) => {
  if (!start || !end) return 'This week';
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${monthDay(start)} – ${Number(end.slice(8))}`
    : `${monthDay(start)} – ${monthDay(end)}`;
};

// Decorative brand flame — a custom lightweight SVG, not a copied asset.
const Flame = ({ size = 'md', celebrating = false }) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span
      className={`vd-streak-flame vd-streak-flame--${size}${celebrating ? ' is-celebrating' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" focusable="false">
        <defs>
          <linearGradient id={`flame-${id}`} x1="18" y1="12" x2="48" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="vd-streak-flame-stop-a" />
            <stop offset="1" className="vd-streak-flame-stop-b" />
          </linearGradient>
        </defs>
        <path
          d="M35.6 4.9c1.1 7.7 6.1 9.7 10.5 16.1 3.5 5 5.4 10.6 4.1 17.2-1.9 9.8-10.3 16.8-20.2 16.8-11.4 0-20.7-9.3-20.7-20.7 0-7.3 3.9-13.8 9-18.6-.3 5 1.7 8.1 4.7 9.7 1.2-8.8 6.2-15.1 12.6-20.5Z"
          fill={`url(#flame-${id})`}
        />
        <path
          d="M32.4 29.3c.9 4.7 5.2 6.8 5.2 11.9a5.9 5.9 0 1 1-11.8 0c0-4.4 2.9-7.3 4.4-10.2.6 1.5 1.4 2.5 2.6 3.2.2-1.9.1-3.4-.4-4.9Z"
          className="vd-streak-flame-core"
        />
      </svg>
      <span className="vd-streak-spark vd-streak-spark--1" />
      <span className="vd-streak-spark vd-streak-spark--2" />
      <span className="vd-streak-spark vd-streak-spark--3" />
    </span>
  );
};

const WeekStrip = ({ week = [], compact = false }) => {
  const valid = Array.isArray(week) && week.length === 7;
  return (
    <ol
      className={`vd-streak-weekstrip${compact ? ' is-compact' : ''}${valid ? '' : ' is-loading'}`}
      aria-label="This week's streak progress"
    >
      {(valid ? week : DOW.map((_, i) => ({ date: `ghost-${i}`, isFuture: i > 2, active: false }))).map((day, i) => {
        const state = day.active ? 'done' : day.isToday ? 'today' : day.isFuture ? 'future' : 'missed';
        const stateText = day.isToday ? 'Today' : day.active ? 'Done' : day.isFuture ? 'Next' : '—';
        const label = valid
          ? `${formatLongDate(day.date)} — ${day.active
            ? 'completed'
            : day.isToday ? 'today, not completed yet' : day.isFuture ? 'upcoming' : 'no activity'}`
          : 'Loading day';
        return (
          <li
            key={day.date || i}
            className={`vd-streak-day is-${state}${day.isToday ? ' is-today' : ''}`}
            aria-label={valid ? label : undefined}
            aria-hidden={valid ? undefined : true}
          >
            <span className="vd-streak-day-name" aria-hidden="true">{compact ? DOW_SHORT[i] : DOW[i]}</span>
            <span className="vd-streak-day-dot" aria-hidden="true">
              {day.active
                ? <Icon name="check" />
                : <span>{valid ? Number(day.date.slice(8, 10)) : '·'}</span>}
            </span>
            <span className="vd-streak-day-state" aria-hidden="true">{valid ? stateText : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
};

const TodayRow = ({ icon, label, detail, done, action, onAction }) => (
  <li className={`vd-streak-action${done ? ' is-done' : ''}`}>
    <span className="vd-streak-action-icon" aria-hidden="true">
      <Icon name={done ? 'check' : icon} />
    </span>
    <span className="vd-streak-action-copy">
      <span className="vd-streak-action-label">{label}</span>
      <span className="vd-streak-action-detail">{detail}</span>
    </span>
    {onAction && (
      <button type="button" className="vd-streak-action-btn" onClick={onAction}>
        {action}
        <Icon name="chevron_right" />
      </button>
    )}
  </li>
);

const HeatGrid = ({ history = [], today = null, activeDays = 0 }) => {
  const cells = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    const leading = (parseISO(history[0].date).getDay() + 6) % 7;
    return [...Array(leading).fill(null), ...history];
  }, [history]);

  if (!cells.length) {
    return (
      <p className="vd-streak-history-empty">
        Your 90-day history will appear here as you log activity.
      </p>
    );
  }

  return (
    <div
      className="vd-streak-heat"
      role="img"
      aria-label={`${activeDays} active day${activeDays === 1 ? '' : 's'} in the last 90 days`}
    >
      {cells.map((day, i) => {
        if (!day) return <span key={`blank-${i}`} className="vd-streak-cell is-blank" aria-hidden="true" />;
        const level = Math.min(3, Number(day.count) || 0);
        const sources = (day.sources || []).map((s) => SOURCE_LABEL[s]).filter(Boolean).join(' + ');
        return (
          <span
            key={day.date}
            className={`vd-streak-cell is-l${level}${day.date === today ? ' is-today' : ''}`}
            title={`${formatLongDate(day.date)} — ${day.active ? sources || 'active' : 'no activity'}`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

const StreakJourney = ({
  userId = null,
  streak = null,
  loading = false,
  error = null,
  readOnly = false,
  workoutCount = 0,
  mealCount = 0,
  hasCheckin = false,
  onStartWorkout = undefined,
  onLogMeal = undefined,
  onViewMeals = undefined,
  onCheckIn = undefined,
  onRetry = undefined,
}) => {
  const [successOpen, setSuccessOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const celebratedRef = useRef(false);

  const activeToday = Boolean(streak?.activeToday);
  const current = Number(streak?.current) || 0;
  const serverLongest = Number(streak?.longest) || 0;
  const longest = Math.max(serverLongest, current);
  const today = streak?.today || null;
  const storageKey = today && userId ? `vitalis:streak-celebrated:${userId}:${today}` : null;

  // Server day keys are the single source of truth for what counts today.
  // Local counts are only used to add a helpful detail (“3 sessions logged”).
  const todaySources = Array.isArray(streak?.todaySources)
    ? streak.todaySources
    : [
      ...(workoutCount > 0 ? ['workout'] : []),
      ...(mealCount > 0 ? ['meal'] : []),
      ...(hasCheckin ? ['checkin'] : []),
    ];
  const doneWorkout = todaySources.includes('workout');
  const doneMeal = todaySources.includes('meal');
  const doneCheckin = todaySources.includes('checkin');
  const doneCount = [doneWorkout, doneMeal, doneCheckin].filter(Boolean).length;

  const week = Array.isArray(streak?.week) ? streak.week : [];
  const history = Array.isArray(streak?.history) ? streak.history : [];
  const activeThisWeek = week.filter((d) => d.active).length;
  const activeDays90 = history.filter((d) => d.active).length;

  const nextMilestone = MILESTONES.find((m) => current < m) ?? null;
  const previousMilestone = [...MILESTONES].reverse().find((m) => current >= m) ?? 0;
  const milestonePct = nextMilestone
    ? Math.max(0, Math.min(100, ((current - previousMilestone) / (nextMilestone - previousMilestone)) * 100))
    : 100;

  useEffect(() => {
    if (readOnly || !streak || !storageKey || !activeToday || current <= 0 || celebratedRef.current) return undefined;
    let seen = false;
    try { seen = window.sessionStorage.getItem(storageKey) === '1'; } catch { seen = false; }
    if (seen) return undefined;

    let cancelled = false;
    const openTimer = window.setTimeout(() => {
      if (cancelled) return;
      // Mark it only when the dialog actually opens, so a dev StrictMode
      // setup/cleanup/setup cycle cannot swallow the celebration.
      celebratedRef.current = true;
      try { window.sessionStorage.setItem(storageKey, '1'); } catch { /* storage can be unavailable */ }
      setCelebrating(true);
      setSuccessOpen(true);
    }, 420);
    const calmTimer = window.setTimeout(() => setCelebrating(false), 2200);
    return () => {
      cancelled = true;
      window.clearTimeout(openTimer);
      window.clearTimeout(calmTimer);
    };
  }, [readOnly, streak, storageKey, activeToday, current]);

  const dismissSuccess = () => {
    setSuccessOpen(false);
    setCelebrating(false);
  };

  if (loading) {
    return (
      <section className="vd-streak vd-streak--state" aria-label="Daily streak" aria-busy="true">
        <div className="vd-streak-state-icon vd-skeleton" />
        <div className="vd-streak-state-copy">
          <span className="vd-skeleton vd-skeleton-line vd-skeleton-line--sm" />
          <span className="vd-skeleton vd-skeleton-line vd-skeleton-line--lg" />
          <span className="vd-skeleton vd-skeleton-line" />
        </div>
      </section>
    );
  }

  if (!streak) {
    return (
      <section className="vd-streak vd-streak--state" aria-label="Daily streak">
        <span className="vd-streak-state-icon"><Icon name="local_fire_department" /></span>
        <div className="vd-streak-state-copy">
          <h2>Streak data is unavailable</h2>
          <p>{error ? 'We could not load your consistency data right now.' : 'Your streak will appear after your next dashboard refresh.'}</p>
        </div>
        {onRetry && (
          <button type="button" className="vd-btn vd-streak-retry" onClick={onRetry}>
            <Icon name="refresh" /> Retry
          </button>
        )}
      </section>
    );
  }

  const headline = readOnly
    ? 'Your live streak, at a glance.'
    : current <= 0
      ? 'Your next streak starts here.'
      : !activeToday
        ? `Keep your ${current}-day run alive.`
        : current === 1
          ? 'Day one starts now.'
          : current >= serverLongest
            ? "That's your best run yet."
            : 'You showed up today.';

  const subline = readOnly
    ? 'This reflects today’s live streak — not the past day you are reviewing.'
    : current <= 0
      ? 'Log a workout, a meal, or a recovery check-in. Any one starts the count.'
      : !activeToday
        ? 'Any workout, meal, or check-in today keeps the flame going. There is still time.'
        : current === 1
          ? 'The first day is the hardest. Come back tomorrow to build on it.'
          : 'Every small action counts. Return tomorrow to keep the momentum going.';

  const statusText = readOnly ? 'Live streak' : activeToday ? 'Today counts' : 'Not counted yet';

  return (
    <>
      <section
        className={`vd-streak${readOnly ? ' is-readonly' : ''}${celebrating && !readOnly ? ' is-celebrating' : ''}`}
        aria-labelledby="vd-streak-heading"
      >
        <div className="vd-streak-hero">
          <div className="vd-streak-hero-top">
            <span className="vd-streak-eyebrow">
              <Icon name="local_fire_department" />
              Daily streak
            </span>
            <span className={`vd-streak-status${activeToday ? ' is-active' : ''}`}>
              <span className="vd-streak-status-dot" aria-hidden="true" />
              {statusText}
            </span>
          </div>

          <div className="vd-streak-hero-main">
            <Flame celebrating={celebrating && !readOnly} />
            <div className="vd-streak-hero-copy">
              <p className="vd-streak-countline">
                <span className={`vd-streak-count${celebrating && !readOnly ? ' is-celebrating' : ''}`}>{current}</span>
                <span className="vd-streak-count-label">day{current === 1 ? '' : 's'} streak</span>
              </p>
              <h2 id="vd-streak-heading" className="vd-streak-title">{headline}</h2>
              <p className="vd-streak-sub">{subline}</p>
            </div>
          </div>

          <div className="vd-streak-hero-stats">
            <div>
              <strong>{longest}</strong>
              <span>Best run</span>
            </div>
            <div>
              <strong>{activeThisWeek}<small>/7</small></strong>
              <span>This week</span>
            </div>
            <div>
              <strong>{activeDays90}</strong>
              <span>Last 90 days</span>
            </div>
          </div>

          <p className="vd-streak-rule">
            <Icon name="info" />
            Workouts, meals, and recovery check-ins each count once per day.
          </p>
        </div>

        <div className="vd-streak-week-block">
          <div className="vd-streak-block-head">
            <div>
              <h3>This week</h3>
              <p>{rangeLabel(streak.weekStart, streak.weekEnd)} · Mon–Sun</p>
            </div>
            <span className="vd-streak-mini-chip">{activeThisWeek}/7 days</span>
          </div>
          <WeekStrip week={week} />
        </div>

        <div className="vd-streak-today-block">
          <div className="vd-streak-block-head">
            <div>
              <h3>{readOnly ? 'Daily progress' : "Today's progress"}</h3>
              <p>{readOnly ? 'Actions are available on today' : 'Any one keeps the streak alive.'}</p>
            </div>
            <span className={`vd-streak-mini-chip${doneCount > 0 && !readOnly ? ' is-success' : ''}`}>
              {readOnly
                ? (activeToday ? 'Today counted' : 'Not counted today')
                : `${doneCount}/3 done`}
            </span>
          </div>

          {readOnly ? (
            <div className="vd-streak-readonly-note">
              <Icon name="history" />
              <p>Past days are read-only. The activity panel above is for today.</p>
            </div>
          ) : (
            <ul className="vd-streak-actions">
              <TodayRow
                icon="fitness_center"
                label="Workout"
                detail={doneWorkout
                  ? (workoutCount > 0
                    ? `${workoutCount} session${workoutCount === 1 ? '' : 's'} logged today`
                    : 'Logged today')
                  : 'Movement of any kind counts'}
                done={doneWorkout}
                action={doneWorkout ? 'View' : 'Start'}
                onAction={onStartWorkout}
              />
              <TodayRow
                icon="restaurant"
                label="Meal"
                detail={doneMeal
                  ? (mealCount > 0
                    ? `${mealCount} meal${mealCount === 1 ? '' : 's'} logged today`
                    : 'Logged today')
                  : 'Log what you eat — no perfect meal required'}
                done={doneMeal}
                action={doneMeal ? 'View' : 'Log'}
                onAction={doneMeal ? onViewMeals : onLogMeal}
              />
              <TodayRow
                icon="monitor_heart"
                label="Recovery check-in"
                detail={doneCheckin
                  ? 'Sleep, stress, and energy saved'
                  : 'A 30-second read on how you feel'}
                done={doneCheckin}
                action={doneCheckin ? 'Update' : 'Check in'}
                onAction={onCheckIn}
              />
            </ul>
          )}
        </div>

        <div className="vd-streak-mile-block">
          <div className="vd-streak-block-head">
            <div>
              <h3>Milestones</h3>
              <p>{nextMilestone ? `${nextMilestone - current} day${nextMilestone - current === 1 ? '' : 's'} to the next` : 'Every milestone reached'}</p>
            </div>
            <span className="vd-streak-mini-chip">{nextMilestone ? `Next ${nextMilestone}d` : 'All reached'}</span>
          </div>

          <div className="vd-streak-mile-track" aria-hidden="true">
            <span style={{ width: `${milestonePct}%` }} />
          </div>

          <div className="vd-streak-miles" role="list" aria-label="Streak milestones">
            {MILESTONES.map((m) => {
              const done = current >= m;
              const isNext = m === nextMilestone;
              return (
                <span
                  key={m}
                  role="listitem"
                  className={`vd-streak-mile${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
                  aria-label={`${m}-day milestone ${done ? 'reached' : isNext ? 'next' : 'not reached yet'}`}
                >
                  <i aria-hidden="true">{done ? <Icon name="check" /> : m}</i>
                  <span aria-hidden="true">{m}d</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="vd-streak-history-block">
          <div className="vd-streak-history-copy">
            <div className="vd-streak-block-head">
              <div>
                <h3>Consistency</h3>
                <p>Last 90 days · {activeDays90} active</p>
              </div>
            </div>
            <span className="vd-streak-legend" aria-hidden="true">
              <span>Less</span>
              <i className="is-l0" />
              <i className="is-l1" />
              <i className="is-l2" />
              <i className="is-l3" />
              <span>More</span>
            </span>
          </div>
          <HeatGrid history={history} today={today} activeDays={activeDays90} />
        </div>
      </section>

      <Modal
        isOpen={successOpen && !readOnly}
        onClose={dismissSuccess}
        title="Daily streak"
        size="sm"
        hideClose
        headerClassName="sr-only"
        className="vd-streak-modal"
      >
        <div className="vd-streak-success">
          <button
            type="button"
            className="vd-streak-success-close"
            onClick={dismissSuccess}
            aria-label="Close streak celebration"
          >
            <Icon name="close" />
          </button>

          <div className="vd-streak-success-art">
            <Flame size="lg" celebrating />
          </div>

          <span className="vd-streak-success-eyebrow">Daily streak</span>
          <p className="vd-streak-success-count">
            <strong>{current}</strong>
            <span>day{current === 1 ? '' : 's'} streak</span>
          </p>
          <h2 className="vd-streak-success-title">You showed up today.</h2>
          <p className="vd-streak-success-sub">
            A workout, a meal, or a check-in — every small action counts. Come back tomorrow to keep the flame alive.
          </p>

          <div className="vd-streak-success-week">
            <WeekStrip week={week} compact />
          </div>

          <button type="button" className="vd-streak-success-btn" onClick={dismissSuccess}>
            Nice — back to my day
            <Icon name="arrow_forward" />
          </button>
        </div>
      </Modal>
    </>
  );
};

export default StreakJourney;
