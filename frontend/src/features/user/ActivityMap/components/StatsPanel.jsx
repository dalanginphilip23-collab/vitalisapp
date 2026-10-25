import React, { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';

// Pace strings arrive as "6'05\"" from the live timer. Convert to seconds so
// the split bars can show relative speed without changing the displayed copy.
const paceToSeconds = (pace) => {
  const match = String(pace || '').match(/(\d+)\s*['′:]\s*(\d+)/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const SplitRows = ({ splits }) => {
  if (splits.length === 0) {
    return (
      <div className="am-splits-empty">
        <Icon name="route" />
        <span>Your first kilometre split will land here.</span>
      </div>
    );
  }

  const seconds = splits.map((split) => paceToSeconds(split.pace)).filter((n) => n != null);
  const fastest = seconds.length ? Math.min(...seconds) : null;
  const slowest = seconds.length ? Math.max(...seconds) : null;

  return (
    <>
      {splits.map((split) => {
        const sec = paceToSeconds(split.pace);
        const width = sec != null && fastest != null && slowest != null && slowest > fastest
          ? 32 + ((slowest - sec) / (slowest - fastest)) * 68
          : 68;

        return (
          <div className="am-split" key={split.km}>
            <span className="am-split__km">{split.km} km</span>
            <span className="am-split__bar" aria-hidden="true">
              <span className="am-split__fill" style={{ width: `${width}%` }} />
            </span>
            <span className="am-split__pace">{split.pace}</span>
          </div>
        );
      })}
    </>
  );
};

const StatusPill = ({ label, state }) => (
  <span className={`am-status ${state}`.trim()}>
    <span className="am-status__dot" />
    {label}
  </span>
);

const StatsPanel = ({
  metrics,
  splits,
  formatTime,
  isDesktop = false,
  controls = null,
  isRecording = false,
  paused = false,
  gpsReady = false,
  accuracy = null,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const statusLabel = paused ? 'Paused' : isRecording ? 'Recording' : gpsReady ? 'Ready' : 'Waiting for GPS';
  const statusState = paused ? 'is-paused' : isRecording ? 'is-live' : gpsReady ? 'is-ready' : '';
  const mobileStatus = paused ? 'Paused' : isRecording ? 'Live run' : gpsReady ? 'Ready to run' : 'Waiting for GPS';

  const hintIcon = paused ? 'pause_circle' : isRecording ? 'sensors' : gpsReady ? 'location_on' : 'location_off';
  const hint = paused
    ? 'Timer paused — resume when you are ready'
    : isRecording
      ? `Recording live${accuracy ? ` · ±${Math.round(accuracy)} m` : ''}`
      : gpsReady
        ? `GPS locked${accuracy ? ` · ±${Math.round(accuracy)} m` : ''}`
        : 'Enable location to record a route';

  const metricsBlock = (
    <>
      <div className="am-metrics">
        <div className="am-metric">
          <span className="am-metric__label">Time</span>
          <span className="am-metric__value">{formatTime(metrics.time)}</span>
        </div>
        <div className="am-metric">
          <span className="am-metric__label">Avg pace</span>
          <span className={`am-metric__value ${metrics.pace && metrics.pace !== '–' ? 'is-accent' : ''}`.trim()}>
            {metrics.pace || '–'}
            {metrics.pace && metrics.pace !== '–' && <span className="am-metric__unit">/km</span>}
          </span>
        </div>
        <div className="am-metric">
          <span className="am-metric__label">Calories</span>
          <span className="am-metric__value">
            {metrics.calories}
            <span className="am-metric__unit">kcal</span>
          </span>
        </div>
      </div>
    </>
  );

  // ── Desktop: persistent session console beside the map ───────────────────
  if (isDesktop) {
    return (
      <aside className="am-console" aria-label="Live run stats">
        <div className="am-console__head">
          <div className="min-w-0">
            <p className="am-kicker">Live session</p>
            <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]">
              {paused ? 'Take a breath.' : isRecording ? 'Route in progress.' : 'Ready when you are.'}
            </p>
          </div>
          <StatusPill label={statusLabel} state={statusState} />
        </div>

        <div className="am-console__body">
          <div className="am-hero">
            <p className="am-kicker">Distance</p>
            <div className="am-hero__value">
              {metrics.distance.toFixed(2)}
              <span className="am-hero__unit">km</span>
            </div>
          </div>

          {metricsBlock}

          <div className="am-splits">
            <div className="am-splits__head">
              <p className="am-kicker">Splits</p>
              <span className="am-splits__count">{splits.length} km</span>
            </div>
            <SplitRows splits={splits} />
          </div>
        </div>

        <div className="am-console__foot">
          {controls}
          <p className="am-hint">
            <Icon name={hintIcon} />
            {hint}
          </p>
        </div>
      </aside>
    );
  }

  // ── Mobile / tablet: one floating dock, expandable for splits ────────────
  return (
    <div className="am-mobile-card">
      <div className="am-mobile-card__head">
        <span className={`am-mobile-status ${statusState}`.trim()}>
          <span className="am-mobile-status__dot" />
          {mobileStatus}
        </span>
        <button
          type="button"
          onClick={() => setSheetOpen((open) => !open)}
          aria-label={sheetOpen ? 'Hide run details' : 'Show run details'}
          aria-expanded={sheetOpen}
          className="am-chevron"
        >
          <Icon name="expand_more" />
        </button>
      </div>

      <div className="am-mobile-metrics">
        <div className="am-mobile-metric">
          <span className="am-mobile-metric__label">Distance</span>
          <span className="am-mobile-metric__value is-hero">
            {metrics.distance.toFixed(2)}
            <span className="am-mobile-metric__unit">km</span>
          </span>
        </div>
        <div className="am-mobile-metric">
          <span className="am-mobile-metric__label">Time</span>
          <span className="am-mobile-metric__value">{formatTime(metrics.time)}</span>
        </div>
        <div className="am-mobile-metric">
          <span className="am-mobile-metric__label">Pace</span>
          <span className={`am-mobile-metric__value ${metrics.pace && metrics.pace !== '–' ? 'is-accent' : ''}`.trim()}>
            {metrics.pace || '–'}
          </span>
        </div>
      </div>

      {sheetOpen && (
        <div className="am-mobile-details">
          <div className="am-mobile-details__row">
            <span>Calories</span>
            <strong>{metrics.calories} kcal</strong>
          </div>
          <div className="am-splits__head">
            <p className="am-kicker">Splits</p>
            <span className="am-splits__count">{splits.length} km</span>
          </div>
          <SplitRows splits={splits} />
        </div>
      )}

      <div className="am-mobile-controls">{controls}</div>
    </div>
  );
};

export default StatsPanel;
