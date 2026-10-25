import Icon from "../../../../components/Icon.jsx";
import { getPickerOptions, resolveWorkout } from "../constants/workoutGuide.js";

const PICKER_OPTIONS = getPickerOptions();

export default function DesktopWorkoutSelector({ workoutType, onSelect }) {
  return (
    <div className="hidden sm:flex flex-wrap bg-[var(--bg-secondary)] border-b border-[var(--border-light)] px-6 py-3 items-center gap-4">
      <div className="flex items-center gap-2.5 pr-4 border-r border-[var(--border-light)]">
        <Icon name="exercise" className="text-[var(--accent)] text-xs opacity-80" />
        <span className="text-[length:var(--fs-9)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Exercise</span>
      </div>

      <div className="relative group flex-1 sm:flex-none max-w-full">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none gap-3">
          <Icon
            name={resolveWorkout(workoutType)?.icon ?? PICKER_OPTIONS.find(o => o.id === workoutType)?.icon ?? 'fitness_center'}
            className="text-[var(--accent)] text-sm"
          />
          <div className="w-[1px] h-3 bg-[var(--border-medium)]" />
        </div>
        <select
          value={workoutType}
          onChange={(e) => {
            const opt = PICKER_OPTIONS.find(o => o.id === e.target.value) ?? resolveWorkout(e.target.value);
            if (opt) onSelect(opt);
          }}
          className="appearance-none w-full bg-[var(--bg-hover)] border border-[var(--border-medium)] text-[var(--text-primary)] text-[length:var(--fs-10)] font-black uppercase tracking-[0.15em] pl-14 pr-12 py-2.5 rounded-xl cursor-pointer outline-none transition-all duration-300 hover:bg-[var(--surface-hover)] hover:border-[var(--border-heavy)] focus:border-[var(--accent-border)] focus:ring-1 focus:ring-[var(--accent-border)] min-w-0 sm:min-w-[240px] truncate"
        >
          {PICKER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {opt.label}{opt.mode === 'hold' ? ' (Hold)' : ''}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
          <Icon name="expand_more" className="text-[var(--accent)] text-xs group-hover:translate-y-0.5 transition-transform" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 bg-[var(--accent-bg)] px-3 py-1.5 rounded-full border border-[var(--accent-border)]">
        <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-[length:var(--fs-8)] font-black text-[var(--accent)] uppercase tracking-widest">Live</span>
      </div>
    </div>
  );
}