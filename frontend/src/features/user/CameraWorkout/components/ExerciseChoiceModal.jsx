import Icon from "../../../../components/Icon.jsx";

// ── Exercise choice: after picking a card, decide HOW to log the session ────
// Offered for every library exercise: launch the AI camera tracker, or enter
// the session by hand (reps / sets / weight) through the reused manual modal.
export default function ExerciseChoiceModal({ exercise, onUseCamera, onLogManually, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true" aria-label="Choose how to log this exercise"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
    >
      <div className="w-full max-w-md my-auto glass-card border border-[var(--border-light)] rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {exercise?.img ? (
              <img
                src={exercise.img}
                alt=""
                className="w-14 h-14 rounded-2xl object-contain border border-[var(--border-light)] shrink-0"
                style={{ background: '#1E1E1E' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="w-14 h-14 rounded-2xl border border-[var(--border-light)] flex items-center justify-center shrink-0" style={{ background: '#1E1E1E' }}>
                <span className="material-symbols-outlined text-[length:var(--fs-24)] text-white/80">fitness_center</span>
              </span>
            )}
            <div className="min-w-0">
              <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] block">How do you want to train?</span>
              <h3 className="text-[length:var(--fs-15)] font-black tracking-tight text-[var(--text-primary)] truncate">
                {exercise?.label || 'Selected exercise'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center transition-colors shrink-0"
          >
            <Icon name="close" className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onUseCamera}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-bg)] hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all text-left"
          >
            <span className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center shrink-0">
              <Icon name="videocam" className="text-[length:var(--fs-20)]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[length:var(--fs-13)] font-black text-[var(--text-primary)]">Use camera</span>
              <span className="block text-[length:var(--fs-11)] text-[var(--text-muted)] font-semibold mt-0.5">AI rep counting &amp; live form feedback</span>
            </span>
            <span className="material-symbols-outlined ml-auto text-[length:var(--fs-18)] text-[var(--accent)] shrink-0">arrow_forward</span>
          </button>

          <button
            onClick={onLogManually}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-hover)]/50 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all text-left"
          >
            <span className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
              <Icon name="edit_note" className="text-[length:var(--fs-20)]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[length:var(--fs-13)] font-black text-[var(--text-primary)]">Log manually</span>
              <span className="block text-[length:var(--fs-11)] text-[var(--text-muted)] font-semibold mt-0.5">Enter reps, sets &amp; weight — no camera</span>
            </span>
            <span className="material-symbols-outlined ml-auto text-[length:var(--fs-18)] text-[var(--text-muted)] shrink-0">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
