import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient.js';
import Icon from '../../../components/Icon.jsx';
import {
  GOAL_TYPES, PACES, goalLabel, validateTargetWeight,
  ACTIVITY_LEVELS, SLEEP_QUALITY, STRESS_LEVELS, EXERCISE_FREQ, RECOVERY_LEVELS,
  humanizeOption,
} from '../../Onboarding/constants/goals.js';
import { useUnits } from '../../../hooks/useUnits.js';
import { kgToLb, lbToKg } from '../../../lib/units.js';

// Change Goal modal (master plan §12) — switch the active goal without replaying
// onboarding. Body profile is carried forward server-side (PATCH /:userId/change).
const ChangeGoalModal = ({ userId, currentGoal, onClose, onUpdated, showToast }) => {
  const units = useUnits();
  const imperial = units === 'imperial';
  const [goalType, setGoalType] = useState(currentGoal?.goalType || 'LOSE_WEIGHT');
  // Canonical target stays metric (backend + direction validation).
  const [targetWeight, setTargetWeight] = useState(
    currentGoal?.targetWeightKg != null ? String(currentGoal.targetWeightKg) : ''
  );
  // Imperial display string — converted back to kg on every keystroke.
  const [targetRaw, setTargetRaw] = useState(
    currentGoal?.targetWeightKg != null && imperial ? String(kgToLb(Number(currentGoal.targetWeightKg))) : ''
  );
  const [pace, setPace] = useState(currentGoal?.pace || 'GRADUAL');
  const [activityLevel, setActivityLevel] = useState(currentGoal?.activityLevel || '');
  const [sleepHours, setSleepHours] = useState(
    currentGoal?.sleepHours != null ? String(currentGoal.sleepHours) : ''
  );
  const [sleepQuality, setSleepQuality] = useState(currentGoal?.sleepQuality || '');
  const [stressLevel, setStressLevel] = useState(currentGoal?.stressLevel || '');
  const [exerciseFreq, setExerciseFreq] = useState(currentGoal?.exerciseFreq || '');
  const [recoveryLevel, setRecoveryLevel] = useState(currentGoal?.recoveryLevel || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onTargetRaw = (v) => {
    setTargetRaw(v);
    if (v === '') { setTargetWeight(''); return; }
    const n = Number(v);
    if (Number.isFinite(n)) setTargetWeight(String(lbToKg(n)));
  };

  useEffect(() => {
    if (currentGoal?.goalType) setGoalType(currentGoal.goalType);
    if (currentGoal?.targetWeightKg != null) {
      setTargetWeight(String(currentGoal.targetWeightKg));
      setTargetRaw(String(kgToLb(Number(currentGoal.targetWeightKg))));
    }
    if (currentGoal?.pace) setPace(currentGoal.pace);
    if (currentGoal?.activityLevel) setActivityLevel(currentGoal.activityLevel);
    if (currentGoal?.sleepHours != null) setSleepHours(String(currentGoal.sleepHours));
    if (currentGoal?.sleepQuality) setSleepQuality(currentGoal.sleepQuality);
    if (currentGoal?.stressLevel) setStressLevel(currentGoal.stressLevel);
    if (currentGoal?.exerciseFreq) setExerciseFreq(currentGoal.exerciseFreq);
    if (currentGoal?.recoveryLevel) setRecoveryLevel(currentGoal.recoveryLevel);
  }, [currentGoal]);

  const needsTarget = goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT';
  const paceOptions = PACES[goalType] || [];

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const currentKg = currentGoal?.weightKg ?? currentGoal?.weight_kg;
    const directionError = validateTargetWeight(goalType, targetWeight, currentKg);
    if (directionError) {
      setError(directionError);
      return;
    }
    setSaving(true); setError('');
    try {
      const body = { goalType };
      if (needsTarget) {
        body.targetWeightKg = Number(targetWeight);
        if (pace) body.pace = pace;
      }
      body.activityLevel = activityLevel || null;
      body.sleepHours = sleepHours === '' ? null : Number(sleepHours);
      body.sleepQuality = sleepQuality || null;
      body.stressLevel = stressLevel || null;
      body.exerciseFreq = exerciseFreq || null;
      body.recoveryLevel = recoveryLevel || null;
      const data = await apiFetch(`/api/goals/${userId}/change`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      showToast?.(`Goal updated to ${goalLabel(goalType)}`);
      onUpdated?.(data.goal);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-[var(--bg-overlay)]" onClick={onClose}>
      <div className="glass-panel border border-[var(--border-light)] w-full max-w-[440px] rounded-[20px] p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[17px] font-bold">Change Goal</h3>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="text-[12px] text-[var(--text-muted)] mb-4">What is your new primary goal?</p>

        {error && <p className="bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[11px] font-semibold p-2.5 mb-3 text-center">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          {GOAL_TYPES.map((g) => (
            <button type="button" key={g.key} onClick={() => setGoalType(g.key)}
              className={`w-full text-left p-3.5 rounded-[14px] border transition-colors flex items-center gap-3 ${goalType === g.key ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border-light)] bg-[var(--bg-hover)] hover:border-[var(--border-medium)]'}`}>
              <span className="w-9 h-9 rounded-xl bg-[var(--bg-active)] border border-[var(--border-light)] flex items-center justify-center shrink-0 overflow-hidden">
                <Icon name={g.icon} className="text-[20px] text-[var(--accent)]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold break-normal">{g.label}</span>
                <span className="block text-[11px] text-[var(--text-muted)] break-normal text-pretty">{g.desc}</span>
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${goalType === g.key ? 'border-[var(--accent)]' : 'border-[var(--border-medium)]'}`}>
                {goalType === g.key && <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />}
              </span>
            </button>
          ))}

          {needsTarget && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Weight ({imperial ? 'lb' : 'kg'})</label>
                <input type="number" min={imperial ? 22 : 10} max={imperial ? 2200 : 1000} step="0.1" placeholder={imperial ? '154' : '70'}
                  value={imperial ? targetRaw : targetWeight} onChange={(e) => (imperial ? onTargetRaw(e.target.value) : setTargetWeight(e.target.value))}
                  className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 outline-none focus:border-[var(--accent)]" />
              </div>
              {paceOptions.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Pace</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {paceOptions.map((p) => (
                      <button type="button" key={p} onClick={() => setPace(p)}
                        className={`h-10 px-4 rounded-full text-[12px] font-bold uppercase tracking-wider border transition-colors ${pace === p ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Activity Level</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {ACTIVITY_LEVELS.map((a) => (
                <button type="button" key={a.key} onClick={() => setActivityLevel(a.key)} aria-pressed={activityLevel === a.key}
                  className={`h-10 px-4 rounded-full text-[12px] font-bold uppercase tracking-wider border transition-colors ${activityLevel === a.key ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Average Sleep (hours)</label>
            <input type="number" min="0" max="14" step="0.5" placeholder="7.5"
              value={sleepHours} onChange={(e) => setSleepHours(e.target.value)}
              className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 outline-none focus:border-[var(--accent)]" />
          </div>

          {[
            ['Sleep Quality', SLEEP_QUALITY, sleepQuality, setSleepQuality],
            ['Stress Level', STRESS_LEVELS, stressLevel, setStressLevel],
            ['Exercise Frequency', EXERCISE_FREQ, exerciseFreq, setExerciseFreq],
            ['Recovery Level', RECOVERY_LEVELS, recoveryLevel, setRecoveryLevel],
          ].map(([label, opts, val, set]) => (
            <div key={label}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {opts.map((o) => (
                  <button type="button" key={o} onClick={() => set(o)} aria-pressed={val === o}
                    className={`h-10 px-4 rounded-full text-[12px] font-bold uppercase tracking-wider border transition-colors ${val === o ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                    {humanizeOption(o)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-12 rounded-[12px] border border-[var(--border-light)] font-bold text-[13px]">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 h-12 rounded-[12px] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] font-bold text-[13px] disabled:opacity-50">
              {saving ? 'Updating…' : 'Update Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeGoalModal;
