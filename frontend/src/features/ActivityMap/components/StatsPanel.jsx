import React, { useState } from 'react';

// Vitalis live stats: big tabular Distance hero, clean Time / Pace /
// Calories rows with dividers, and a splits table. No logic changes.
const StatRow = ({ label, value, highlight = false }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-light)] last:border-0">
    <p className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</p>
    <p className={`text-[15px] font-bold tabular-nums ${highlight ? 'text-[var(--accent-dark)] dark:text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
      {value}
    </p>
  </div>
);

const SplitsTable = ({ splits, compact = false }) => {
  if (splits.length === 0) {
    return <p className="text-[11px] text-[var(--text-muted)] text-center py-3">No splits yet — splits appear every kilometer.</p>;
  }
  return (
    <div className={compact ? 'max-h-[90px] overflow-y-auto no-scrollbar' : 'max-h-[220px] xl:max-h-none overflow-y-auto no-scrollbar'}>
      <div className="flex justify-between px-1 pb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-disabled)]">Split</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-disabled)]">Pace /km</span>
      </div>
      {splits.map((s) => (
        <div key={s.km} className="flex justify-between items-center px-1 py-1.5 border-t border-[var(--border-light)]">
          <span className="text-[12px] font-semibold text-[var(--text-muted)]">{s.km} km</span>
          <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{s.pace}</span>
        </div>
      ))}
    </div>
  );
};

const StatsPanel = ({ metrics, splits, formatTime, isDesktop, bare = false }) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Desktop sidebar ──────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="w-[300px] xl:w-[340px] 2xl:w-[380px] flex-shrink-0 bg-[var(--bg-card)] flex flex-col p-4 xl:p-5 overflow-y-auto border-l border-[var(--border-light)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Distance</p>
        <h2 className="text-4xl xl:text-5xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
          {metrics.distance.toFixed(2)}
          <span className="text-base font-semibold text-[var(--text-muted)] ml-1">km</span>
        </h2>

        <div className="mt-3 px-1">
          <StatRow label="Moving time" value={formatTime(metrics.time)} />
          <StatRow label="Average pace" value={`${metrics.pace} /km`} highlight />
          <StatRow label="Calories" value={metrics.calories} />
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1 px-1">Splits</p>
          <SplitsTable splits={splits} />
        </div>
      </div>
    );
  }

  // ── Mobile: floating stat card + expandable sheet ─────────────────────────
  // `bare` renders just the card (no fixed positioning) for embedding in a
  // shared bottom stack — keeps the card and Start button from overlapping.
  const mobileBar = (
    <button
      onClick={() => setSheetOpen(true)}
      aria-label="Expand run stats"
      className="w-full min-h-[56px] glass-card border border-[var(--border-light)] rounded-2xl px-4 py-2.5 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex-shrink-0 min-w-0 text-left">
          <p className="text-[9px] font-semibold text-[var(--text-muted)]">Distance</p>
          <p className="text-lg font-bold tabular-nums text-[var(--text-primary)] whitespace-nowrap leading-tight">
            {metrics.distance.toFixed(2)} <span className="text-[10px] font-semibold text-[var(--text-muted)]">km</span>
          </p>
        </div>
        <div className="flex-shrink-0 min-w-0 text-left">
          <p className="text-[9px] font-semibold text-[var(--text-muted)]">Time</p>
          <p className="text-lg font-bold tabular-nums text-[var(--text-primary)] whitespace-nowrap leading-tight">{formatTime(metrics.time)}</p>
        </div>
        <div className="hidden min-[380px]:block flex-shrink-0 min-w-0 text-left">
          <p className="text-[9px] font-semibold text-[var(--text-muted)]">Pace</p>
          <p className="text-lg font-bold tabular-nums text-[var(--accent-dark)] dark:text-[var(--accent)] whitespace-nowrap leading-tight">{metrics.pace}</p>
        </div>
      </div>
      <span className="material-symbols-outlined text-[20px] text-[var(--text-muted)] shrink-0">expand_less</span>
    </button>
  );

  const mobileSheet = (
    <div className="w-full glass-card border border-[var(--border-light)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Activity</p>
        <button
          onClick={() => setSheetOpen(false)}
          aria-label="Collapse run stats"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">expand_more</span>
        </button>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Distance</p>
      <p className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
        {metrics.distance.toFixed(2)}
        <span className="text-sm font-semibold text-[var(--text-muted)] ml-1">km</span>
      </p>
      <div className="mt-1 px-1">
        <StatRow label="Moving time" value={formatTime(metrics.time)} />
        <StatRow label="Average pace" value={`${metrics.pace} /km`} highlight />
        <StatRow label="Calories" value={metrics.calories} />
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1 px-1">Splits</p>
        <SplitsTable splits={splits} compact />
      </div>
    </div>
  );

  if (bare) return sheetOpen ? mobileSheet : mobileBar;

  const offset = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 9.5rem)' };
  return sheetOpen ? (
    <div className="fixed left-0 right-0 z-[900] px-3" style={offset}>
      {mobileSheet}
    </div>
  ) : (
    <div className="fixed left-0 right-0 z-[900] px-3" style={offset}>
      {mobileBar}
    </div>
  );
};

export default StatsPanel;
