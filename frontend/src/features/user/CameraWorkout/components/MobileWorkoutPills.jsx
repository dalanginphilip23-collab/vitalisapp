import { useState } from "react";
import Icon from "../../../../components/Icon.jsx";
import { getPickerOptions, resolveWorkout, frameUrl } from "../constants/workoutGuide.js";

const PICKER_OPTIONS = getPickerOptions();

export default function MobileWorkoutPills({ workoutType, onSelect, sheetOpen, onSheetClose, hideTrigger = false }) {
  const PAGE = 8;
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = sheetOpen !== undefined;
  const open = controlled ? sheetOpen : internalOpen;
  const setOpen = (v) => {
    if (controlled) {
      if (!v) onSheetClose?.();
    } else {
      setInternalOpen(v);
    }
  };
  const [query, setQuery] = useState('');
  const [brokenImgs, setBrokenImgs] = useState({});
  const [shown, setShown] = useState(PAGE);
  const current = resolveWorkout(workoutType) ?? PICKER_OPTIONS.find(o => o.id === workoutType);

  const handleSelect = (opt) => {
    onSelect(opt);
    setOpen(false);
  };

  const openSheet = () => {
    setQuery('');
    setBrokenImgs({});
    setShown(PAGE);
    setOpen(true);
  };

  const matches = query.trim()
    ? PICKER_OPTIONS.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : PICKER_OPTIONS;
  const visible = matches.slice(0, shown);
  const remaining = matches.length - visible.length;

  return (
    <>
      {/* ── Trigger bar (hidden when the header menu owns switching) ── */}
      {!hideTrigger && (
      <div className="sm:hidden bg-[var(--bg-secondary)] border-b border-[var(--border-light)] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name={current?.icon ?? 'fitness_center'} className="text-[var(--accent)] text-base" />
          <span className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-primary)]">
            {current?.label ?? 'Select Exercise'}
          </span>
        </div>
        <button
          onClick={openSheet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)] text-[length:var(--fs-9)] font-black uppercase tracking-widest touch-manipulation"
        >
          <Icon name="swap_vert" className="text-xs" />
          Change
        </button>
      </div>
      )}

      {/* ── Modal backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          {/* ── Bottom sheet (mobile) / dialog (desktop) ── */}
          <div
            className="w-full sm:max-w-md bg-[var(--bg-secondary)] border border-[var(--border-medium)] rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-8 max-h-[80dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Select exercise"
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-[var(--border-heavy)] mx-auto mb-4 shrink-0" />

            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Select Exercise · {matches.length}
              </p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close exercise picker"
                className="w-9 h-9 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]"
              >
                <Icon name="close" className="text-[length:var(--fs-18)]" />
              </button>
            </div>

            <div className="relative mb-3 shrink-0">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[length:var(--fs-18)] text-[var(--text-muted)] pointer-events-none" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
                placeholder="Search exercises"
                aria-label="Search exercises"
                className="w-full h-11 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] pl-10 pr-9 text-[length:var(--fs-14)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-disabled)] focus:border-[var(--accent)]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-muted)]"
                >
                  <Icon name="close" className="text-[length:var(--fs-16)]" />
                </button>
              )}
            </div>

            <ul className="overflow-y-auto pb-1 -mx-1 px-1 flex flex-col gap-1.5">
              {visible.map((opt) => {
                const active = workoutType === opt.id;
                const img = !brokenImgs[opt.id] && frameUrl(opt.id, 1);
                return (
                  <li key={opt.id}>
                    <button
                      onClick={() => handleSelect(opt)}
                      aria-pressed={active}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border text-left touch-manipulation min-h-[56px] transition-colors ${
                        active
                          ? 'bg-[var(--accent-bg)] border-[var(--accent)]'
                          : 'bg-[var(--bg-card)] border-[var(--border-light)] active:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {img ? (
                        <img src={img} alt="" aria-hidden="true" loading="lazy"
                          className="w-11 h-11 object-contain rounded-xl p-1 bg-[var(--bg-tertiary)] shrink-0"
                          onError={() => setBrokenImgs(prev => ({ ...prev, [opt.id]: true }))} />
                      ) : (
                        <span className="w-11 h-11 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
                          <Icon name={opt.icon} className="text-[length:var(--fs-22)] text-[var(--accent)]" />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[length:var(--fs-14)] font-bold text-[var(--text-primary)] truncate">
                          {opt.label}
                        </span>
                        <span className="block text-[length:var(--fs-11)] font-medium text-[var(--text-muted)]">
                          {opt.mode === 'hold' ? 'Hold · timed' : 'Reps · counted'}
                        </span>
                      </span>
                      {active ? (
                        <span className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0" aria-hidden="true">
                          <Icon name="check" className="text-[length:var(--fs-15)] text-[var(--text-inverse)]" />
                        </span>
                      ) : (
                        <Icon name="chevron_right" className="text-[length:var(--fs-20)] text-[var(--text-disabled)] shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="text-center py-10 text-[length:var(--fs-13)] text-[var(--text-muted)]">
                  No exercises match “{query}”.
                </li>
              )}
              {remaining > 0 && (
                <li>
                  <button
                    onClick={() => setShown(s => s + PAGE)}
                    className="w-full py-3.5 rounded-2xl border border-[var(--border-medium)] text-[length:var(--fs-13)] font-bold text-[var(--accent)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)] transition-colors touch-manipulation"
                  >
                    View more · {remaining} remaining
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}