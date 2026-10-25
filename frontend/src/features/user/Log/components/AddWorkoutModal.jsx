import { useState } from "react";
import Icon from "../../../../components/Icon.jsx";
import { apiPost } from "../../../../lib/apiClient.js";
import { useToastStore } from "../../../../stores/toastStore.js";

// ── Manual workout entry (Module 5 — structured set logging) ────────────────
// For gym/weighted sessions that don't use the camera tracker. Creates one
// completed workout_logs row plus workout_sets rows in a single POST.
const TYPE_SUGGESTIONS = ['strength', 'push', 'pull', 'leg day', 'upper body', 'lower body', 'cardio', 'general'];

const emptyRow = () => ({ exercise_name: '', reps: '', weight_kg: '' });

function setsToPayload(rows) {
  return rows
    .filter((r) => r.exercise_name.trim() !== '')
    .map((r, i) => {
      const reps = String(r.reps).trim();
      const weight = String(r.weight_kg).trim();
      return {
        exercise_name: r.exercise_name.trim(),
        set_number: i + 1,
        ...(reps !== '' ? { reps: Number(reps) } : {}),
        ...(weight !== '' ? { weight_kg: Number(weight) } : {}),
      };
    });
}

export default function AddWorkoutModal({ onClose, onSaved, initialTitle = '' }) {
  const [type,       setType]        = useState(initialTitle.trim() || 'Strength');
  const [duration,   setDuration]    = useState(45);
  const [performedAt,setPerformedAt] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [rows,       setRows]        = useState([emptyRow()]);
  const [saving,     setSaving]      = useState(false);
  const [error,      setError]       = useState(null);

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  };
  const addRow  = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i) => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));

  const canSave = String(type).trim() !== ''
    && Number(duration) >= 1
    && rows.some((r) => r.exercise_name.trim() !== '');

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const sets = setsToPayload(rows);
      const payload = {
        workout_type: type.trim(),
        duration_minutes: Math.round(Number(duration)),
        performed_at: performedAt ? `${performedAt}T12:00:00` : undefined,
        ...(sets.length > 0 ? { sets } : { rep_count: 0 }),
      };
      const log = await apiPost('/api/workout-logs/manual', payload);
      useToastStore.getState().addToast('Workout logged', 'success');
      onSaved?.(log);
      onClose?.();
    } catch (e) {
      setError(e.message || 'Could not save workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true" aria-label="Log a workout"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape' && !saving) onClose?.(); }}
    >
      <div className="w-full max-w-lg my-auto glass-card border border-[var(--border-light)] rounded-3xl p-5 sm:p-7 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] block">Manual entry</span>
            <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)]">Log a workout</h3>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center transition-colors"
          >
            <Icon name="close" className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 sm:col-span-1 flex flex-col gap-1.5">
            <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)]">Session name</span>
            <input
              list="wt-types"
              value={type}
              onChange={(e) => setType(e.target.value)}
              maxLength={100}
              className="h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
            />
            <datalist id="wt-types">
              {TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)]">Duration (mins)</span>
            <input
              type="number" min="1" max="1440" step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 text-sm font-bold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)]">Date performed</span>
            <input
              type="date" max={new Date().toLocaleDateString('en-CA')}
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              className="h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <span className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)]">Sets (optional — reps × weight)</span>
          <button
            onClick={addRow}
            className="h-8 px-3 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-1"
          >
            <Icon name="add" className="text-[length:var(--fs-12)]" /> Add set
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[38dvh] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_72px_34px] gap-2 items-center">
              <input
                placeholder={`Exercise ${i + 1} (e.g. Bench Press)`}
                value={r.exercise_name}
                onChange={(e) => updateRow(i, 'exercise_name', e.target.value)}
                maxLength={150}
                className="h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-3 text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-border)] min-w-0"
              />
              <input
                type="number" min="0" max="1000" step="1" placeholder="Reps"
                value={r.reps}
                onChange={(e) => updateRow(i, 'reps', e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-2 text-[length:var(--fs-13)] font-bold tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-border)]"
              />
              <input
                type="number" min="0" max="1000" step="0.5" placeholder="Kg"
                value={r.weight_kg}
                onChange={(e) => updateRow(i, 'weight_kg', e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] px-2 text-[length:var(--fs-13)] font-bold tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-border)]"
              />
              <button
                onClick={() => removeRow(i)}
                aria-label={`Remove set ${i + 1}`}
                className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
              >
                <Icon name="close" className="text-[length:var(--fs-14)]" />
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] font-bold uppercase tracking-widest text-center py-3">
              No sets — add some for per-exercise tracking
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 text-[length:var(--fs-11)] font-bold text-[var(--error)]" role="alert">⚠ {error}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3.5 min-h-[52px] rounded-xl font-bold text-sm border transition-all"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSave || saving}
            className="flex-1 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-15)] font-bold hover:bg-[var(--accent-hover)] active:scale-[0.99] transition-all min-h-[52px] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
