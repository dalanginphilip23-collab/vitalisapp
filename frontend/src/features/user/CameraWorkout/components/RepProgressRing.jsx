import Icon from "../../../../components/Icon.jsx";
import { formStatus } from "./formStatus.js";

// Rep progress ring: current / target with an accent arc.
// Pure SVG, theme-aware, no image assets.
export default function RepProgressRing({ value, target, label = 'REPS', size = 120 }) {
  const safeTarget = Math.max(1, Number(target) || 1);
  const clamped = Math.max(0, Math.min(safeTarget, Number(value) || 0));
  const r = 52;
  const c = 2 * Math.PI * r;
  const progress = clamped / safeTarget;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img"
      aria-label={`${clamped} of ${safeTarget} ${label.toLowerCase()}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10"
          stroke="var(--bg-hover)" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke="var(--accent)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold tabular-nums text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.24, lineHeight: 1 }}>
          {String(clamped).padStart(2, '0')}
          <span className="font-bold text-[var(--text-muted)]" style={{ fontSize: size * 0.14 }}> / {safeTarget}</span>
        </span>
        <span className="font-bold uppercase text-[var(--text-muted)]"
          style={{ fontSize: size * 0.09, letterSpacing: '0.18em' }}>{label}</span>
      </div>
    </div>
  );
}

export function FormStatusPill({ alignment, symmetry }) {
  const status = formStatus(alignment, symmetry);
  if (status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] text-[length:var(--fs-11)] font-bold uppercase tracking-widest">
        <Icon name="hourglass_empty" className="text-[length:var(--fs-15)]" />
        Waiting
      </span>
    );
  }
  const good = status === 'good';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[length:var(--fs-11)] font-bold uppercase tracking-widest ${
      good
        ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    }`}>
      <Icon name={good ? 'check_circle' : 'warning'} className="text-[length:var(--fs-15)]" />
      {good ? 'Form Good' : 'Adjust Form'}
    </span>
  );
}
