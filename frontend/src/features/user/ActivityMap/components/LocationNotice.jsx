import React from 'react';
import Icon from '../../../../components/Icon.jsx';

// Clear, actionable state instead of a small badge when the map has no usable
// GPS. `retry` re-requests the one-shot initial fix.
const COPY = {
  denied: {
    icon: 'location_off',
    title: 'Location is blocked',
    body: 'Allow location access for this site to record a run. Routes come from real GPS only — nothing is simulated.',
  },
  unavailable: {
    icon: 'location_searching',
    title: 'Location unavailable',
    body: 'No GPS fix yet. Move somewhere with a clearer view of the sky, then retry.',
  },
  timeout: {
    icon: 'timer_off',
    title: 'GPS timed out',
    body: 'Getting a fix took too long. Check that location services are on, then retry.',
  },
};

const LocationNotice = ({ status, error, onRetry }) => {
  const copy = COPY[status];
  if (!copy) return null;

  return (
    <div
      role="alert"
      className="pointer-events-auto absolute top-[4.5rem] left-1/2 z-[1100] w-[min(92%,390px)] -translate-x-1/2"
    >
      <div className="rounded-[22px] border border-white/10 bg-[rgba(9,14,9,0.9)] p-4 text-left shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]">
            <Icon name={copy.icon} className="text-[20px] text-[var(--warning)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">{copy.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">{copy.body}</p>
            {error && <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">{error}</p>}
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[11px] font-bold text-[var(--text-inverse)] transition-all hover:brightness-105 active:scale-95"
            >
              <Icon name="my_location" className="text-[15px]" />
              Retry location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationNotice;
