import { useEffect, useState } from 'react';
import { apiFetch, apiPost } from '../../../../lib/apiClient.js';
import Icon from '../../../../components/Icon.jsx';
import { GOAL_TYPES, PACES, goalLabel } from '../../Onboarding/constants/goals.js';

// Change Goal modal (master plan §12) — switch the active goal without replaying
// onboarding. Body profile is carried forward server-side (PATCH /:userId/change).
//
// Setup mode: when the user has NO active goal yet (e.g. onboarding was skipped),
// the modal becomes a compact in-place "Set up your plan" form. It asks only for
// what the create endpoint requires (height + weight), carries over DOB / sex
// typed in My Account, and POSTs /api/goals/:userId — the user never leaves
// the Profile page for the onboarding wizard.
const ChangeGoalModal = ({ userId, currentGoal, identity, onClose, onUpdated, showToast }) => {
  const firstSetup = !currentGoal?.goalType;
  const [goalType, setGoalType] = useState(firstSetup ? 'LOSE_WEIGHT' : (currentGoal?.goalType || 'LOSE_WEIGHT'));
  const [targetWeight, setTargetWeight] = useState(
    currentGoal?.targetWeightKg != null ? String(currentGoal.targetWeightKg) : ''
  );
  const [pace, setPace] = useState(currentGoal?.pace || 'GRADUAL');
  // Setup-mode only fields
  const [height, setHeight] = useState(currentGoal?.heightCm != null ? String(currentGoal.heightCm) : '');
  const [weight, setWeight] = useState(currentGoal?.weightKg != null ? String(currentGoal.weightKg) : '');
  const [dob, setDob] = useState(identity?.dob || currentGoal?.dob ? String(identity?.dob || currentGoal?.dob).slice(0, 10) : '');
  const [sex, setSex] = useState(identity?.sex || currentGoal?.sex || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentGoal?.goalType && !firstSetup) {
      if (currentGoal?.targetWeightKg != null) setTargetWeight(String(currentGoal.targetWeightKg));
      if (currentGoal?.pace) setPace(currentGoal.pace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoal]);

  const needsTarget = goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT';
  const paceOptions = PACES[goalType] || [];

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (needsTarget && !(Number(targetWeight) > 0)) {
      setError('Enter a target weight for this goal.');
      return;
    }
    if (needsTarget && (Number(targetWeight) < 10 || Number(targetWeight) > 1000)) {
      setError('Target weight must be between 10 and 1000 kg.');
      return;
    }
    if (firstSetup) {
      const h = Number(height);
      const w = Number(weight);
      if (!Number.isFinite(h) || h < 50 || h > 300) return setError('Height must be between 50 and 300 cm.');
      if (!Number.isFinite(w) || w < 10 || w > 1000) return setError('Weight must be between 10 and 1000 kg.');
    }
    setSaving(true); setError('');
    try {
      if (firstSetup) {
        const body = { goalType, heightCm: Number(height), weightKg: Number(weight) };
        if (needsTarget) {
          body.targetWeightKg = Number(targetWeight);
          if (pace) body.pace = pace;
        }
        if (dob) body.dob = dob;
        if (sex) body.sex = sex;
        const data = await apiPost(`/api/goals/${userId}`, body);
        showToast?.(`Plan created — goal set to ${goalLabel(goalType)}`);
        onUpdated?.(data.goal);
        onClose();
      } else {
        const body = { goalType };
        if (needsTarget) {
          body.targetWeightKg = Number(targetWeight);
          if (pace) body.pace = pace;
        }
        const data = await apiFetch(`/api/goals/${userId}/change`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        showToast?.(`Goal updated to ${goalLabel(goalType)}`);
        onUpdated?.(data.goal);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg,var(--bg-hover))] border border-[var(--border-light)] px-3 outline-none focus:border-[var(--accent)]';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-panel border border-[var(--border-light)] w-full max-w-[440px] rounded-[20px] p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[length:var(--fs-17)] font-bold">{firstSetup ? 'Set Up Your Plan' : 'Change Goal'}</h3>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
          </button>
        </div>
        <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] mb-4">
          {firstSetup ? 'Done right here — no wizard needed. Pick a goal and confirm your body profile.' : 'What is your new primary goal?'}
        </p>

        {error && <p className="bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-lg text-[var(--error)] text-[length:var(--fs-11)] font-semibold p-2.5 mb-3 text-center">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          {GOAL_TYPES.map((g) => (
            <button type="button" key={g.key} onClick={() => setGoalType(g.key)}
              className={`w-full text-left p-3.5 rounded-[14px] border transition-colors flex items-center gap-3 ${goalType === g.key ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border-light)] bg-[var(--bg-hover)] hover:border-[var(--border-medium)]'}`}>
              <span className="w-9 h-9 rounded-xl bg-[var(--bg-active)] border border-[var(--border-light)] flex items-center justify-center shrink-0 overflow-hidden">
                <Icon name={g.icon} className="text-[length:var(--fs-20)] text-[var(--accent)]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[length:var(--fs-13)] font-bold break-normal">{g.label}</span>
                <span className="block text-[length:var(--fs-11)] text-[var(--text-muted)] break-normal text-pretty">{g.desc}</span>
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${goalType === g.key ? 'border-[var(--accent)]' : 'border-[var(--border-medium)]'}`}>
                {goalType === g.key && <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />}
              </span>
            </button>
          ))}

          {firstSetup && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Height (cm)</label>
                <input type="number" min="50" max="300" step="0.5" placeholder="170" value={height}
                  onChange={(e) => setHeight(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Weight (kg)</label>
                <input type="number" min="10" max="1000" step="0.1" placeholder="70" value={weight}
                  onChange={(e) => setWeight(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">DOB (optional)</label>
                <input type="date" max={new Date().toLocaleDateString('en-CA')} value={dob}
                  onChange={(e) => setDob(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Sex</label>
                <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          )}

          {needsTarget && (
            <>
              <div>
                <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Weight (kg)</label>
                <input type="number" min="10" max="1000" step="0.1" placeholder="70"
                  value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)}
                  className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 outline-none focus:border-[var(--accent)]" />
              </div>
              {!firstSetup && paceOptions.length > 0 && (
                <div>
                  <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Pace</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {paceOptions.map((p) => (
                      <button type="button" key={p} onClick={() => setPace(p)}
                        className={`h-10 px-4 rounded-full text-[length:var(--fs-12)] font-bold uppercase tracking-wider border transition-colors ${pace === p
                          ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]'
                          : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-12 rounded-[12px] border border-[var(--border-light)] font-bold text-[length:var(--fs-13)]">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 h-12 rounded-[12px] bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[length:var(--fs-13)] disabled:opacity-50">
              {saving ? 'Saving…' : firstSetup ? 'Create plan' : 'Update Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeGoalModal;
