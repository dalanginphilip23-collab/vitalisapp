import React from 'react';
import Icon from '../../../../components/Icon.jsx';

// All-time progress: one confident hero, three supporting numbers, then the
// human details (averages and a personal best). No charts without real data.
const ProgressArt = () => (
  <svg
    viewBox="0 0 420 300"
    className="am-progress-hero__art"
    fill="none"
    aria-hidden="true"
    preserveAspectRatio="xMidYMid slice"
  >
    <path
      d="M-24 232C40 222 64 138 126 150S204 232 254 184 318 76 378 92s62-30 108-58"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="5 9"
      opacity="0.35"
    />
    <path
      d="M-20 266C50 240 92 178 150 190s78 62 132 14 56-88 116-72 68-28 118-58"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      opacity="0.75"
    />
    <circle cx="150" cy="190" r="7" fill="var(--bg-card)" stroke="currentColor" strokeWidth="4" />
    <circle cx="382" cy="104" r="7" fill="var(--bg-card)" stroke="currentColor" strokeWidth="4" />
  </svg>
);

const formatBestDate = (date) => {
  const parsed = date ? new Date(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const StatCard = ({ icon, label, value, unit }) => (
  <div className="am-stat-card">
    <span className="am-stat-card__icon">
      <Icon name={icon} />
    </span>
    <span className="am-stat-card__label">{label}</span>
    <span className="am-stat-card__value">
      {value}
      {unit && <span className="am-stat-card__unit">{unit}</span>}
    </span>
  </div>
);

const LoadingState = () => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading statistics">
    <div className="am-skel-card">
      <div className="am-skel-line am-skel-line--sm" />
      <div className="am-skel-line" style={{ width: '48%', height: 52, marginTop: 18 }} />
      <div className="am-skel-line am-skel-line--sm" style={{ marginTop: 18 }} />
    </div>
    <div className="am-stat-grid">
      {[0, 1, 2].map((i) => (
        <div className="am-skel-card" key={i} style={{ borderRadius: 19 }}>
          <div className="am-skel-line" style={{ width: '44%', height: 26 }} />
          <div className="am-skel-line" style={{ width: '70%', marginTop: 16 }} />
        </div>
      ))}
    </div>
    <div className="am-skel-card">
      <div className="am-skel-line am-skel-line--sm" />
      <div className="am-skel-line" style={{ width: '100%', height: 46, marginTop: 14 }} />
    </div>
  </div>
);

const StatsTab = ({ stats, statsLoading, statsError, formatTime, isOverlay = false }) => {
  const totalRuns = Number(stats?.totalRuns) || 0;
  const totalDistance = parseFloat(stats?.totalDistance || 0);
  const totalDuration = parseInt(stats?.totalDuration, 10) || 0;
  const totalCalories = parseInt(stats?.totalCalories, 10) || 0;
  const bestRun = stats?.bestRun;

  const content = stats ? (
    <>
      <section className="am-progress-hero">
        <ProgressArt />
        <p className="am-eyebrow" style={{ position: 'relative', zIndex: 1 }}>Total distance</p>
        <div className="am-progress-hero__value">
          {totalDistance.toFixed(1)}
          <span className="am-progress-hero__unit">km</span>
        </div>
        <p className="am-progress-hero__meta">
          <Icon name="route" />
          {totalRuns} {totalRuns === 1 ? 'run' : 'runs'}
          <span aria-hidden="true">·</span>
          {formatTime(totalDuration)} moving
        </p>
      </section>

      <div className="am-stat-grid">
        <StatCard icon="directions_run" label="Runs" value={totalRuns} />
        <StatCard icon="timer" label="Moving time" value={formatTime(totalDuration)} />
        <StatCard icon="local_fire_department" label="Calories" value={totalCalories.toLocaleString()} unit="kcal" />
      </div>

      {totalRuns > 0 && (
        <section className="am-panel" style={{ marginTop: 12 }}>
          <div className="am-panel__head">
            <h3 className="am-panel__title">Average per run</h3>
            <span className="am-chip">{totalRuns} runs</span>
          </div>
          <div className="am-avg-grid">
            <div className="am-avg">
              <p className="am-avg__label">Distance</p>
              <p className="am-avg__value">
                {(totalDistance / totalRuns).toFixed(1)}
                <span className="am-avg__unit">km</span>
              </p>
            </div>
            <div className="am-avg">
              <p className="am-avg__label">Time</p>
              <p className="am-avg__value">{formatTime(Math.floor(totalDuration / totalRuns))}</p>
            </div>
            <div className="am-avg">
              <p className="am-avg__label">Calories</p>
              <p className="am-avg__value">
                {Math.floor(totalCalories / totalRuns)}
                <span className="am-avg__unit">kcal</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {bestRun && (
        <div className="am-best">
          <span className="am-best__icon">
            <Icon name="trophy" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="am-best__label">Longest effort</p>
            <p className="am-best__value">
              {Number(bestRun.distance).toFixed(1)} km
            </p>
            <p className="am-best__date">{formatBestDate(bestRun.date)}</p>
          </div>
          <span className="am-chip am-chip--accent hidden sm:inline-flex">Personal best</span>
        </div>
      )}
    </>
  ) : null;

  if (isOverlay) {
    return (
      <div className="p-3">
        {statsLoading && <LoadingState />}
        {statsError && <p className="py-6 text-center text-xs text-[var(--error)]">⚠ {statsError}</p>}
        {!statsLoading && !statsError && !stats && (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-[var(--text-primary)]">No statistics yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Complete a run to see progress.</p>
          </div>
        )}
        {!statsLoading && !statsError && content}
      </div>
    );
  }

  return (
    <div className="am-scroll">
      <div className="am-tabpage">
        <header className="am-tabpage__head">
          <div>
            <p className="am-eyebrow">All time</p>
            <h2 className="am-tabpage__title">Your progress</h2>
            <p className="am-tabpage__sub">
              Every kilometre adds up. Here is the shape of your running story so far.
            </p>
          </div>
          {totalRuns > 0 && (
            <span className="am-chip am-chip--accent">
              <Icon name="verified" className="text-[13px]" />
              {totalRuns} {totalRuns === 1 ? 'run' : 'runs'} logged
            </span>
          )}
        </header>

        {statsLoading && <LoadingState />}

        {statsError && (
          <div className="am-empty">
            <span className="am-empty__icon" style={{ borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', background: 'var(--error-bg)', color: 'var(--error)' }}>
              <Icon name="cloud_off" />
            </span>
            <p className="am-empty__title">Could not load your progress</p>
            <p className="am-empty__text">⚠ {statsError}. Check your connection and try again.</p>
          </div>
        )}

        {!statsLoading && !statsError && !stats && (
          <div className="am-empty">
            <span className="am-empty__icon">
              <Icon name="bar_chart" />
            </span>
            <p className="am-empty__title">No statistics yet</p>
            <p className="am-empty__text">
              Finish and save your first run — distance, pace and personal bests will collect here.
            </p>
          </div>
        )}

        {!statsLoading && !statsError && content}
      </div>
    </div>
  );
};

export default StatsTab;
