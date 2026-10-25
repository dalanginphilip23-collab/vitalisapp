// Dashboard presentation widgets (Reference A: mobile, Reference B: desktop).
// Presentational only — every number arrives as a prop derived from the
// existing dashboard hooks, so no fetching or business logic lives here.
// Styling is scoped under `.vdash` in ../dashboard.css.
import Icon from '../../../../components/Icon.jsx';
import { resolveAvatar, capitalizeName, getInitials } from '../../../../lib/avatar.js';
import { clampPct, minutesFromSeconds, workoutLabel, fmtClock, fmtShortDate, isToday } from '../lib/dashboardFormat.js';

/* ── Shared primitives (dashboard-local) ───────────────────────────── */

const IconTile = ({ name, small = false }) => (
  <span className={`vd-icon-tile${small ? ' vd-icon-tile--sm' : ''}`}><Icon name={name} /></span>
);

const ProgressBar = ({ value }) => (
  <div className="vd-progress"><span style={{ width: `${clampPct(value)}%` }} /></div>
);

const MiniRow = ({ label, value }) => (
  <div className="vd-mini-row"><span>{label}</span><strong>{value}</strong></div>
);

const TextButton = ({ onClick, icon = null, children = null, ariaLabel = undefined }) => (
  <button type="button" className="vd-text-btn" onClick={onClick} aria-label={ariaLabel}>
    {children}
    {icon && <Icon name={icon} style={{ fontSize: 14 }} />}
  </button>
);

const EmptyPrompt = ({ icon, title, children, onClick }) => (
  <button type="button" className="vd-empty" onClick={onClick}>
    <Icon name={icon} />
    <span>
      <strong>{title}</strong>
      {children}
    </span>
  </button>
);

const CardHead = ({ icon = null, title, sub = '', action = null, chip = null }) => (
  <div className="vd-card-head">
    <div className={icon ? 'vd-ai-head' : undefined}>
      {icon && <IconTile name={icon} />}
      <div>
        <h2 className="vd-card-title">{title}</h2>
        {sub && <p className="vd-card-sub">{sub}</p>}
      </div>
    </div>
    {action || (chip && (
      <span className={`vd-chip${chip.accent ? ' vd-chip--accent' : ''}`}>{chip.label}</span>
    ))}
  </div>
);

/* ── Topbar slots ───────────────────────────────────────────────────── */

export const DashboardGreeting = ({ name, avatar }) => {
  const display = capitalizeName(name || 'Member');
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const resolved = resolveAvatar(avatar, display);
  return (
    <div className="vd-greeting">
      <span className="vd-greeting-avatar">
        {resolved.kind === 'image' ? <img src={resolved.src} alt="" /> : getInitials(display)}
      </span>
      <span className="vd-greeting-copy">
        <span className="vd-greeting-small">{part}</span>
        <span className="vd-greeting-name">{display}</span>
      </span>
    </div>
  );
};

/* ── Hero ───────────────────────────────────────────────────────────── */

export const DashboardHero = ({
  remaining = 0,
  goalLabelText = 'Vitalis',
  foodKcal = 0,
  caloriesBurned = 0,
  workoutMinToday = 0,
  workoutGoalMin = 0,
  onLogActivity = undefined,
  onStartWorkout = undefined,
  eyebrow = 'Today',
  readOnly = false,
}) => (
  <section className="vd-hero" aria-label="Today's activity summary">
    <div className="vd-hero-media">
      <img src="/hero-gym-card.webp" alt="" width={900} height={600} loading="eager" decoding="async" />
    </div>
    <div className="vd-hero-content">
      <div>
        <span className="vd-hero-eyebrow">
          <Icon name="bolt" style={{ fontSize: 13 }} /> {eyebrow} · {goalLabelText}
        </span>
        <p className="vd-hero-value">
          {remaining.toLocaleString()}
          <small>kcal remaining {eyebrow === 'Today' ? 'today' : 'that day'}</small>
        </p>
        <div className="vd-hero-meta">
          <span><Icon name="restaurant" />{foodKcal.toLocaleString()} kcal eaten</span>
          <span><Icon name="local_fire_department" />{caloriesBurned.toLocaleString()} kcal burned</span>
          <span><Icon name="timer" />{workoutMinToday} / {workoutGoalMin} min</span>
        </div>
      </div>
      {!readOnly && (
        <div className="vd-hero-actions">
          <button type="button" className="vd-btn vd-btn--primary" onClick={onLogActivity}>
            Log activity
            <span className="vd-btn-arrow"><Icon name="arrow_forward" /></span>
          </button>
          <button type="button" className="vd-btn vd-btn--ghost-light" onClick={onStartWorkout}>
            <Icon name="fitness_center" /> Start workout
          </button>
        </div>
      )}
    </div>
  </section>
);

