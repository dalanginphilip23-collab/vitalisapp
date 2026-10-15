import { Link } from 'react-router-dom';
import Eyebrow from './Eyebrow.jsx';
import { goalLabel, activityLabel } from '../../Onboarding/constants/goals.js';
import { humanize } from '../utils/metrics.js';
import { useUnits } from '../../../hooks/useUnits.js';
import { formatWeight } from '../../../lib/units.js';

// Goal snapshot card — the single home for onboarding goal details.
// Rendered inside the "My Goals" section (not duplicated in Body Metrics).
const GoalSnapshotCard = ({ onboarding, onChangeGoal }) => {
  const units = useUnits();
  if (!onboarding) {
    return (
      <div className="text-center py-3 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] space-y-2">
        <p className="text-[12px] text-[var(--text-muted)]">No onboarding info yet</p>
        <Link to="/onboarding" className="inline-flex py-1.5 px-4 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[11px] font-black">Complete Onboarding</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Eyebrow>Your Plan</Eyebrow>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Goal</p>
          <p className="text-[13px] font-bold text-[var(--accent)] mt-1">{goalLabel(onboarding.goalType)}</p>
          {onboarding.focus && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{humanize(onboarding.focus)}</p>}
          {onboarding.targetWeightKg != null && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">Target: {formatWeight(onboarding.targetWeightKg, units)}</p>}
        </div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity</p>
          <p className="text-[13px] font-bold text-[var(--text-primary)] mt-1">{activityLabel(onboarding.activityLevel)}</p>
          {onboarding.pace && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{humanize(onboarding.pace)}</p>}
        </div>
      </div>
      {onboarding.dailyKcal != null && (
        <div className="rounded-[16px] p-4 text-center bg-[var(--accent-solid)]">
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--accent-solid-fg)]/80">Plan Daily Target</p>
          <p className="text-[24px] font-black text-[var(--accent-solid-fg)] mt-1 tabular-nums">{Number(onboarding.dailyKcal).toLocaleString()} <span className="text-[12px] font-bold text-[var(--accent-solid-fg)]/70">kcal</span></p>
          <p className="text-[11px] font-bold text-[var(--accent-solid-fg)]/70 mt-1 tabular-nums">P {onboarding.proteinG ?? '—'}g · C {onboarding.carbsG ?? '—'}g · F {onboarding.fatG ?? '—'}g</p>
        </div>
      )}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 text-center [&>div]:min-w-0">
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Sleep</p><p className="text-[12px] font-bold mt-1 break-words">{onboarding.sleepHours != null ? `${onboarding.sleepHours}h` : '—'} · {humanize(onboarding.sleepQuality)}</p></div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Stress · Recovery</p><p className="text-[12px] font-bold mt-1 break-words">{humanize(onboarding.stressLevel)} · {humanize(onboarding.recoveryLevel)}</p></div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Exercise</p><p className="text-[12px] font-bold mt-1 break-words">{humanize(onboarding.exerciseFreq)}</p></div>
      </div>
      <button onClick={onChangeGoal} className="w-full py-2.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-bg)] text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent-solid)] hover:text-[var(--accent-solid-fg)] transition-colors">Change Goal</button>
    </div>
  );
};

export default GoalSnapshotCard;
