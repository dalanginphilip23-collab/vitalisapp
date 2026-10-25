import { useState } from "react";
import Icon from "../../../../components/Icon.jsx";
import { apiPatch } from "../../../../lib/apiClient.js";

// ── Post-workout self-report (Module 5) ─────────────────────────────────────
// Rating + optional note, shown after the Workout Complete summary.
// Purely user-entered: nothing here feeds automatic intensity increases —
// it is stored on the session (workout_logs) for later plan review.
const LEVELS = [
  { value: 1, label: 'Too easy',   icon: 'battery_1_bar' },
  { value: 2, label: 'Easy',       icon: 'battery_2_bar' },
  { value: 3, label: 'Just right', icon: 'battery_3_bar' },
  { value: 4, label: 'Challenging',icon: 'battery_4_bar' },
  { value: 5, label: 'Very hard',  icon: 'battery_5_bar' },
];

export default function WorkoutFeedbackSheet({ logId, onClose }) {
  const [rating,   setRating]   = useState(null);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState(null);

  // Mounted permanently by CameraWorkout — render nothing until there is a
  // persisted session to rate, otherwise the full-screen overlay would block
  // the whole page.
  if (!logId) return null;

  const submit = async () => {
    if (!logId || rating == null || saving) return onClose?.();
    setSaving(true);
    setSaveErr(null);
    try {
      await apiPatch(`/api/workout-logs/${logId}/feedback`, {
        difficulty_rating: rating,
        session_notes: notes.trim() || undefined,
      });
      onClose?.();
    } catch (e) {
      setSaveErr(e.message || 'Could not save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-[var(--bg-overlay)] backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label="Rate your workout"
    >
      <div className="w-full sm:max-w-md bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center mb-4">
            <Icon name="forum" className="text-[length:var(--fs-24)] text-[var(--accent)]" />
          </span>
          <h2 className="font-extrabold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', lineHeight: 1.2 }}>
            How did it feel?
          </h2>
          <p className="mt-1 text-[length:var(--fs-13)] text-[var(--text-muted)]">
            Your feedback keeps future recommendations honest — no auto-progression.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {LEVELS.map((l) => {
            const active = rating === l.value;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setRating(l.value)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-bg)] border-[var(--accent-border)]'
                    : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Icon name={l.icon} className={`text-[length:var(--fs-20)] ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                <Icon name="favorite" fill={active ? 1 : 0} className={`text-[length:var(--fs-10)] ${active ? 'text-[var(--accent)]' : 'text-[var(--text-disabled)]'}`} />
                <span className={`text-[length:var(--fs-9)] font-bold text-center leading-tight ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {l.label}
                </span>
              </button>
            );
          })}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
          placeholder="Optional — anything to remember about this session (injuries, tweaks, how it went)…"
          className="mt-4 w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 py-3 text-[length:var(--fs-13)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-border)] resize-none"
          aria-label="Session notes"
        />

        {saveErr && (
          <p className="mt-2 text-[length:var(--fs-11)] font-bold text-[var(--error)]" role="alert">{saveErr}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl border border-[var(--border-light)] text-[var(--text-muted)] text-[length:var(--fs-13)] font-bold hover:bg-[var(--bg-hover)] active:scale-[0.99] transition-all min-h-[52px] disabled:opacity-60"
          >
            Skip
          </button>
          <button
            onClick={submit}
            disabled={rating == null || saving}
            className="flex-1 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-15)] font-bold hover:bg-[var(--accent-hover)] active:scale-[0.99] transition-all min-h-[52px] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
