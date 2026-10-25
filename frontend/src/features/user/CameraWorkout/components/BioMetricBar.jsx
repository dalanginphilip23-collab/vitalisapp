import { memo } from 'react';

function BiometricBar({ label, val, color }) {
  const empty = !Number.isFinite(val) || val <= 0;
  return (
    <div>
      <div className="flex justify-between text-[length:var(--fs-9)] mb-2 sm:mb-3 uppercase font-black tracking-widest text-[var(--text-muted)]">
        <span>{label}</span>
        <span className={empty ? 'text-[var(--text-disabled)]' : ''} style={empty ? undefined : { color }}>
          {empty ? '—' : `${Math.round(val)}%`}
        </span>
      </div>
      <div className="h-[3px] w-full bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${empty ? 0 : Math.min(100, val)}%`, backgroundColor: empty ? 'transparent' : color }}
        />
      </div>
    </div>
  );
}

export default memo(BiometricBar);
