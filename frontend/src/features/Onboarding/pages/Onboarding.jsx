import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- false positive: `motion` is used as <motion.*> JSX namespace below
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth.jsx';
import Icon from '../../../components/Icon.jsx';
import { apiPost } from '../../../lib/apiClient.js';
import { safeSet, safeSetJSON, safeGetJSON } from '../../../lib/storage.js';
import {
  GOAL_TYPES, ACTIVITY_LEVELS, PACES, FOCUSES,
  SLEEP_QUALITY, STRESS_LEVELS, EXERCISE_FREQ, RECOVERY_LEVELS,
  goalLabel, humanizeOption, validateTargetWeight,
} from '../constants/goals.js';

const TOTAL_STEPS = 8;

const calcBmi = (hCm, wKg) => {
  const h = Number(hCm) / 100;
  const w = Number(wKg);
  if (!h || !w || h <= 0) return null;
  return Number((w / (h * h)).toFixed(1));
};

const bmiCategory = (bmi) => {
  if (bmi == null) return '—';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const inputCls = 'mt-1 w-full h-11 min-h-[44px] rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[16px] sm:text-[14px] tabular-nums outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed';
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] leading-tight mb-1.5';
const cardCls = (active) => `text-left p-4 rounded-[14px] border transition-colors h-full flex flex-col focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${active ? 'border-[var(--accent)] bg-[var(--accent-bg)] ring-1 ring-[var(--accent)]/40' : 'border-[var(--border-light)] bg-[var(--bg-hover)] hover:border-[var(--border-medium)]'}`;

const Chip = ({ active, onClick, children, label }) => (
  <button type="button" onClick={onClick} aria-pressed={Boolean(active)}
    aria-label={label}
    className={`min-h-[44px] px-4 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider border transition-colors active:scale-95 ${active ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'}`}>
    {children}
  </button>
);

const TITLES = [
  'Set Up Your Profile',
  'Your Current BMI',
  'What Do You Want to Achieve?',
  'Goal Details',
  'How Active Are You?',
  'Your Lifestyle',
  'Generating Your Plan',
  'Your Plan Is Ready',
];