/* ── Weekly activity ───────────────────────────────────────────────── */

const GRID_LINES = [
  { bottom: 100, label: '100%' },
  { bottom: 75, label: null },
  { bottom: 50, label: '50%' },
  { bottom: 25, label: null },
  { bottom: 0, label: '0' },
];

export const WeeklyActivityCard = ({
  days = [],
  totalMinutes = 0,
  averageMinutes = 0,
  goalMinutes = 0,
  onLogActivity = undefined,
}) => {
  const hasData = days.some((d) => d.minutes > 0);
  const max = Math.max(goalMinutes, ...days.map((d) => d.minutes), 1);
  const pctOfMax = (m) => clampPct((m / max) * 100);
  const avgPct = clampPct((averageMinutes / max) * 100);
  const peak = days.reduce((a, b) => (b.minutes > a.minutes ? b : a), days[0] || { minutes: 0 });

  return (
    <section className="vd-card vd-weekly-card">
      <CardHead
        title="Weekly Activity"
        sub={`Last 7 days · avg ${averageMinutes} min`}
        chip={{ label: `${totalMinutes} min`, accent: true }}
      />

      {!hasData ? (
        <div className="vd-chart-empty" role="status">
          <Icon name="insights" />
          <span>No workouts logged in the last 7 days.</span>
          <button type="button" onClick={onLogActivity}>Log your first activity</button>
        </div>
      ) : (
        <div className="vd-chart-wrap">
          <div className="vd-chart-grid" aria-hidden="true">
            {GRID_LINES.map((line) => (
              <span key={line.bottom}>
                <span className="vd-chart-line" style={{ bottom: `${line.bottom}%` }} />
                {line.label && (
                  <span className="vd-chart-axis" style={{ bottom: `${line.bottom}%` }}>{line.label}</span>
                )}
              </span>
            ))}
            <span className="vd-chart-line" style={{ bottom: `${avgPct}%`, borderColor: 'var(--accent-border)' }} />
          </div>
          <div className="vd-chart-bars">
            {days.map((d) => (
              <div key={d.date.toISOString()} className={`vd-bar-col${d.isToday ? ' vd-bar-col--today' : ''}`}>
                {peak.minutes > 0 && d.date.toDateString() === peak.date.toDateString() && (
                  <span className="vd-bar-tooltip" style={{ bottom: `calc(${pctOfMax(d.minutes)}% + 8px)` }}>
                    {d.minutes} min
                  </span>
                )}
                <div className="vd-bar-track" title={`${d.minutes} min`}>
                  {d.minutes > 0 && (
                    <div className="vd-bar-fill" style={{ height: `${Math.max(8, pctOfMax(d.minutes))}%` }} />
                  )}
                </div>
                <span className="vd-bar-labels">
                  <span className="vd-bar-day">{d.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="vd-bar-date">{d.date.getDate()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export const NextSessionCard = ({ kicker = 'Up next', title = '', sub = '', time = '', onClick = undefined }) => (
  <button type="button" className="vd-next" onClick={onClick}>
    <IconTile name="exercise" small />
    <span className="vd-next-copy">
      <span className="vd-next-kicker">{kicker}</span>
      <span className="vd-next-title">{title}</span>
      <span className="vd-next-sub">{sub}</span>
    </span>
    <span className="vd-next-side">
      {time && <span className="vd-next-time"><Icon name="schedule" />{time}</span>}
      <span className="vd-arrow-btn"><Icon name="arrow_forward" /></span>
    </span>
  </button>
);

/* ── Today's plan ──────────────────────────────────────────────────── */

export const TodaysPlanCard = ({
  activeKcal = 0,
  rows = [],
  plan = null,
  plansLoading = false,
  onLogActivity = undefined,
  onOpenPlan = undefined,
  onOpenPlans = undefined,
  title = "Today's Plan",
  sub = 'Your targets for today',
  readOnly = false,
}) => (
  <section className="vd-card vd-plan-card">
    <CardHead
      title={title}
      sub={sub}
      chip={plan ? { label: plan.tag || 'Enrolled', accent: true } : null}
    />

    <div className="vd-plan-banner">
      <IconTile name="local_fire_department" />
      <div>
        <span className="vd-plan-kcal">{activeKcal.toLocaleString()}</span>
        <span className="vd-plan-kcal-label">Active calories burned</span>
      </div>
    </div>

    <div className="vd-plan-rows">
      {rows.map((r) => (
        <div className="vd-plan-row" key={r.label}>
          <span className="vd-plan-row-icon"><Icon name={r.icon} /></span>
          <div className="vd-plan-row-main">
            <div className="vd-plan-row-top">
              <span className="vd-plan-row-label">{r.label}</span>
              <span className="vd-plan-row-value"><strong>{r.value}</strong>{r.valueSuffix ? ` ${r.valueSuffix}` : ''}</span>
            </div>
            <ProgressBar value={r.pct} />
          </div>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '15px', color: r.done ? 'var(--accent)' : 'var(--text-disabled)' }}
            aria-hidden="true"
          >
            {r.done ? 'check_circle' : 'radio_button_unchecked'}
          </span>
        </div>
      ))}
    </div>

    <div className="vd-plan-cta">
      {!readOnly && (
        <button type="button" className="vd-btn vd-btn--primary" onClick={onLogActivity}>
          Log Activity
          <span className="vd-plus-circle"><Icon name="add" /></span>
        </button>
      )}
    </div>

    <div className="vd-plan-footer">
      <div className="vd-plan-footer-copy">
        <span className="vd-plan-footer-title">
          {plansLoading ? 'Loading your plans…' : plan ? (plan.title || plan.name || 'Training plan') : 'No enrolled plan yet'}
        </span>
        <span className="vd-plan-footer-sub">
          {plansLoading
            ? 'Checking your enrollments'
            : plan
              ? [plan.tag, plan.intensity].filter(Boolean).join(' · ') || 'Tap to open your plan'
              : 'Explore training plans to build today\u2019s schedule'}
        </span>
      </div>
      <button type="button" onClick={plan ? onOpenPlan : onOpenPlans} disabled={plansLoading}>
        {plan ? 'Open plan' : 'Explore plans'}
      </button>
    </div>
  </section>
);

/* ── Quick actions (mobile) ────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { key: 'meal', label: 'Meal', icon: 'restaurant' },
  { key: 'workout', label: 'Workout', icon: 'fitness_center' },
  { key: 'activity', label: 'Activity', icon: 'directions_run' },
  { key: 'sleep', label: 'Sleep', icon: 'bedtime' },
  { key: 'checkin', label: 'Check-in', icon: 'fact_check' },
];

export const QuickActions = ({ onAction = undefined }) => (
  <div className="vd-quick-row">
    {QUICK_ACTIONS.map((a) => (
      <button type="button" key={a.key} className="vd-quick-item" onClick={() => onAction?.(a.key)}>
        <span className="vd-quick-circle"><Icon name={a.icon} /></span>
        <span className="vd-quick-label">{a.label}</span>
      </button>
    ))}
  </div>
);

/* ── Stat cards + macro focus ──────────────────────────────────────── */

export const StatCard = ({ icon, label, value, unit = '', note = '', footLeft = '', footRight = '', progress = null, tone = '' }) => (
  <div className={`vd-stat${tone ? ` ${tone}` : ''}`}>
    <div className="vd-stat-top">
      <span className="vd-stat-label">{label}</span>
      <IconTile name={icon} small />
    </div>
    <div>
      <p className="vd-stat-value">{value}{unit && <small>{unit}</small>}</p>
      {note && <p className="vd-card-sub">{note}</p>}
    </div>
    <div className="vd-stat-foot">
      <ProgressBar value={progress} />
      <div className="vd-stat-note"><span>{footLeft}</span><strong>{footRight}</strong></div>
    </div>
  </div>
);

export const MacroFocusCard = ({ macroPct = 0, rows = [], onAddFood = undefined, onSetGoal = undefined, readOnly = false }) => {
  const hasTargets = rows.length > 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="vd-card vd-macro">
      <CardHead
        title="Macro Focus"
        sub={readOnly ? 'Intake vs targets on this day' : "Today's intake vs targets"}
        action={readOnly ? null : <TextButton onClick={onAddFood} icon="arrow_forward">Add food</TextButton>}
      />

      {hasTargets ? (
        <div className="vd-macro-body">
          <div className="vd-macro-ring">
            <svg viewBox="0 0 122 122" aria-hidden="true">
              <circle cx="61" cy="61" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="10" />
              <circle
                cx="61" cy="61" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(c * clampPct(macroPct)) / 100} ${c}`}
              />
            </svg>
            <div className="vd-macro-ring-center">
              <span className="vd-macro-ring-value">{clampPct(macroPct)}%</span>
              <span className="vd-macro-ring-label">of daily goal</span>
            </div>
          </div>
          <div className="vd-macro-rows">
            {rows.map((m) => (
              <div key={m.label}>
                <div className="vd-macro-row-top">
                  <span><span className="vd-macro-dot" />{m.label}</span>
                  <span><strong>{m.actual}{m.unit}</strong> / {m.target}{m.unit}</span>
                </div>
                <ProgressBar value={m.target ? (m.actual / m.target) * 100 : 0} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyPrompt icon="egg_alt" title="No macro targets yet" onClick={onSetGoal}>
          Set a fitness goal to unlock personalized macro tracking
        </EmptyPrompt>
      )}
    </div>
  );
};

/* ── Lower row cards ───────────────────────────────────────────────── */

export const WorkoutProgressCard = ({ pct = 0, rows = [], onOpen = undefined }) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="vd-card vd-lower-card">
      <CardHead
        title="Workout Progress"
        sub="Today vs your goal"
        action={<TextButton onClick={onOpen} icon="arrow_forward">Open</TextButton>}
      />
      <div className="vd-donut-layout">
        <div className="vd-donut">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="9" />
            <circle
              cx="48" cy="48" r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${(c * clampPct(pct)) / 100} ${c}`}
            />
          </svg>
          <div className="vd-donut-center">
            <span className="vd-donut-value">{clampPct(pct)}%</span>
            <span className="vd-donut-label">Complete</span>
          </div>
        </div>
        <div className="vd-mini-rows">
          {rows.map((row) => <MiniRow key={row.label} label={row.label} value={row.value} />)}
        </div>
      </div>
    </div>
  );
};

export const RecoveryCard = ({ readiness = null, note = '', rows = [], hasCheckIn = false, onCheckIn = undefined, readOnly = false }) => {
  const r = 54;
  const len = Math.PI * r;
  return (
    <div className="vd-card vd-lower-card vd-recovery-card">
      <CardHead
        title="Recovery"
        sub="Readiness from your check-in"
        chip={{ label: hasCheckIn ? 'Checked in' : 'No check-in', accent: hasCheckIn }}
      />

      {readiness != null ? (
        <>
          <div className="vd-gauge">
            <svg viewBox="0 0 132 76" aria-hidden="true">
              <path d="M 12 66 A 54 54 0 0 1 120 66" fill="none" stroke="var(--bg-hover)" strokeWidth="10" strokeLinecap="round" />
              <path
                d="M 12 66 A 54 54 0 0 1 120 66" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(len * clampPct(readiness)) / 100} ${len}`}
              />
            </svg>
            <div className="vd-gauge-center">
              <span className="vd-gauge-value">{readiness}<small>/100</small></span>
              <span className="vd-gauge-label">Readiness</span>
            </div>
          </div>
          <div className="vd-recovery-rows">
            {rows.map((row) => <MiniRow key={row.label} label={row.label} value={row.value} />)}
          </div>
        </>
      ) : (
        <div className="vd-chart-empty" role="status">
          <Icon name="monitor_heart" />
          <span>Check in to see your readiness score.</span>
        </div>
      )}

      {note && <p className="vd-ai-note">{note}</p>}

      <div className="vd-recovery-cta">
        {!readOnly && (
          <button type="button" className="vd-btn" onClick={onCheckIn}>
            {hasCheckIn ? 'Update check-in' : 'Daily check-in'}
          </button>
        )}
      </div>
    </div>
  );
};

export const MotivationCard = ({ streak = 0, onOpenWorkouts = undefined }) => (
  <div className="vd-motivation">
    <div className="vd-motivation-bg">
      <img src="/hero-gym-card-mobile.webp" alt="" loading="lazy" decoding="async" />
    </div>
    <span className="vd-motivation-kicker"><Icon name="bolt" style={{ fontSize: 13 }} /> Motivation</span>
    <h2 className="vd-motivation-title">Keep pushing your limits.</h2>
    <p className="vd-motivation-sub">
      {streak > 0
        ? `${streak}-day streak alive — one session today keeps it going.`
        : 'One session today starts your next streak.'}
    </p>
    <button type="button" className="vd-btn vd-motivation-btn" onClick={onOpenWorkouts}>
      <Icon name="fitness_center" /> Start a workout
    </button>
  </div>
);

export const ThisWeekCard = ({ rows = [], goal = null, goalText = 'Not set', progressPct = null, onOpenGoal = undefined, onSetGoal = undefined }) => (
  <div className="vd-card vd-lower-card">
    <CardHead title="This Week" sub="Last 7 days at a glance" />
    <div className="vd-week-rows">
      {rows.map((r) => (
        <div className="vd-week-row" key={r.label}>
          <IconTile name={r.icon} small />
          <div className="vd-week-row-copy">
            <span className="vd-week-row-label">{r.label}</span>
            <span className="vd-week-row-value">{r.value}</span>
          </div>
        </div>
      ))}
    </div>
    <button type="button" className="vd-goal-btn" onClick={goal ? onOpenGoal : onSetGoal}>
      <div className="vd-goal-top">
        <span className="vd-goal-label">{goal ? 'Goal' : 'Fitness goal'}</span>
        <span className="vd-goal-value">{goalText}</span>
      </div>
      <div className="vd-goal-track">
        {progressPct != null ? (
          <>
            <ProgressBar value={progressPct} />
            <span className="vd-goal-pct">{clampPct(progressPct)}%</span>
          </>
        ) : (
          <span className="vd-goal-pct">{goal ? 'View details →' : 'Set up →'}</span>
        )}
      </div>
    </button>
  </div>
);

/* ── Bottom: workouts + AI coach ───────────────────────────────────── */

export const RecentWorkoutsCard = ({ workouts = [], subtitle = '', onOpenWorkouts = undefined, title = 'Recent Workouts' }) => (
  <section className="vd-card">
    <CardHead
      title={title}
      sub={subtitle}
      action={<TextButton onClick={onOpenWorkouts} icon="arrow_forward">View all</TextButton>}
    />

    {workouts.length > 0 ? (
      <div className="vd-workout-list">
        {workouts.map((w) => {
          const seconds = Number(w.duration_seconds) || 0;
          const reps = Number(w.rep_count) || 0;
          const mins = Math.max(1, minutesFromSeconds(seconds));
          const when = isToday(w.start_time) ? fmtClock(w.start_time) : fmtShortDate(w.start_time);
          return (
            <button type="button" className="vd-workout-row" key={w.id} onClick={onOpenWorkouts}>
              <IconTile name={w.status === 'active' ? 'sensors' : 'fitness_center'} small />
              <span className="vd-workout-row-copy">
                <span className="vd-workout-row-title">{workoutLabel(w.workout_type)}</span>
                <span className="vd-workout-row-sub">
                  {w.status === 'active' ? 'In progress' : `${mins} min`}
                  {reps > 0 ? ` · ${reps} reps` : ''}
                  {when ? ` · ${when}` : ''}
                </span>
              </span>
              <span className="vd-workout-row-end">
                {w.status === 'active' ? 'Live' : `${mins} min`}
                <Icon name="arrow_forward" style={{ fontSize: 14 }} />
              </span>
            </button>
          );
        })}
      </div>
    ) : (
      <EmptyPrompt icon="fitness_center" title="No workouts logged yet" onClick={onOpenWorkouts}>
        Start a camera workout or log a session manually
      </EmptyPrompt>
    )}
  </section>
);

export const AiCoachCard = ({ aiRec = null, loading = false, onRefresh = undefined }) => {
  const summary = aiRec?.summary || null;
  const nutrition = summary?.nutrition || null;
  const projection = summary?.projection || null;

  return (
    <section className="vd-card vd-ai-card">
      <CardHead
        icon="auto_awesome"
        title="AI Coach"
        sub="Adapts to your data daily"
        action={<TextButton onClick={onRefresh} icon="refresh" ariaLabel="Refresh AI coaching">Refresh</TextButton>}
      />

      {loading ? (
        <div className="vd-ai-loading" role="status" aria-label="Loading AI coaching">
          <span /><span /><span />
        </div>
      ) : !aiRec?.goal ? (
        <EmptyPrompt icon="info" title="Coaching locked">
          Complete your onboarding to unlock personalized coaching
        </EmptyPrompt>
      ) : summary ? (
        <>
          <div className="vd-ai-grid">
            <div className="vd-ai-section">
              <div className="vd-eyebrow"><Icon name="target" /> Today&apos;s Focus</div>
              {summary.headline && <p className="vd-ai-headline">{summary.headline}</p>}
              {summary.bullets?.length > 0 && (
                <ul className="vd-ai-bullets">
                  {summary.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </div>

            {nutrition && (
              <div className="vd-ai-section">
                <div className="vd-eyebrow"><Icon name="restaurant" /> What to Eat</div>
                {nutrition.gaps && (
                  <div className="vd-ai-gaps">
                    {nutrition.gaps.kcal != null && (
                      <span className="vd-ai-gap"><strong>{Math.round(nutrition.gaps.kcal)}</strong><span>kcal left</span></span>
                    )}
                    {nutrition.gaps.protein != null && (
                      <span className="vd-ai-gap"><strong>{Math.round(nutrition.gaps.protein)}g</strong><span>protein</span></span>
                    )}
                    {nutrition.gaps.carbs != null && (
                      <span className="vd-ai-gap"><strong>{Math.round(nutrition.gaps.carbs)}g</strong><span>carbs</span></span>
                    )}
                    {nutrition.gaps.fat != null && (
                      <span className="vd-ai-gap"><strong>{Math.round(nutrition.gaps.fat)}g</strong><span>fat</span></span>
                    )}
                  </div>
                )}
                {nutrition.suggestions?.length > 0 && (
                  <div className="vd-ai-foods">
                    {nutrition.suggestions.map((s) => (
                      <div className="vd-ai-food" key={s.name}>
                        <IconTile name="restaurant_menu" small />
                        <span className="vd-ai-food-copy">
                          <span className="vd-ai-food-name">{s.name}</span>
                          <span className="vd-ai-food-meta">{s.unit} · {s.kcal} kcal</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {nutrition.note && <p className="vd-ai-note">{nutrition.note}</p>}
              </div>
            )}
          </div>

          {projection?.available && (
            <div className="vd-ai-foot">
              <span className="vd-ai-weeks">
                {projection.weeksToTarget > 0 ? `~${projection.weeksToTarget}` : '0'}<span> weeks</span>
              </span>
              <span className="vd-ai-foot-divider" aria-hidden="true" />
              <span className="vd-ai-foot-copy">
                <strong>
                  {projection.direction === 'lose' ? 'To lose' : 'To gain'} {projection.weightDiffKg} kg
                </strong>
                <span>
                  {projection.weeklyRateKg > 0 ? '+' : ''}{projection.weeklyRateKg} kg/week
                  {projection.consistencyNote ? ` · ${projection.consistencyNote}` : ''}
                </span>
              </span>
            </div>
          )}
        </>
      ) : (
        <EmptyPrompt icon="auto_awesome" title="No recommendations yet">
          Log some activity to get suggestions
        </EmptyPrompt>
      )}
    </section>
  );
};
