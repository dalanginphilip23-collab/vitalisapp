import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';
import { REST_ACTIVITY_TYPES, formatExerciseDetail } from '../utils/planFormat.js';

const DayTracker = ({ plan, content, progress, onClose, onCompleteDay }) => {
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

  // EMPTY STATE
  if (totalDays === 0) {
    return (
      <div
        className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg-primary)]"
        style={{ animation: 'fadeIn 0.25s ease' }}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b bg-[var(--bg-secondary)] border-[var(--border-light)]"
        >
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-medium transition-colors text-[var(--text-muted)]"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span className="hidden min-[480px]:inline">Back to Plans</span>
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">
              {plan.title}
            </p>
          </div>
          <div className="w-8 sm:w-[88px]" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border bg-[var(--accent-bg)] border-[var(--accent-border)]"
          >
            <Icon name="hourglass_empty" className="text-[24px] sm:text-[28px] text-[var(--accent)]" fill={1} />
          </div>
          <p className="text-base sm:text-lg font-black text-[var(--text-primary)]">Schedule coming soon</p>
          <p className="text-sm max-w-xs leading-relaxed text-[var(--text-muted)]">
            "{plan.title}" doesn't have its daily content set up yet. Check back shortly.
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-lg font-bold text-sm bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]"
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
    // The day's exercise list travels along so the workout screen can
    // auto-select each workout in order — no manual picking.
    const exercises = (activeDayData.exercises || []).map((ex) => ({
      name:             ex.name,
      sets:             ex.sets ?? null,
      reps:             ex.reps ?? null,
      durationSeconds:  ex.durationSeconds ?? null,
      restSeconds:      ex.restSeconds ?? null,
    }));
    navigate('/dashboard/workouts', {
      state: {
        fromPlan: {
          planId:       plan.id,
          planTitle:    plan.title,
          dayNumber:    activeDayData.day_number,
          dayTitle:     activeDayData.title,
          activityType: activeDayData.activity_type,
          description:  activeDayData.description,
          durationMins: activeDayData.duration_mins,
          exercises,
        },
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg-primary)]"
      style={{ animation: 'fadeIn 0.25s ease' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0 bg-[var(--bg-secondary)] border-[var(--border-light)]"
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <Icon name="arrow_back" className="text-[16px] sm:text-[18px]" />
          <span className="hidden min-[480px]:inline">Back to Plans</span>
        </button>
        <div className="text-center flex-1 px-2 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest truncate max-w-[140px] sm:max-w-none mx-auto text-[var(--text-muted)]">
            {plan.title}
          </p>
          <p className="text-[10px] sm:text-xs font-bold text-[var(--accent)]">
            {completedDays.length}/{totalDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden min-[480px]:block shrink-0">
            <p className="text-base sm:text-lg font-black text-[var(--accent)]">{progressPct}%</p>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-[var(--text-muted)]">Progress</p>
          </div>
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-light)] text-[var(--text-muted)]"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle day list"
          >
            <Icon name="calendar_view_week" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 sm:h-1 w-full flex-shrink-0 bg-[var(--border-light)]">
        <div
          className="h-full transition-all duration-700 ease-out bg-[var(--accent)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile day list overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-20 bg-[var(--bg-overlay)]"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-64 overflow-y-auto bg-[var(--bg-secondary)] border-r border-[var(--border-light)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--border-light)] flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Days</p>
                <button onClick={() => setSidebarOpen(false)} className="text-[var(--text-muted)]">
                  <Icon name="close" className="text-[18px]" />
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
                      {done ? <Icon name="check" className="text-[14px]" weight={700} /> : day.day_number}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {day.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{day.duration_mins} mins</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop day list sidebar */}
        <div
          className="hidden md:flex w-20 lg:w-56 border-r overflow-y-auto flex-shrink-0 flex-col bg-[var(--bg-secondary)] border-[var(--border-light)]"
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
                  {done ? <Icon name="check" className="text-[12px] lg:text-[14px]" weight={700} /> : day.day_number}
                </div>
                <div className="hidden lg:block overflow-hidden">
                  <p className="text-xs font-bold truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {day.title}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">{day.duration_mins} mins</p>
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
                  className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[var(--accent)] bg-[var(--accent-bg)] border-[var(--accent-border)]"
                >
                  Day {activeDayData.day_number}
                </span>
                <span
                  className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[var(--text-muted)] bg-[var(--bg-hover)]"
                >
                  {activeDayData.activity_type}
                </span>
                {isDayComplete && (
                  <span
                    className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[var(--success)] bg-[var(--success-bg)] border-[var(--success)]"
                  >
                    ✓ Completed
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4 leading-tight text-[var(--text-primary)]">
                {activeDayData.title}
              </h1>
              <p className="text-sm leading-relaxed mb-6 sm:mb-8 text-[var(--text-muted)]">
                {activeDayData.description}
              </p>

              <div
                className="rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border bg-[var(--bg-tertiary)] border-[var(--border-light)]"
              >
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border flex-shrink-0 bg-[var(--accent-bg)] border-[var(--accent-border)]"
                  >
                    <Icon name="fitness_center" className="text-[18px] sm:text-[20px] text-[var(--accent)]" fill={1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest mb-0.5 text-[var(--text-muted)]">
                      Today's Session
                    </p>
                    <p className="text-xs sm:text-sm font-bold truncate text-[var(--text-primary)]">
                      {activeDayData.activity_type}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                      {activeDayData.duration_mins}
                    </p>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold text-[var(--text-muted)]">minutes</p>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {activeDayData.exercises && activeDayData.exercises.length > 0 ? (
                    activeDayData.exercises.map((ex, idx) => (
                      <div
                        key={`${activeDayData.day_number}-${idx}`}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border bg-[var(--bg-hover)] border-[var(--border-light)]"
                      >
                        <span className="text-[9px] sm:text-[10px] font-black w-5 sm:w-6 flex-shrink-0 text-[var(--text-muted)]">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <Icon name="fitness_center" className="text-[14px] sm:text-[16px] flex-shrink-0 text-[var(--text-muted)]" fill={1} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate text-[var(--text-primary)]">{ex.name}</p>
                          <p className="text-[10px] sm:text-[11px] truncate text-[var(--text-muted)]">{formatExerciseDetail(ex)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border bg-[var(--bg-hover)] border-[var(--border-light)]"
                    >
                      <Icon name="info" className="text-[16px] flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
                      <p className="text-[11px] text-[var(--text-muted)]">
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
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl border font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border-[var(--border-medium)] text-[var(--text-muted)]"
                  >
                    <Icon name="skip_next" className="text-[18px] shrink-0" />
                    <span className="hidden min-[480px]:inline">Skip for Now</span>
                    <span className="min-[480px]:hidden">Skip</span>
                  </button>
                )}

                {isDayComplete ? (
                  <button
                    disabled
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2 bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)] cursor-default"
                  >
                    <Icon name="verified" className="text-[18px] shrink-0" fill={1} /> Day Complete
                  </button>
                ) : isRestDay ? (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] disabled:opacity-70"
                  >
                    {completing ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><Icon name="check_circle" className="text-[18px] shrink-0" fill={1} /> Mark Complete</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleStartWorkout}
                    className="flex-1 py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]"
                  >
                    <Icon name="play_circle" className="text-[18px] shrink-0" fill={1} /> Start Workout
                  </button>
                )}
              </div>

              {!isDayComplete && (
                <p className="text-center text-[10px] sm:text-[11px] mt-3 sm:mt-4 text-[var(--text-muted)]">
                  {isRestDay
                    ? `Complete this day to unlock Day ${activeDayData.day_number + 1}`
                    : `Finish your workout session to automatically unlock Day ${activeDayData.day_number + 1}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTracker;