// Gated 8-step fitness onboarding: AboutYou → BMI → Goal → Details →
// Activity → Lifestyle → Generate → PlanReady. Skippable; gate re-prompts.
const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading, refreshAuth } = useAuth();
  const [step, setStep] = useState(0);

  // Step 1 — About you
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  // Optional measurements: users who don't know their height/weight can skip
  // them — calorie plan generation is deferred until Profile has real numbers.
  const [skipMeasures, setSkipMeasures] = useState(false);
  // Step 3 — Goal
  const [goalType, setGoalType] = useState('');
  // Step 4 — Details
  const [targetWeight, setTargetWeight] = useState('');
  const [pace, setPace] = useState('');
  const [focus, setFocus] = useState('');
  // Step 5 — Activity
  const [activityLevel, setActivityLevel] = useState('');
  // Step 6 — Lifestyle
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('MODERATE');
  const [stressLevel, setStressLevel] = useState('MODERATE');
  const [exerciseFreq, setExerciseFreq] = useState('1_2_DAYS');
  const [recoveryLevel, setRecoveryLevel] = useState('MODERATE');
  // Step 7 — Result
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const bmi = useMemo(() => calcBmi(heightCm, weightKg), [heightCm, weightKg]);

  // UI-only: move screen-reader + keyboard focus to the step title on change.
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus?.({ preventScroll: true });
  }, [step]);

  // UI-only: progressive "generating" indicator (was: all ✓ instantly, even
  // while the plan request was still in flight). Purely cosmetic timing.
  const GEN_STEPS = ['Analyzing your profile', 'Understanding your goals', 'Calculating your targets', 'Building your plan'];
  const [genIdx, setGenIdx] = useState(0);
  useEffect(() => {
    if (step !== 6 || error) return;
    setGenIdx(0);
    const t = setInterval(() => setGenIdx((i) => Math.min(i + 1, GEN_STEPS.length - 1)), 700);
    return () => clearInterval(t);
  }, [step, error]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time onboarding: users who already completed (or skipped) never see
  // the wizard again — their data lives in Profile from then on.
  // Strict one-time wizard: completed users always bounce to the dashboard.
  // Their answers stay viewable in Profile → My Goals; goal edits go through
  // the Change Goal flow, never a second wizard run.
  useEffect(() => {
    if (!loading && user?.onboardingCompleted === true) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user?.onboardingCompleted, navigate]);

  // Skip is permanent per account, not per device: persist server-side so a
  // logout, a new device, or a cleared cache never re-prompts onboarding.
  // Fix: only write local flag AFTER server confirms — never diverge.
  const skip = async () => {
    try {
      await apiPost('/api/auth/complete-onboarding', {});
      safeSet('vitalis:onboarding', 'skipped');
      try { await refreshAuth?.(); } catch { /* cache fallback below covers it */ }
      const cached = safeGetJSON('vitalis_user', null);
      if (cached) safeSetJSON('vitalis_user', { ...cached, onboardingCompleted: true });
      navigate('/dashboard');
    } catch {
      // Offline/server failure: navigate for this session only, do NOT set
      // permanent 'skipped' — user will be re-prompted next load (no divergence).
      // Store a session-only flag so the gate doesn't loop mid-session.
      try { sessionStorage.setItem('vitalis:onboarding:session-skip', '1'); } catch { /* ignore */ }
      navigate('/dashboard');
    }
  };

  const isValidDob = (v) => {
    if (!v) return false;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (d > now) return false;
    const age = (now - d) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 13 && age <= 120;
  };

  const canContinue = () => {
    switch (step) {
      case 0: {
        // Birth date is optional — only validated when actually entered.
        if (dob && !isValidDob(dob)) return false;
        if (!sex) return false;
        if (skipMeasures) return true;
        const h = Number(heightCm);
        const w = Number(weightKg);
        return h >= 100 && h <= 230 && w >= 30 && w <= 250;
      }
      case 1: return true;
      case 2: return Boolean(goalType);
      case 3:
        if (goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT') {
          return validateTargetWeight(goalType, targetWeight, weightKg) === '' && Boolean(pace);
        }
        if (goalType === 'BUILD_MUSCLE') return Boolean(focus);
        if (goalType === 'MAINTAIN_WEIGHT' || goalType === 'PERFORMANCE') return Boolean(focus);
        return false;
      case 4: return Boolean(activityLevel);
      case 5: {
        const s = Number(sleepHours);
        return sleepHours !== '' && Number.isFinite(s) && s > 0 && s <= 14;
      }
      default: return true;
    }
  };

  // UI-only hint explaining what the disabled Continue is waiting for.
  // Mirrors canContinue() without touching its logic. Birth date and
  // measurements are optional, so there is no birth-date gate message —
  // only a gentle nudge when an entered date is unusable.
  const stepHint = () => {
    switch (step) {
      case 0: {
        if (dob && !isValidDob(dob)) return 'That birth date doesn’t look right — fix it or leave it blank.';
        if (!sex) return 'Select an option for metabolic calculation.';
        if (skipMeasures) return '';
        const h = Number(heightCm);
        const w = Number(weightKg);
        if (!(h >= 100 && h <= 230)) return 'Height must be 100–230 cm, or tick “I don’t know”.';
        if (!(w >= 30 && w <= 250)) return 'Weight must be 30–250 kg, or tick “I don’t know”.';
        return '';
      }
      case 2: return goalType ? '' : 'Select a goal to continue.';
      case 3: {
        if (goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT') {
          const targetError = validateTargetWeight(goalType, targetWeight, weightKg);
          if (targetError) return targetError;
          if (!pace) return 'Choose your preferred progress pace.';
          return '';
        }
        if (!focus) return 'Choose a focus to continue.';
        return '';
      }
      case 4: return activityLevel ? '' : 'Choose the level closest to your week.';
      case 5: {
        const s = Number(sleepHours);
        if (sleepHours === '' || !Number.isFinite(s) || s <= 0 || s > 14) {
          return 'Enter average sleep (0–14 hours).';
        }
        return '';
      }
      default: return '';
    }
  };

  // Step 7 — generate plan on entry (skipped when measurements were
  // deferred: the backend plan engine requires real height/weight).
  useEffect(() => {
    if (step !== 6 || !user?.id || plan) return;
    if (!(Number(heightCm) > 0 && Number(weightKg) > 0)) {
      setSaving(false);
      setError('');
      return;
    }
    (async () => {
      setSaving(true); setError('');
      try {
        const data = await apiPost(`/api/goals/${user.id}`, {
          dob, sex, heightCm: Number(heightCm), weightKg: Number(weightKg),
          goalType, targetWeightKg: targetWeight ? Number(targetWeight) : null,
          pace: pace || null, focus: focus || null, activityLevel,
          sleepHours: Number(sleepHours),
          sleepQuality, stressLevel, exerciseFreq, recoveryLevel,
        });
        if (!data?.goal) throw new Error('Could not generate your plan.');
        setPlan(data);
        setTimeout(() => setStep(7), 1600);
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    })();
  }, [step, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async () => {
    setSaving(true); setError('');
    try {
      // Fail-closed: do NOT swallow — on failure we must stay and show error,
      // never mark done / navigate (was: .catch(()=>null) faked success).
      await apiPost('/api/auth/complete-onboarding', {});
      try { await refreshAuth?.(); } catch { /* fallback below covers it */ }
      safeSet('vitalis:onboarding', 'done');
      const cached = safeGetJSON('vitalis_user', null);
      if (cached) safeSetJSON('vitalis_user', { ...cached, onboardingCompleted: true });
      // Best-effort: seed a personal 7-day starter from the new goal.
      // Never blocks navigation — Plans offers Generate as fallback.
      try { await apiPost('/api/plans/auto-from-goal', {}); } catch { /* ignore */ }
      navigate('/dashboard/plans?mine=1');
    } catch (e) {
      setError(e?.message || 'Could not finish. Check connection and try again — you can skip for now.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => { setError(''); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); };

  // UI-only: evaluate the gate once per render for nav + hint.
  const canGo = canContinue();
  const hint = canGo || step >= 6 ? '' : stepHint();
  // Calorie plan generation needs real numbers — without them the wizard
  // completes without a generated plan (added later in Profile).
  const missingMeasures = !(Number(heightCm) > 0 && Number(weightKg) > 0);

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center px-3 py-6 sm:p-4 overflow-y-auto relative">
      <div className="glass-content w-full flex items-center justify-center">
      <div className="w-full max-w-[600px] 2xl:max-w-[640px] m-auto glass-panel border border-[var(--border-light)] rounded-[20px] p-5 sm:p-8 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--text-muted)] whitespace-nowrap">
            Onboarding • Step {step + 1} of {TOTAL_STEPS}
          </p>
          <button type="button" onClick={skip} className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 min-h-[32px] px-1">Skip for now</button>
        </div>
        <div className="h-[3px] bg-[var(--bg-hover)] rounded-full mt-2.5 mb-5 overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
        <h1 ref={titleRef} tabIndex={-1} className="text-[20px] sm:text-[22px] font-bold tracking-tight leading-snug text-balance outline-none">{TITLES[step]}</h1>

        {/* UI-only step transition (respects OS reduced-motion via MotionConfig) */}
        <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
        {/* STEP 1 — About you */}
        {step === 0 && (
          <div className="mt-5 space-y-4">
            <div>
              <label className={labelCls}>Date of Birth <span className="font-semibold normal-case tracking-normal text-[var(--text-disabled)]">— optional</span></label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sex (for metabolic calculation)</label>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                {['MALE', 'FEMALE', 'OTHER'].map((s) => <Chip key={s} active={sex === s} onClick={() => setSex(s)}>{s}</Chip>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="min-w-0">
                <label className={`${labelCls} min-h-7`}>Height (cm)</label>
                <input type="number" min="100" max="230" placeholder="175" value={heightCm} disabled={skipMeasures} onChange={(e) => setHeightCm(e.target.value)} className={inputCls} />
              </div>
              <div className="min-w-0">
                <label className={`${labelCls} min-h-7`}>Current Weight (kg)</label>
                <input type="number" min="30" max="250" placeholder="80" value={weightKg} disabled={skipMeasures} onChange={(e) => setWeightKg(e.target.value)} className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipMeasures}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSkipMeasures(on);
                  if (on) { setHeightCm(''); setWeightKg(''); }
                }}
                className="w-5 h-5 min-w-[20px] min-h-[20px] shrink-0 accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[13px] text-[var(--text-secondary)]">I don’t know my height / weight — I’ll add them later in Profile</span>
            </label>
          </div>
        )}

        {/* STEP 2 — BMI result (informs, never prescribes) */}
        {step === 1 && (
          <div className="mt-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Your Current BMI</p>
            <p className="text-[48px] sm:text-[56px] font-black leading-none tabular-nums mt-2">{bmi ?? '—'}</p>
            <p className="text-[13px] font-bold text-[var(--accent)] mt-2">BMI Category: {bmiCategory(bmi)}</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-3 max-w-[380px] mx-auto">
              BMI is a general screening measurement based on height and weight.
              It informs — you still choose your own goal next.
            </p>
            {missingMeasures && (
              <p className="text-[12px] font-semibold text-[var(--accent)] mt-2">
                Skipped for now — add measurements in Profile anytime.
              </p>
            )}
          </div>
        )}

        {/* STEP 3 — Primary goal */}
        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 items-stretch">
            {GOAL_TYPES.map((g) => (
              <button key={g.key} type="button" aria-pressed={goalType === g.key} onClick={() => { setGoalType(g.key); setPace(''); setFocus(''); setTargetWeight(''); }}
                className={cardCls(goalType === g.key)}>
                <span className="w-10 h-10 rounded-xl bg-[var(--bg-active)] border border-[var(--border-light)] flex items-center justify-center overflow-hidden shrink-0">
                  <Icon name={g.icon} className="text-[20px] text-[var(--accent)]" />
                </span>
                <p className="font-bold text-[13px] mt-2.5 uppercase tracking-[0.08em] leading-snug">{g.label}</p>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mt-1">{g.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* STEP 4 — Goal details (depends on goal) */}
        {step === 3 && (
          <div className="mt-5 space-y-4">
            {(goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT') && (
              <>
                <div className={`grid gap-3 items-start ${weightKg ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {weightKg ? (
                    <div className="min-w-0">
                      <label className={`${labelCls} min-h-7`}>Current Weight (kg)</label>
                      <input value={weightKg} disabled className={inputCls} />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <label className={`${labelCls} min-h-7`}>Target Weight (kg)</label>
                    <input type="number" min="30" max="250" placeholder={goalType === 'LOSE_WEIGHT' ? '70' : '65'}
                      value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Preferred Progress</label>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {PACES[goalType].map((p) => <Chip key={p} active={pace === p} onClick={() => setPace(p)}>{p}</Chip>)}
                  </div>
                </div>
              </>
            )}
            {goalType === 'BUILD_MUSCLE' && (
              <>
                <div>
                  <label className={labelCls}>Training Focus</label>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {FOCUSES.BUILD_MUSCLE.map((f) => <Chip key={f} active={focus === f} onClick={() => setFocus(f)}>{f}</Chip>)}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Target Weight — optional (kg)</label>
                  <input type="number" min="30" max="250" placeholder="—" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
            {goalType === 'MAINTAIN_WEIGHT' && (
              <>
                <div>
                  <label className={labelCls}>Maintain Approximately (kg)</label>
                  <input type="number" min="30" max="250" value={targetWeight || weightKg} onChange={(e) => setTargetWeight(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Primary Focus</label>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {FOCUSES.MAINTAIN_WEIGHT.map((f) => { const text = humanizeOption(f); return <Chip key={f} label={text} active={focus === f} onClick={() => setFocus(f)}>{text}</Chip>; })}
                  </div>
                </div>
              </>
            )}
            {goalType === 'PERFORMANCE' && (
              <div>
                <label className={labelCls}>Performance Focus</label>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                    {FOCUSES.PERFORMANCE.map((f) => { const text = humanizeOption(f); return <Chip key={f} label={text} active={focus === f} onClick={() => setFocus(f)}>{text}</Chip>; })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — Activity level */}
        {step === 4 && (
          <div className="grid grid-cols-1 gap-2.5 mt-5">
            {ACTIVITY_LEVELS.map((a) => (
              <button key={a.key} type="button" aria-pressed={activityLevel === a.key} onClick={() => setActivityLevel(a.key)} className={cardCls(activityLevel === a.key)}>
                <span className="flex items-center gap-3 min-w-0 w-full">
                  <span className="w-9 h-9 rounded-xl bg-[var(--bg-active)] border border-[var(--border-light)] flex items-center justify-center shrink-0 overflow-hidden">
                    <Icon name={a.icon} className="text-[20px] text-[var(--accent)]" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-bold text-[13px] uppercase tracking-[0.08em] leading-snug">{a.label}</span>
                    <span className="block text-[12px] text-[var(--text-muted)] leading-relaxed mt-0.5">{a.desc}</span>
                  </span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${activityLevel === a.key ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-medium)]'}`} aria-hidden="true">
                    {activityLevel === a.key && <span className="text-[11px] font-black text-[var(--accent-solid-fg)] leading-none">✓</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* STEP 6 — Lifestyle baseline */}
        {step === 5 && (
          <div className="mt-5 space-y-4">
            <div>
              <label className={labelCls}>Average Sleep Duration (hours)</label>
              <input type="number" min="0" max="14" step="0.5" placeholder="7.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className={inputCls} />
            </div>
            {[
              ['Typical Sleep Quality', SLEEP_QUALITY, sleepQuality, setSleepQuality],
              ['Typical Stress Level', STRESS_LEVELS, stressLevel, setStressLevel],
              ['Current Exercise Frequency', EXERCISE_FREQ, exerciseFreq, setExerciseFreq],
              ['Typical Recovery / Energy', RECOVERY_LEVELS, recoveryLevel, setRecoveryLevel],
            ].map(([label, opts, val, set]) => (
              <div key={label}>
                <label className={labelCls}>{label}</label>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {opts.map((o) => {
                    const text = humanizeOption(o);
                    return <Chip key={o} label={text} active={val === o} onClick={() => set(o)}>{text}</Chip>;
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">This creates your initial recovery baseline. Daily values are logged separately later.</p>
          </div>
        )}

        {/* STEP 7 — Generating */}
        {step === 6 && (
          <div className="mt-5">
            {missingMeasures && !plan ? (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[24px] text-[var(--accent)]">person_add</span>
                </div>
                <p className="text-[15px] font-bold">No measurements, no problem</p>
                <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mt-1.5 max-w-[380px] mx-auto">
                  You skipped height and weight, so there’s nothing to calculate yet.
                  Add them anytime in Profile and Vitalis will build your targets.
                </p>
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  className="h-11 min-h-[44px] px-5 mt-5 rounded-[12px] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-95 transition-all"
                >
                  {saving ? 'Saving...' : 'Continue to Dashboard'}
                </button>
              </div>
            ) : error ? (
              <div className="text-center">
                <p role="alert" className="text-[13px] font-semibold text-[var(--error)] mb-4">{error}</p>
                <button type="button" onClick={() => setStep(5)} className="h-11 px-5 rounded-[12px] border border-[var(--border-light)] text-[13px] font-bold">Back</button>
              </div>
            ) : (
              <ul className="space-y-3.5" aria-live="polite">
                {GEN_STEPS.map((t, i) => (
                  <li key={t} className={`flex items-center gap-3 text-[13px] font-medium leading-snug ${i > genIdx ? 'opacity-40' : ''}`}>
                    {i < genIdx || (!saving && i <= genIdx) ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] flex items-center justify-center text-[12px] font-black shrink-0" aria-hidden="true">✓</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0">{t}{i === GEN_STEPS.length - 1 && saving ? '...' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* STEP 8 — Plan ready */}
        {step === 7 && plan?.goal && (
          <div className="mt-5 space-y-3">
            <div className="p-4 rounded-[14px] bg-[var(--accent-bg)] border border-[var(--accent-border)] text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Primary Goal</p>
              <p className="text-[20px] font-black tracking-tight mt-1">{goalLabel(plan.goal.goalType)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-center">
              <div className="p-2.5 sm:p-3 rounded-[12px] bg-[var(--bg-hover)] border border-[var(--border-light)] min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Current</p>
                <p className="font-black text-[14px] sm:text-[16px] tabular-nums truncate mt-0.5">{plan.goal.weightKg} kg</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-[12px] bg-[var(--bg-hover)] border border-[var(--border-light)] min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Target</p>
                <p className="font-black text-[14px] sm:text-[16px] tabular-nums truncate mt-0.5">{plan.goal.targetWeightKg ?? '—'}{plan.goal.targetWeightKg ? ' kg' : ''}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-[12px] bg-[var(--bg-hover)] border border-[var(--border-light)] min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">BMI</p>
                <p className="font-black text-[14px] sm:text-[16px] tabular-nums truncate mt-0.5">{plan.goal.bmi ?? '—'}</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Daily Energy Target</p>
              <p className="text-[28px] sm:text-[32px] font-black tabular-nums text-[var(--accent)] leading-tight mt-1">{plan.plan?.dailyKcal?.toLocaleString() ?? '—'} <span className="text-[12px] font-bold">kcal</span></p>
              <p className="text-[12px] text-[var(--text-muted)] tabular-nums mt-1.5 leading-relaxed">
                Protein {plan.plan?.proteinG ?? '—'}g · Carbs {plan.plan?.carbsG ?? '—'}g · Fat {plan.plan?.fatG ?? '—'}g
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)] text-center max-w-[420px] mx-auto">
              Initial estimates based on your info. Vitalis refines them as you log nutrition, activity, weight and recovery.
            </p>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
        </MotionConfig>

        {error && step !== 6 && <p role="alert" className="text-[12px] font-semibold leading-relaxed text-[var(--error)] mt-4 break-words">{error}</p>}

        {hint ? (
          <p role="status" className="text-[12px] font-semibold text-[var(--text-muted)] mt-4 text-center sm:text-right">{hint}</p>
        ) : null}
        {step !== 6 && (
        <div className="flex items-center justify-between gap-3 mt-5 pt-5 border-t border-[var(--border-light)]">
          <div className="min-w-0">
            {step > 0 && step < 6 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="h-11 min-h-[44px] px-4 rounded-[12px] border border-[var(--border-light)] text-[13px] font-bold hover:bg-[var(--bg-hover)] active:scale-95 transition-all">Back</button>
            )}
          </div>
          <div className="shrink-0">
            {step < 6 && (
              <button type="button" onClick={next} disabled={!canGo} aria-disabled={!canGo} className="h-11 min-h-[44px] px-5 rounded-[12px] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 active:scale-95 transition-all">
                {step === 5 ? (missingMeasures ? 'Continue' : 'Generate My Plan') : 'Continue'}
              </button>
            )}
            {step === 7 && (
              <button type="button" onClick={finish} disabled={saving} className="h-11 min-h-[44px] px-5 rounded-[12px] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-95 transition-all">
                {saving ? 'Saving...' : 'Start Training'}
              </button>
            )}
          </div>
        </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Onboarding;
