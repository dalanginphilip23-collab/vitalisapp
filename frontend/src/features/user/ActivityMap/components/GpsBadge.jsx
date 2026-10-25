import React from 'react';

// Vitalis map chip: dark glass pill with a colored status dot. The fixed
// dark surface stays readable over both the light and dark tile sets.
const LABELS = {
  granted: 'GPS Active',
  pending: 'Locating…',
  denied: 'Location blocked',
  timeout: 'GPS timeout',
  unavailable: 'GPS unavailable',
};

const DOT = {
  granted: 'bg-[#7ef08a]',
  pending: 'bg-[#f0c34d] animate-pulse',
  denied: 'bg-[#ff6b6b]',
  timeout: 'bg-[#ff9d5c]',
  unavailable: 'bg-[#ff6b6b]',
};

const GpsBadge = ({ locationStatus, accuracy, coords }) => {
  const granted = locationStatus === 'granted';
  const label = LABELS[locationStatus] || 'GPS Off';
  const hasAccuracy = granted && Number.isFinite(accuracy);

  return (
    <div className="am-map-chip absolute top-3 left-3 z-[1000] max-w-[68%] rounded-full px-3 py-2 sm:top-4 sm:left-4">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT[locationStatus] || 'bg-white/35'}`} />
        <span className="whitespace-nowrap text-[10px] font-bold text-white/90 sm:text-[11px]">
          {label}
        </span>
        {hasAccuracy && (
          <span className="whitespace-nowrap text-[10px] font-semibold text-white/45 sm:text-[11px]">
            ±{Math.round(accuracy)}m
          </span>
        )}
      </div>
      {granted && coords && (
        <span className="hidden truncate text-[9px] font-medium tabular-nums text-white/30 sm:block">
          {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
        </span>
      )}
    </div>
  );
};

export default GpsBadge;
