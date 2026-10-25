import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/apiClient.js';
import Icon from '../../../../components/Icon.jsx';
import Button from '../../../../components/ui/Button.jsx';
import {
  ACTIVITY_LEVELS,
  SLEEP_QUALITY,
  STRESS_LEVELS,
  EXERCISE_FREQ,
  EXERCISE_FREQ_LABELS,
  RECOVERY_LEVELS,
} from '../../Onboarding/constants/goals.js';

// Common allergens offered as toggle chips; "Something else?" adds free text.
// Mirrors onboarding's ALLERGEN_PRESETS so the two screens stay in sync.
const ALLERGEN_PRESETS = ['Gluten', 'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Fish', 'Shellfish', 'Soy', 'Sesame'];
const MAX_CUSTOM = 40;

// Eyebrow label used by every field. Matches Profile.jsx's shared <Eyebrow>.
const FieldLabel = ({ children, hint }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{children}</span>
    {hint && <span className="text-[length:var(--fs-9)] text-[var(--text-disabled)] shrink-0">{hint}</span>}
  </div>
);

// Horizontal pill strip. flex-wrap keeps tiny 320px screens readable, and the
// active pill stays legible in both themes (accent bg + inverse text).
const PillGroup = ({ label, hint, value, options, onChange }) => (
  <div>
    <FieldLabel hint={hint}>{label}</FieldLabel>
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.key}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`h-10 px-4 rounded-full text-[length:var(--fs-12)] font-bold uppercase tracking-wider border transition-colors ${
            value === o.key
              ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]'
              : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

// The three recovery-style questions share LOW / MODERATE / HIGH, so stacking
// three identical pill groups reads as noise. A segmented card keeps them
// compact and lets each row show a one-line consequence instead.
const SegmentedRow = ({ icon, label, value, options, onChange }) => (
  <div className="flex items-center gap-3 py-2.5">
    <span className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
      <Icon name={icon} className="text-[length:var(--fs-18)] text-[var(--accent)]" />
    </span>
    <span className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] shrink-0 w-[86px] leading-tight">{label}</span>
    <div className="flex-1 min-w-0 flex justify-end">
      <div className="inline-flex bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-full p-1 gap-1">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`px-3 h-8 rounded-full text-[length:var(--fs-11)] font-bold uppercase tracking-wider transition-colors ${
              value === o ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {o === 'MODERATE' ? 'Mod' : o}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default function PersonalizationSection({ userId, onboarding, onSaved, showToast }) {
  const [allergies, setAllergies] = useState([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [exerciseFreq, setExerciseFreq] = useState('');
  const [recoveryLevel, setRecoveryLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Seed lifestyle fields from the active goal (already loaded by Profile).
  useEffect(() => {
    if (!onboarding) return;
    setActivityLevel(onboarding.activityLevel || '');
    setSleepHours(onboarding.sleepHours != null ? String(onboarding.sleepHours) : '');
    setSleepQuality(onboarding.sleepQuality || '');
    setStressLevel(onboarding.stressLevel || '');
    setExerciseFreq(onboarding.exerciseFreq || '');
    setRecoveryLevel(onboarding.recoveryLevel || '');
  }, [onboarding]);

  // Load saved allergies once. Best-effort: a failure just leaves the list empty.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiFetch('/api/auth/allergies')
      .then((d) => { if (alive) setAllergies(Array.isArray(d?.allergies) ? d.allergies : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  const toggleAllergy = (name) =>
    setAllergies((list) => (list.includes(name) ? list.filter((x) => x !== name) : [...list, name]));

  const addCustomAllergy = () => {
    const v = customAllergy.trim();
    if (v.length < 2 || allergies.length >= 30) return;
    if (!allergies.some((x) => x.toLowerCase() === v.toLowerCase())) setAllergies((l) => [...l, v]);
    setCustomAllergy('');
  };

  // Custom entries are anything outside the preset list — shown as removable
  // chips so users can undo a typo without clearing the whole set.
  const customAllergies = allergies.filter((a) => !ALLERGEN_PRESETS.includes(a));

  const stepSleep = (delta) =>
    setSleepHours((v) => {
      const base = v === '' ? 7 : Number(v);
      return String(Math.min(24, Math.max(0, base + delta)));
    });

  const save = async () => {
    if (saving) return;
    // sleepHours stays '' when untouched → sent as null (backend clears it).
    const sh = sleepHours === '' ? null : Number(sleepHours);
    if (sh != null && (!Number.isFinite(sh) || sh < 0 || sh > 24)) {
      setError('Sleep hours must be between 0 and 24.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Allergies: whole-list replace via the existing onboarding endpoint.
      await apiFetch('/api/auth/complete-onboarding', {
        method: 'POST',
        body: JSON.stringify({ allergies }),
      });
      // Lifestyle: carriedBody keeps dob/sex/height/weight/goal/target/pace,
      // overrides only these fields, then regenerates the plan + calorie targets.
      const data = await apiFetch(`/api/goals/${userId}/change`, {
        method: 'PATCH',
        body: JSON.stringify({
          activityLevel,
          sleepHours: sh,
          sleepQuality,
          stressLevel,
          exerciseFreq,
          recoveryLevel,
        }),
      });
      onSaved?.(data?.goal);
      showToast?.('Personalization saved — plan updated');
    } catch (err) {
      setError(err.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <p className="bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-xl text-[var(--error)] text-[length:var(--fs-11)] font-semibold p-2.5 flex items-center gap-2">
          <Icon name="error" className="text-[length:var(--fs-16)] shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      )}

      {/* Food Allergies — presets + custom, with custom entries removable */}
      <div>
        <FieldLabel hint="Flagged in meal scans">Food Allergies</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {ALLERGEN_PRESETS.map((a) => (
            <button
              type="button"
              key={a}
              aria-pressed={allergies.includes(a)}
              onClick={() => toggleAllergy(a)}
              className={`h-10 px-4 rounded-full text-[length:var(--fs-12)] font-bold uppercase tracking-wider border transition-colors ${
                allergies.includes(a)
                  ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]'
                  : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {customAllergies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {customAllergies.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => toggleAllergy(a)}
                aria-label={`Remove ${a}`}
                className="h-10 pl-3.5 pr-2 rounded-full text-[length:var(--fs-12)] font-bold uppercase tracking-wider border border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] inline-flex items-center gap-1.5 transition-colors hover:border-[var(--error)] hover:text-[var(--error)]"
              >
                <span className="max-w-[140px] truncate">{a}</span>
                <Icon name="close" className="text-[length:var(--fs-15)]" />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-2.5">
          <input
            value={customAllergy}
            onChange={(e) => setCustomAllergy(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAllergy(); } }}
            placeholder="Add another allergy"
            maxLength={MAX_CUSTOM}
            className="flex-1 min-w-0 h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <Button
            type="button"
            variant="subtle"
            onClick={addCustomAllergy}
            disabled={customAllergy.trim().length < 2}
            className="h-12 min-h-[44px] shrink-0"
          >
            Add
          </Button>
        </div>
      </div>

      {/* Activity Level — full descriptions so the choice is unambiguous */}
      <div>
        <FieldLabel>How Active Are You?</FieldLabel>
        <div className="mt-2 space-y-2">
          {ACTIVITY_LEVELS.map((a) => {
            const active = activityLevel === a.key;
            return (
              <button
                type="button"
                key={a.key}
                aria-pressed={active}
                onClick={() => setActivityLevel(a.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-[14px] border text-left transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                    : 'border-[var(--border-light)] bg-[var(--bg-hover)] hover:border-[var(--border-medium)]'
                }`}
              >
                <span className="w-9 h-9 rounded-xl bg-[var(--bg-active)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                  <Icon name={a.icon} className="text-[length:var(--fs-20)] text-[var(--accent)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[length:var(--fs-13)] font-bold text-[var(--text-primary)]">{a.label}</span>
                  <span className="block text-[length:var(--fs-11)] text-[var(--text-muted)] truncate">{a.desc}</span>
                </span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-[var(--accent)]' : 'border-[var(--border-medium)]'}`}>
                  {active && <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sleep hours — explicit stepper, icons via the shared Icon component */}
      <div>
        <FieldLabel hint="0–24h">Sleep Each Night</FieldLabel>
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            aria-label="Decrease sleep hours"
            onClick={() => stepSleep(-0.5)}
            className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0 text-[var(--text-primary)] active:scale-95 transition-transform"
          >
            <Icon name="remove" className="text-[length:var(--fs-20)]" />
          </button>
          <div className="flex-1 min-w-0 h-12 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center gap-1">
            <span className="text-[length:var(--fs-18)] font-black tabular-nums text-[var(--text-primary)]">
              {sleepHours === '' ? '—' : Number(sleepHours)}
            </span>
            <span className="text-[length:var(--fs-12)] font-bold text-[var(--text-muted)]">hrs</span>
          </div>
          <button
            type="button"
            aria-label="Increase sleep hours"
            onClick={() => stepSleep(0.5)}
            className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0 text-[var(--text-primary)] active:scale-95 transition-transform"
          >
            <Icon name="add" className="text-[length:var(--fs-20)]" />
          </button>
        </div>
      </div>

      {/* Exercise Frequency */}
      <PillGroup
        label="Exercise Frequency"
        value={exerciseFreq}
        onChange={setExerciseFreq}
        options={EXERCISE_FREQ.map((k) => ({ key: k, label: EXERCISE_FREQ_LABELS[k] || k.replace(/_/g, ' ') }))}
      />

      {/* Sleep quality / Stress / Recovery — one compact card, since all three
          share LOW · MODERATE · HIGH and read better side by side */}
      <div>
        <FieldLabel hint="Used for readiness">Daily Feel</FieldLabel>
        <div className="mt-2 glass-card border border-[var(--border-light)] rounded-2xl px-3 divide-y divide-[var(--border-light)]">
          <SegmentedRow icon="bedtime" label="Sleep" value={sleepQuality} options={SLEEP_QUALITY} onChange={setSleepQuality} />
          <SegmentedRow icon="bolt" label="Stress" value={stressLevel} options={STRESS_LEVELS} onChange={setStressLevel} />
          <SegmentedRow icon="fitness_center" label="Recovery" value={recoveryLevel} options={RECOVERY_LEVELS} onChange={setRecoveryLevel} />
        </div>
      </div>

      <div className="pt-1">
        <Button type="button" onClick={save} loading={saving} fullWidth className="h-12">
          {saving ? 'Saving…' : 'Save Personalization'}
        </Button>
        <p className="text-[length:var(--fs-10)] text-[var(--text-disabled)] text-center mt-2.5 leading-relaxed">
          Updating activity, sleep, stress or recovery recalculates your calorie targets and regenerates your workout plan.
        </p>
      </div>
    </div>
  );
}
