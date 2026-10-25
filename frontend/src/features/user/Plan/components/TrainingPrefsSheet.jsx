import { useState } from "react";
import Icon from "../../../../components/Icon.jsx";

// ── Module 5 — Training Preferences editor ──────────────────────────────────
//Self-reported inputs used by: day-cycling schedule (preferred days),
// fit-to-minutes trimming (session duration), equipment alternatives, and
// starter-plan generation (minutes + equipment note). Never auto-applied to
// increase intensity — they describe capacity, not ambition.
const EQUIPMENT_ICONS = {
  Bodyweight: 'accessibility_new',
  Dumbbells: 'fitness_center',
  Barbell: 'exercise',
  Kettlebell: 'sports_gymnastics',
  'Resistance Bands': 'line_weight',
  Machines: 'settings',
  'Pull-up Bar': 'swipe_up',
  'Cardio Equipment': 'directions_run',
};
const LOCATIONS = ['Home', 'Gym', 'Outdoor', 'BFP Office', 'Other'];
const MINS_PRESETS = [20, 30, 45, 60];

export default function TrainingPrefsSheet({ open, preferences, options, onClose, onSave }) {
  // Recreated per open (parent passes a remount key), so state initializers
  // read props directly — no effect-sync needed for the edit-vs-create flow.
  const savedMins = preferences?.sessionDurationMins ?? null;
  const [equipment,   setEquipment]   = useState(() => preferences?.equipment ?? []);
  const [days,        setDays]        = useState(() => preferences?.preferredDays ?? []);
  const [mins,        setMins]        = useState(() => (
    savedMins == null ? null : MINS_PRESETS.includes(Number(savedMins)) ? Number(savedMins) : 'custom'
  ));
  const [customMins,  setCustomMins]  = useState(() => (
    savedMins != null && !MINS_PRESETS.includes(Number(savedMins)) ? String(savedMins) : ''
  ));
  const [location,    setLocation]    = useState(() => preferences?.workoutLocation ?? '');
  const [err,         setErr]         = useState(null);
  const [busy,        setBusy]        = useState(false);

  if (!open) return null;

  const toggleIn = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const resolvedMins = mins == null ? null
    : mins === 'custom'
      ? (Number(customMins) >= 10 && Number(customMins) <= 180 ? Math.round(Number(customMins)) : 'invalid')
      : mins;

  const submit = async () => {
    if (busy) return;
    if (resolvedMins === 'invalid') { setErr('Custom minutes must be between 10 and 180.'); return; }
    setErr(null);
    setBusy(true);
    const ok = await onSave({
      equipment,
      preferred_days: days,
      session_duration_mins: resolvedMins,
      workout_location: location || undefined,
    });
    setBusy(false);
    if (ok !== null) onClose?.();
  };

  const equipmentChoices = options.equipment?.length ? options.equipment : Object.keys(EQUIPMENT_ICONS);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayFull = options.days?.length ? options.days : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}
      role="dialog" aria-modal="true" aria-label="Training preferences"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose?.(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Module 5 · inputs</p>
            <h3 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Training preferences</h3>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            <Icon name="close" className="text-[length:var(--fs-18)]" />
          </button>
        </div>

        <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Available equipment (none is fine)</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {equipmentChoices.map((eq) => {
            const active = equipment.includes(eq);
            return (
              <button key={eq} type="button" onClick={() => toggleIn(equipment, setEquipment, eq)} aria-pressed={active}
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl text-[length:var(--fs-11)] font-bold border cursor-pointer transition-all"
                style={{
                  background: active ? 'var(--accent-bg)' : 'var(--bg-hover)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--border-light)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                <Icon name={EQUIPMENT_ICONS[eq] || 'fitness_center'} className="text-[length:var(--fs-14)]" fill={active ? 1 : 0} />
                {eq}
              </button>
            );
          })}
        </div>

        <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Preferred training days</p>
        <div className="flex gap-1.5 mb-5">
          {dayFull.map((full, i) => {
            const active = days.includes(i);
            return (
              <button key={full} type="button" title={full} onClick={() => toggleIn(days, setDays, i)} aria-pressed={active}
                className="flex-1 h-10 min-w-0 rounded-xl text-[length:var(--fs-11)] font-black border cursor-pointer transition-all"
                style={{
                  background: active ? 'var(--accent)' : 'var(--bg-hover)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-light)',
                  color: active ? 'var(--text-inverse)' : 'var(--text-muted)',
                }}>
                {dayLabels[i]}
              </button>
            );
          })}
        </div>

        <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Minutes available per session</p>
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {MINS_PRESETS.map((m) => {
            const active = mins === m;
            return (
              <button key={m} type="button" onClick={() => { setMins(m); setCustomMins(''); }} aria-pressed={active}
                className="h-10 rounded-xl text-[length:var(--fs-11)] font-black border cursor-pointer transition-all"
                style={{
                  background: active ? 'var(--accent)' : 'var(--bg-hover)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-light)',
                  color: active ? 'var(--text-inverse)' : 'var(--text-muted)',
                }}>
                {m}
              </button>
            );
          })}
          <button type="button" onClick={() => setMins('custom')} aria-pressed={mins === 'custom'}
            className={`h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${mins === 'custom' ? 'text-[var(--text-disabled)]' : ''}`}
            style={{ background: 'var(--bg-hover)', borderColor: mins === 'custom' ? 'var(--accent-border)' : 'var(--border-light)' }}>
            <Icon name="edit" className="text-[length:var(--fs-14)]" />
          </button>
        </div>
        {mins === 'custom' && (
          <input type="number" min={10} max={180} value={customMins} onChange={(e) => setCustomMins(e.target.value)}
            placeholder="10–180 minutes"
            className="w-full h-11 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-4 mb-2 text-sm font-bold tabular-nums outline-none focus:border-[var(--accent-border)]" />
        )}

        <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>Workout location (optional)</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {LOCATIONS.map((loc) => {
            const active = location === loc;
            return (
              <button key={loc} type="button" onClick={() => setLocation(active ? '' : loc)} aria-pressed={active}
                className="px-3 h-9 rounded-lg text-[length:var(--fs-11)] font-bold border cursor-pointer transition-all"
                style={{
                  background: active ? 'var(--accent-bg)' : 'var(--bg-hover)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--border-light)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {loc}
              </button>
            );
          })}
        </div>

        {err && <p className="mt-2 text-[length:var(--fs-11)] font-bold" style={{ color: 'var(--error)' }} role="alert">⚠ {err}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-xl font-bold text-sm border" style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wide" style={{ background: 'var(--accent)', color: 'var(--text-inverse)', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
