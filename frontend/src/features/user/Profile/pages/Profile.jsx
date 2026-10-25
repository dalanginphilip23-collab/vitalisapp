// pages/Profile.jsx — redesigned to match reference image (dark + green header + 3 stats + accordion)
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav } from '../../../../components/index.js';
import AccountPageShell from '../../../../components/app/AccountPageShell.jsx';
import PageHeader from '../../../../components/app/PageHeader.jsx';
import { useProfile } from '../hooks/useProfile.js';
import { useAvatar } from '../hooks/useAvatar.js';
import Toast from '../components/Toast.jsx';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { DEFAULT_AVATARS } from '../utils/avatar.js';
import { resolveAvatar, avatarSurface, getInitials, capitalizeName } from '../../../../lib/avatar.js';
import { apiFetch } from '../../../../lib/apiClient.js';
import { goalLabel, activityLabel, GOAL_TYPES } from '../../Onboarding/constants/goals.js';
import '../profile.css';

// Editors are opened on demand. Keeping them out of the initial Profile chunk
// makes first paint cheaper without changing any of their behaviour.
const ChangePasswordModal = lazy(() => import('../components/ChangePasswordModal.jsx'));
const ForgotPasswordModal = lazy(() => import('../components/ForgotPasswordModal.jsx'));
const ChangeGoalModal = lazy(() => import('../components/ChangeGoalModal.jsx'));
const DeactivateAccountModal = lazy(() => import('../components/DeactivateAccountModal.jsx'));
const PersonalizationSection = lazy(() => import('../components/PersonalizationSection.jsx'));

const computeBMI = (heightCm, weightKg) => {
  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);
  if (!h || !w) return null;
  const m = h / 100;
  return +(w / (m * m)).toFixed(1);
};
const bmiCategory = (bmi) => {
  if (bmi == null) return { label: '—', color: 'var(--text-disabled)' };
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25) return { label: 'Normal', color: 'var(--accent)' };
  if (bmi < 30) return { label: 'Overweight', color: '#f59e0b' };
  return { label: 'Obese', color: '#f87171' };
};
const calcBMR = (weight, height, age, gender) => {
  if (!weight || !height || !age) return null;
  const w = parseFloat(weight), h = parseFloat(height), a = parseFloat(age);
  if (gender === 'female') return Math.round(10 * w + 6.25 * h - 5 * a - 161);
  return Math.round(10 * w + 6.25 * h - 5 * a + 5);
};
const activityFactors = { Sedentary: 1.2, 'Lightly Active': 1.375, 'Moderately Active': 1.55, 'Very Active': 1.725, 'Extra Active': 1.9 };

// Humanize raw DB enums for display: "12_DAYS" → "12 days", "GRADUAL" → "Gradual".
const humanize = (v) => {
  if (v == null || v === '') return '—';
  const s = String(v).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Goal snapshot card — the single home for onboarding goal details.
// Rendered inside the "My Goals" section (not duplicated in Body Metrics).
const GoalSnapshotCard = ({ onboarding, onChangeGoal, onSetupPlan }) => {
  if (!onboarding) {
    return (
      <div className="text-center py-3 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] space-y-2">
        <p className="text-[length:var(--fs-12)] text-[var(--text-muted)]">No plan yet — set it up right here</p>
        <button type="button" onClick={onSetupPlan} className="inline-flex py-1.5 px-4 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-11)] font-black active:scale-95 transition-transform">Set Up Your Plan</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Eyebrow>Your Plan</Eyebrow>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3">
          <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Goal</p>
          <p className="text-[length:var(--fs-13)] font-bold text-[var(--accent)] mt-1">{goalLabel(onboarding.goalType)}</p>
          {onboarding.focus && <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] mt-0.5">{humanize(onboarding.focus)}</p>}
          {onboarding.targetWeightKg != null && <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] mt-0.5 tabular-nums">Target: {Number(onboarding.targetWeightKg).toFixed(1)} kg</p>}
        </div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3">
          <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity</p>
          <p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] mt-1">{activityLabel(onboarding.activityLevel)}</p>
          {onboarding.pace && <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] mt-0.5">{humanize(onboarding.pace)}</p>}
        </div>
      </div>
      {onboarding.dailyKcal != null && (
        <div className="rounded-[16px] p-4 text-center bg-[var(--accent-bg)] border border-[var(--accent-border)]">
          <p className="text-[length:var(--fs-10)] font-bold tracking-[0.16em] uppercase text-[var(--text-muted)]">Plan Daily Target</p>
          <p className="text-[length:var(--fs-24)] font-black text-[var(--accent)] mt-1 tabular-nums">{Number(onboarding.dailyKcal).toLocaleString()} <span className="text-[length:var(--fs-12)] font-bold text-[var(--text-muted)]">kcal</span></p>
          <p className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)] mt-1 tabular-nums">P {onboarding.proteinG ?? '—'}g · C {onboarding.carbsG ?? '—'}g · F {onboarding.fatG ?? '—'}g</p>
        </div>
      )}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 text-center [&>div]:min-w-0">
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Sleep</p><p className="text-[length:var(--fs-12)] font-bold mt-1 break-words">{onboarding.sleepHours != null ? `${onboarding.sleepHours}h` : '—'} · {humanize(onboarding.sleepQuality)}</p></div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Stress · Recovery</p><p className="text-[length:var(--fs-12)] font-bold mt-1 break-words">{humanize(onboarding.stressLevel)} · {humanize(onboarding.recoveryLevel)}</p></div>
        <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-3 py-2.5"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Exercise</p><p className="text-[length:var(--fs-12)] font-bold mt-1 break-words">{humanize(onboarding.exerciseFreq)}</p></div>
      </div>
      <button onClick={onChangeGoal} className="w-full py-2.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-bg)] text-[length:var(--fs-11)] font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--text-inverse)] transition-colors">Change Goal</button>
    </div>
  );
};

const BodyMetricsPanel = ({ USER_ID, initialWeight, initialHeight, onboarding, showToast, onMetricsSaved = undefined, onIdentitySaved = undefined, editSignal }) => {
  // Identity seed — age/gender as re-derived from the active goal (dob/sex).
  // Saved values are remembered so Save only persists REAL edits.
  const seedRef = useRef({ age: '', gender: '' });
  const [weight, setWeight] = useState(initialWeight || '');
  const [height, setHeight] = useState(initialHeight || '');
  const [age, setAge] = useState('23');
  const [gender, setGender] = useState('male');
  const [activity, setActivity] = useState('Sedentary');
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [macroMode, setMacroMode] = useState('MODERATE CARB');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (initialWeight) setWeight(String(initialWeight)); }, [initialWeight]);
  useEffect(() => { if (initialHeight) setHeight(String(initialHeight)); }, [initialHeight]);
  useEffect(() => {
    if (!onboarding) return;
    let derivedAge = seedRef.current.age;
    if (onboarding.dob) {
      const dobDate = new Date(onboarding.dob);
      if (!Number.isNaN(dobDate.getTime())) {
        const ageCalc = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (ageCalc > 0 && ageCalc < 120) { setAge(String(ageCalc)); derivedAge = String(ageCalc); }
      }
    }
    const derivedSex = onboarding.sex ? String(onboarding.sex).toLowerCase() : seedRef.current.gender;
    if (onboarding.sex) setGender(derivedSex);
    if (onboarding.activityLevel) {
      const label = activityLabel(onboarding.activityLevel);
      if (activityFactors[label]) setActivity(label);
    }
    seedRef.current = { age: derivedAge, gender: derivedSex };
  }, [onboarding]);
  // NOTE: no auto-collapse effect here — collapsing on weight/height/age change
  // would close the form while the user is typing. `editing` starts false.
  // Single master Edit button (Profile) drives this panel via editSignal.
  useEffect(() => {
    if (editSignal > 0) setEditing(true);
  }, [editSignal]);

  const bmi = computeBMI(height, weight);
  const bmr = calcBMR(weight, height, age, gender);
  const tdee = bmr ? Math.round(bmr * (activityFactors[activity] || 1.2)) : null;
  const activityKcal = tdee && bmr ? tdee - bmr : null;
  const bmiInfo = bmiCategory(bmi);
  const targets = tdee ? { cut: tdee - 500, maintain: tdee, bulk: tdee + 500 } : null;
  const macros = (() => {
    if (!tdee) return null;
    let pPct = 0.30, fPct = 0.35, cPct = 0.35;
    if (macroMode === 'LOWER CARB') { pPct = 0.35; fPct = 0.40; cPct = 0.25; }
    if (macroMode === 'HIGHER CARB') { pPct = 0.25; fPct = 0.25; cPct = 0.50; }
    const pKcal = Math.round(tdee * pPct), fKcal = Math.round(tdee * fPct), cKcal = Math.round(tdee * cPct);
    return {
      protein: { g: Math.round(pKcal / 4), kcal: pKcal, pct: Math.round(pPct * 100) },
      fat: { g: Math.round(fKcal / 9), kcal: fKcal, pct: Math.round(fPct * 100) },
      carbs: { g: Math.round(cKcal / 4), kcal: cKcal, pct: Math.round(cPct * 100) },
    };
  })();

  const handleSave = async () => {
    if (!weight || !height) { showToast?.('Enter weight and height', 'error'); return; }
    setIsSaving(true);
    let identityFailed = false;
    try {
      await apiFetch(`/api/bmi/${USER_ID}`, {
        method: 'POST',
        body: JSON.stringify({ weight_kg: parseFloat(weight), height_cm: parseFloat(height), age: age || null, gender }),
      });

      // Persist identity edits on the ACTIVE GOAL (dob/sex) — the same source
      // of truth the My Account fields use, so changes finally stick. Age is
      // converted back to a DOB by shifting the saved birth year. No new DB
      // columns needed; skipped onboarding users have nothing to write to.
      if (onboarding) {
        const seed = seedRef.current;
        const identity = {};
        if (['male', 'female', 'other'].includes(gender) && gender !== seed.gender) {
          identity.sex = gender;
        }
        const dobIso = onboarding.dob ? String(onboarding.dob).slice(0, 10) : '';
        const ageNum = Number(age);
        if (dobIso && seed.age !== '' && Number.isFinite(ageNum)
            && String(ageNum) !== String(Number(seed.age))) {
          const d = new Date(`${dobIso}T00:00:00`);
          const year = new Date().getFullYear() - ageNum;
          if (!Number.isNaN(d.getTime()) && year >= 1900 && year < new Date().getFullYear()) {
            identity.dob = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
        }
        if (Object.keys(identity).length > 0) {
          try {
            const data = await apiFetch(`/api/goals/${USER_ID}/active`, {
              method: 'PATCH',
              body: JSON.stringify(identity),
            });
            onIdentitySaved?.(data?.goal);
            seedRef.current = { age: String(age), gender };
          } catch (_) {
            identityFailed = true;
          }
        }
      }

      showToast?.(identityFailed
        ? 'Metrics saved — but DOB/gender could not be updated'
        : 'Metrics saved — BMI updated', identityFailed ? 'error' : 'success');
      setEditing(false);
      onMetricsSaved?.();
    } catch (e) { showToast?.(e.message || 'Save failed', 'error'); } finally { setIsSaving(false); }
  };

  const hasResult = bmi != null && tdee != null;
  return (
    <div className="pf-body-panel">
      {/* Editable inputs — always visible when editing, collapsed to summary when not */}
      {editing ? (
        <div className="pf-metric-form">
          <div className="min-w-0"><label htmlFor="bm-weight" className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Weight (kg)</label><input id="bm-weight" type="number" min="30" max="300" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="55.0" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
          <div className="min-w-0"><label htmlFor="bm-height" className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Height (cm)</label><input id="bm-height" type="number" min="50" max="300" step="0.5" value={height} onChange={e=>setHeight(e.target.value)} placeholder="185.0" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
          <div className="min-w-0"><label htmlFor="bm-age" className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Age</label><input id="bm-age" type="number" min="5" max="120" value={age} onChange={e=>setAge(e.target.value)} placeholder="23" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
          <div className="min-w-0"><label htmlFor="bm-gender" className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gender</label><select id="bm-gender" value={gender} onChange={e=>setGender(e.target.value)} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none"><option value="male">male</option><option value="female">female</option><option value="other">other</option></select></div>
          <div className="pf-form-span min-w-0"><label htmlFor="bm-activity" className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity Level</label><select id="bm-activity" value={activity} onChange={e=>setActivity(e.target.value)} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none">{Object.keys(activityFactors).map(k=><option key={k} value={k}>{k}</option>)}</select></div>
          <div className="pf-metric-actions">
            <button onClick={()=>setEditing(false)} className="pf-metric-cancel">Cancel</button>
            <button onClick={handleSave} disabled={isSaving || !weight || !height} className="pf-metric-save">{isSaving ? 'Saving…' : 'Save & Calculate'}</button>
          </div>
        </div>
      ) : hasResult ? (
        <>
          <div className="pf-metric-summary">
            <div className="pf-metric-tile"><p className="pf-metric-label">Weight</p><p className="pf-metric-value">{parseFloat(weight).toFixed(1)} <span>kg</span></p></div>
            <div className="pf-metric-tile"><p className="pf-metric-label">Height</p><p className="pf-metric-value">{parseFloat(height).toFixed(1)} <span>cm</span></p></div>
            <div className="pf-metric-tile is-accent"><p className="pf-metric-label">BMI</p><p className="pf-metric-value" style={{ color: bmiInfo.color }}>{bmi}</p><p className="pf-metric-note" style={{ color: bmiInfo.color }}>{bmiInfo.label}</p></div>
          </div>
          <div className="pf-metric-divider" />
          <button onClick={()=>setExpanded(v=>!v)} className={`pf-metrics-toggle ${expanded ? 'is-expanded' : ''}`} aria-expanded={expanded}>View all metrics <span className="material-symbols-outlined">expand_more</span></button>
          {expanded && (
            <div className="space-y-3">
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Details</p>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Age</p><p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] mt-1">{age}</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gender</p><p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] mt-1 capitalize">{gender}</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity</p><p className="text-[length:var(--fs-11)] font-bold text-[var(--text-primary)] mt-1 leading-snug">{activity}</p></div>
              </div>
              <div className="rounded-[16px] p-4 text-center bg-[var(--accent-bg)] border border-[var(--accent-border)]">
                <p className="text-[length:var(--fs-10)] font-bold tracking-[0.16em] uppercase text-[var(--text-muted)]">Total Daily Energy Expenditure</p>
                <p className="text-[length:var(--fs-28)] font-black text-[var(--accent)] mt-1 tabular-nums">{tdee.toLocaleString()} <span className="text-[length:var(--fs-12)] font-bold text-[var(--text-muted)]">kcal</span></p>
                <p className="text-[length:var(--fs-10)] font-bold text-[var(--text-muted)] mt-1 tabular-nums">BMR {bmr.toLocaleString()} <span className="opacity-40">|</span> Activity {activityKcal}</p>
              </div>
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Calorie Targets</p>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                {[{label:'CUT', val:targets.cut, sub:'Fat loss'},{label:'MAINTAIN', val:targets.maintain, sub:'Current weight'},{label:'BULK', val:targets.bulk, sub:'Muscle gain'}].map(c=>(
                  <div key={c.label} className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center">
                    <p className="text-[length:var(--fs-10)] font-bold tracking-[0.12em] text-[var(--accent)]">{c.label}</p>
                    <p className="text-[length:var(--fs-14)] font-black text-[var(--text-primary)] mt-1 break-words tabular-nums">{c.val.toLocaleString()}</p>
                    <p className="text-[length:var(--fs-9)] text-[var(--text-muted)]">{c.sub}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] shrink-0">Macronutrients</p>
                <div className="flex gap-1 bg-[var(--bg-hover)] rounded-full p-1 overflow-x-auto no-scrollbar max-w-full">
                  {['MODERATE CARB','LOWER CARB','HIGHER CARB'].map(m=>(
                    <button key={m} onClick={()=>setMacroMode(m)} aria-pressed={macroMode===m} className={`px-3 py-1.5 rounded-full text-[length:var(--fs-10)] font-bold tracking-[0.08em] whitespace-nowrap shrink-0 min-h-[32px] ${macroMode===m ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'text-[var(--text-muted)]'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex bg-[var(--bg-hover)]">
                <div style={{width:`${macros.protein.pct}%`, background:'var(--accent)'}} />
                <div style={{width:`${macros.fat.pct}%`, background:'var(--accent)', opacity: 0.55}} />
                <div style={{width:`${macros.carbs.pct}%`, background:'var(--accent)', opacity: 0.3}} />
              </div>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold tracking-[0.12em] text-[var(--accent)]">PROTEIN</p><p className="text-[length:var(--fs-14)] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.protein.g}g</p><p className="text-[length:var(--fs-9)] text-[var(--text-muted)] tabular-nums">{macros.protein.kcal} kcal · {macros.protein.pct}%</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold tracking-[0.12em] text-[var(--accent)]">FAT</p><p className="text-[length:var(--fs-14)] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.fat.g}g</p><p className="text-[length:var(--fs-9)] text-[var(--text-muted)] tabular-nums">{macros.fat.kcal} kcal · {macros.fat.pct}%</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[length:var(--fs-10)] font-bold tracking-[0.12em] text-[var(--accent)]">CARBS</p><p className="text-[length:var(--fs-14)] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.carbs.g}g</p><p className="text-[length:var(--fs-9)] text-[var(--text-muted)] tabular-nums">{macros.carbs.kcal} kcal · {macros.carbs.pct}%</p></div>
              </div>
              <p className="flex justify-between text-[length:var(--fs-9)] text-[var(--text-disabled)]"><span>{activity}</span><span>{new Date().toISOString().slice(0,10)} · {new Date().toLocaleTimeString()}</span></p>
            </div>
          )}
        </>
      ) : (
        <div className="pf-metrics-empty">
          <span className="material-symbols-outlined">monitor_weight</span>
          <p className="pf-metrics-empty-title">No metrics recorded yet</p>
          <p className="pf-metrics-empty-copy">Weight and height unlock BMI, calorie targets and macros.</p>
        </div>
      )}
    </div>
  );
};

// Single eyebrow recipe for every section header on this page:
// 11px semibold uppercase, relaxed tracking — readable at small sizes.
const Eyebrow = ({ children, className = '' }) => (
  <p className={`text-[length:var(--fs-11)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] ${className}`}>{children}</p>
);

const GOAL_LABEL_SET = new Set(GOAL_TYPES.map((g) => g.label));
const isGoalLikeBio = (v) => GOAL_LABEL_SET.has(String(v || '').trim());

const GoalPicker = ({ value, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const current = GOAL_TYPES.find((g) => g.key === value) || null;
  const isOpen = open && !disabled;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        id="pf-goal"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full h-12 min-h-[48px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 flex items-center gap-3 text-left outline-none focus:border-[var(--accent)] disabled:opacity-60 transition-colors"
      >
        {current ? (
          <>
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[length:var(--fs-16)]" style={{ color: 'var(--accent)' }}>{current.icon}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] truncate">{current.label}</span>
              <span className="block text-[length:var(--fs-10)] text-[var(--text-muted)] truncate">{current.desc}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-[length:var(--fs-13)] text-[var(--text-muted)]">Select your goal</span>
        )}
        <span className={`material-symbols-outlined text-[length:var(--fs-20)] shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="listbox" aria-label="Choose your goal" className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
            <div className="max-h-[280px] overflow-y-auto p-1.5 space-y-1">
              {GOAL_TYPES.map((g) => {
                const selected = g.key === value;
                return (
                  <button
                    key={g.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      onPick(g.key);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${selected ? 'bg-[var(--accent-bg)] border border-[var(--accent-border)]' : 'border border-transparent hover:bg-[var(--bg-hover)]'}`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[length:var(--fs-18)]" style={{ color: 'var(--accent)' }}>{g.icon}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[length:var(--fs-13)] font-bold text-[var(--text-primary)]">{g.label}</span>
                      <span className="block text-[length:var(--fs-11)] text-[var(--text-muted)] leading-snug">{g.desc}</span>
                    </span>
                    {selected && <span className="material-symbols-outlined text-[length:var(--fs-18)] shrink-0" style={{ color: 'var(--accent)' }}>check_circle</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SectionRow = ({ icon, title, subtitle, expanded = undefined, onClick, danger = undefined, rightIcon = undefined, attention = undefined }) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={expanded ?? undefined}
    className={`pf-row ${danger ? 'is-danger' : ''} ${expanded ? 'is-expanded' : ''}`}
  >
    <span className="pf-row-icon">
      <span className="material-symbols-outlined">{icon}</span>
      {attention && <span aria-hidden="true" title="Setup incomplete" className="pf-attention" />}
    </span>
    <span className="pf-row-copy">
      <span className="pf-row-title">{title}</span>
      <span className="pf-row-sub">{subtitle}</span>
    </span>
    <span className="pf-row-chevron" aria-hidden="true">
      <span className="material-symbols-outlined">
        {rightIcon || (expanded !== undefined ? 'expand_more' : 'chevron_right')}
      </span>
    </span>
  </button>
);

const RailFact = ({ icon, label, value }) => (
  <div className="pf-fact">
    <span className="pf-fact-icon">
      <span className="material-symbols-outlined">{icon}</span>
    </span>
    <span className="pf-fact-copy">
      <span className="pf-fact-label">{label}</span>
      <span className="pf-fact-value">{value}</span>
    </span>
  </div>
);

const Profile = ({ embedded = false }) => {
  const navigate = useNavigate();
  const {
    USER_ID,
    loading, isLoading, isSaving, isDirty,
    toastVisible, toastMessage, toastVariant,
    sessions, sessionsLoaded, sessionsLoading, loadSessions,
    user,
    formData, onboarding, setOnboarding, avatarSrc,
    dob, setDob, sex, setSex,
    pendingIdentity, setPendingIdentity,
    setToastVisible, setAvatarSrc, setPendingAvatar, setIsEditing,
    handleInputChange, handleDiscard, confirmDiscard, cancelDiscard, showDiscardConfirm, handleSave, handleLogout,
    handleRevoke,
    showToast,
  } = useProfile();

  const {
    uploadPreview,
    fileInputRef,
    handleSelectPreset,
    handleFileChange,
    handleRemoveAvatar,
  } = useAvatar({ setAvatarSrc, setPendingAvatar });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  // MFP-style streak stat, cached with the profile so returning to the page
  // does not refetch data that is only minutes old.
  const { data: streakDays = 0 } = useQuery({
    queryKey: ['profile-checkin-streak', USER_ID],
    enabled: !!USER_ID,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const d = await apiFetch(`/api/checkins/${USER_ID}/history?days=60`);
      const days = new Set((d.history || []).map(h => String(h.checkin_date || h.check_date || '').slice(0, 10)));
      const cur = new Date();
      if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // today's check-in can still happen
      let s = 0;
      while (days.has(dayKey(cur))) { s++; cur.setDate(cur.getDate() - 1); }
      return s;
    },
  });

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [forgotPwOpen, setForgotPwOpen] = useState(false);
  const [changeGoalOpen, setChangeGoalOpen] = useState(false);
  // Module 1 — soft account deactivation modal (Security → Danger Zone).
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const { logout } = useAuth();
  const [pendingGoalType, setPendingGoalType] = useState(null);
  const [metricsEditSignal, setMetricsEditSignal] = useState(0);
  const [isMasterEditing, setIsMasterEditing] = useState(false);
  const accountSectionRef = useRef(null);
  const goalsSectionRef = useRef(null);

  const scrollToRef = (ref) => {
    if (!ref?.current) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const handleMasterEdit = () => {
    if (isGoalLikeBio(formData.bio)) {
      handleInputChange({ target: { value: '' } }, 'bio');
    }
    setIsMasterEditing(true);
    setMetricsEditSignal((n) => n + 1);
    setOpenSection('account');
    setTimeout(() => scrollToRef(accountSectionRef), 80);
  };

  const handleMasterDone = () => {
    setIsMasterEditing(false);
  };

  if (loading || isLoading) {
    return (
      <AccountPageShell embedded={embedded} userId={USER_ID} mobileTitle="Profile" contentClassName="app-container profile-page" bottomNav={<BottomNav variant="biometrics" />}>
        <div className="pf-loading" aria-busy="true" aria-label="Loading profile">
          <div className="pf-loading-rail-column">
            <div className="pf-loading-card pf-loading-rail">
              <div className="pf-skeleton-block pf-loading-avatar" />
              <div className="pf-loading-copy">
                <div className="pf-skeleton pf-loading-line is-name" />
                <div className="pf-skeleton pf-loading-line is-short" />
              </div>
            </div>
          </div>
          <div className="pf-loading-main">
            <div className="pf-loading-card pf-skeleton-block pf-loading-block" />
            <div className="pf-loading-card pf-skeleton-block pf-loading-block is-tall" />
            <div className="pf-loading-card pf-skeleton-block pf-loading-block" />
          </div>
        </div>
      </AccountPageShell>
    );
  }
  if (!USER_ID) return null;

  const toggle = (id) => {
    const opening = openSection !== id;
    if (opening && id === 'devices') loadSessions();
    setOpenSection(opening ? id : null);
  };

  const handleViewGoal = () => {
    if (!onboarding) {
      navigate('/onboarding?edit=1');
      return;
    }
    setOpenSection('goals');
    setTimeout(() => scrollToRef(goalsSectionRef), 80);
  };

  // Personalization saves regenerate the active goal server-side, so swap the
  // in-memory copy for the fresh record to keep every card in sync.
  const handlePersonalizationSaved = (goal) => {
    if (goal) setOnboarding(goal);
  };

  // Onboarding is unfinished when there's no plan record or auth still flags it
  // (e.g. the user chose "Skip" during the wizard).
  const onboardingIncomplete = !onboarding || user?.onboardingCompleted === false;

  // Per-section attention flags — same rules the header avatar uses, but
  // surfaced on the row that actually needs the edit. Static dots, no pulse.
  const missingMetrics = !formData?.weight_kg || !formData?.height_cm;
  const missingGoal = !onboarding?.goalType;
  const needsOnboarding = user?.onboardingCompleted === false;

  const avatar = resolveAvatar(avatarSrc, formData.fullName);
  const displayName = capitalizeName(formData.fullName) || 'Athlete';
  const emailText = formData.email?.trim() || 'No email on file';
  const memberSinceText = onboarding?.createdAt
    ? new Date(onboarding.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  const goalTitleText = onboarding?.goalType ? goalLabel(onboarding.goalType) : 'Set your fitness goal';
  const goalMetaText = onboarding
    ? [
        onboarding.targetWeightKg != null ? `Target ${Number(onboarding.targetWeightKg).toFixed(1)} kg` : null,
        onboarding.pace ? `${humanize(onboarding.pace)} pace` : null,
        onboarding.activityLevel ? activityLabel(onboarding.activityLevel) : null,
      ].filter(Boolean).join(' · ') || 'Your plan is ready to review.'
    : 'Complete onboarding to unlock your personal plan.';
  const aboutText = isGoalLikeBio(formData.bio) ? '' : String(formData.bio || '').trim();

  // The profile payload already carries the active goal's starting weight and
  // the current measured weight. Deriving progress here avoids a third request.
  const startWeight = Number(onboarding?.weightKg);
  const currentWeight = Number(formData.weight_kg);
  const weightProgress = Number.isFinite(startWeight) && startWeight > 0
    && Number.isFinite(currentWeight) && currentWeight > 0
    ? { diff: startWeight - currentWeight }
    : null;

  const progressTileValue = weightProgress == null
    ? '—'
    : weightProgress.diff != null
      ? (weightProgress.diff === 0 ? 'On track' : Math.abs(weightProgress.diff).toFixed(1))
      : `${weightProgress.pct}%`;
  const progressTileLabel = weightProgress?.diff != null
    ? (weightProgress.diff > 0 ? 'kg lost' : weightProgress.diff < 0 ? 'kg gained' : 'Goal progress')
    : weightProgress?.pct != null ? 'Of goal' : 'No data yet';
  const progressFactValue = weightProgress == null
    ? 'No data yet'
    : weightProgress.diff != null
      ? (weightProgress.diff === 0 ? 'On track' : `${Math.abs(weightProgress.diff).toFixed(1)} kg ${weightProgress.diff > 0 ? 'lost' : 'gained'}`)
      : `${weightProgress.pct}% of goal`;
  const sessionsSubtitle = !sessionsLoaded
    ? "Manage where you're signed in"
    : sessions.length
      ? `${sessions.length} signed-in ${sessions.length === 1 ? 'device' : 'devices'}`
      : 'No active sessions';

  return (
    <AccountPageShell embedded={embedded} userId={USER_ID} mobileTitle="Profile" contentClassName="app-container profile-page" bottomNav={<BottomNav variant="biometrics" />}>
      <Toast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} variant={toastVariant} />
      <PageHeader
        className="pf-page-head"
        eyebrow="Account"
        title={<>Your <em>Profile</em></>}
        description="Identity, body metrics, goals and the settings tied to your account."
        actions={
          <button
            type="button"
            onClick={() => (isMasterEditing ? handleMasterDone() : handleMasterEdit())}
            aria-expanded={isMasterEditing}
            aria-label={isMasterEditing ? 'Finish editing profile' : 'Edit profile'}
            className={`pf-edit-action ${isMasterEditing ? 'is-active' : ''}`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{isMasterEditing ? 'check' : 'edit'}</span>
            <span className="pf-edit-action-label">{isMasterEditing ? 'Done' : 'Edit profile'}</span>
          </button>
        }
      />

      {onboardingIncomplete && (
        <div className="pf-setup">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <div className="pf-setup-copy">
            <p className="pf-setup-title">Finish your setup</p>
            <p className="pf-setup-text">Complete onboarding to unlock personalized targets, goals and a better experience.</p>
            <button type="button" onClick={() => navigate('/onboarding?edit=1')} className="pf-setup-btn">
              Finish setup
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      <div className="pf-layout">
        <aside className="pf-rail" aria-label="Profile identity">
          <section className="pf-identity-card">
            <div className="pf-cover" aria-hidden="true">
              <span className="pf-cover-orb" />
            </div>
            <div className="pf-identity-body">
              <div className="pf-identity-main">
                <div className="pf-avatar-shell">
                  <div className="pf-avatar">
                    {avatar.kind === 'image'
                      ? <img src={avatar.src} alt={`${displayName} profile photo`} />
                      : <span style={{ background: avatar.surface.background, color: avatar.surface.color }}>{avatar.initials}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(v => !v)}
                    aria-label={pickerOpen ? 'Close avatar picker' : 'Change avatar'}
                    aria-expanded={pickerOpen}
                    className="pf-avatar-edit"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">{pickerOpen ? 'close' : 'photo_camera'}</span>
                  </button>
                </div>

                <div className="pf-identity-copy">
                  <h2 className="pf-name">{displayName}</h2>
                  <p className="pf-email">{emailText}</p>
                  {memberSinceText && <p className="pf-member-since">Member since {memberSinceText}</p>}
                </div>
              </div>

              {pickerOpen && (
                <div className="pf-avatar-picker">
                  <div className="pf-picker-head">
                    <Eyebrow>Choose avatar</Eyebrow>
                    <button type="button" onClick={() => setPickerOpen(false)} className="pf-picker-close" aria-label="Close avatar choices">
                      <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                  </div>
                  <div className="pf-avatar-presets">
                    {DEFAULT_AVATARS.map(av => {
                      const isActive = avatarSrc === av.id;
                      const surf = avatarSurface(av.seed);
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => { handleSelectPreset(av.id); setIsEditing(true); }}
                          className="pf-avatar-preset"
                          style={{ background: surf.background, color: surf.color }}
                          aria-label={`Use ${av.label} avatar`}
                          aria-pressed={isActive}
                        >
                          {getInitials(av.label)}
                        </button>
                      );
                    })}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFileChange(e); setIsEditing(true); }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="pf-avatar-upload">Upload custom photo</button>
                  {uploadPreview && (
                    <div className="pf-upload-preview">
                      <img src={uploadPreview} alt="Avatar preview" />
                      <span>Custom photo ready</span>
                    </div>
                  )}
                  {avatarSrc && (
                    <button type="button" onClick={() => { handleRemoveAvatar(); setIsEditing(true); }} className="pf-avatar-remove">
                      Remove avatar
                    </button>
                  )}
                  {isDirty && (
                    <div className="pf-picker-actions">
                      <button type="button" onClick={handleDiscard} className="pf-picker-discard">Discard</button>
                      <button type="button" onClick={handleSave} disabled={isSaving} className="pf-picker-save">{isSaving ? 'Saving…' : 'Save'}</button>
                    </div>
                  )}
                </div>
              )}

              <div className="pf-mobile-summary" aria-label="At a glance">
                <div className="pf-mobile-stat">
                  <span className="pf-mobile-stat-value">{streakDays}</span>
                  <span className="pf-mobile-stat-label">Day streak</span>
                </div>
                <div className="pf-mobile-stat">
                  <span className="pf-mobile-stat-value">{progressTileValue}</span>
                  <span className="pf-mobile-stat-label">{progressTileLabel}</span>
                </div>
              </div>

              <div className="pf-rail-facts">
                {memberSinceText && <RailFact icon="calendar_month" label="Member since" value={memberSinceText} />}
                <RailFact icon="local_fire_department" label="Day streak" value={`${streakDays} ${streakDays === 1 ? 'day' : 'days'}`} />
                <RailFact icon="trending_up" label="Goal progress" value={progressFactValue} />
              </div>

              <div className="pf-rail-about">
                <h3 className="pf-rail-about-title">About me</h3>
                {aboutText
                  ? <p className="pf-rail-about-text">{aboutText}</p>
                  : <p className="pf-rail-about-text is-empty">No bio yet. Use Edit profile to add one.</p>}
              </div>
            </div>
          </section>
        </aside>

        <div className="pf-main">
          <section className="pf-goal-card" aria-labelledby="pf-goal-heading">
            <span className="pf-goal-icon" aria-hidden="true">
              <span className="material-symbols-outlined">flag</span>
            </span>
            <div className="pf-goal-copy">
              <span className="pf-kicker">Your goal</span>
              <h2 className="pf-goal-title" id="pf-goal-heading">{goalTitleText}</h2>
              <p className="pf-goal-meta">{goalMetaText}</p>
            </div>
            <button
              type="button"
              onClick={handleViewGoal}
              aria-expanded={openSection === 'goals'}
              className="pf-goal-action"
            >
              {onboarding ? 'View' : 'Set up'}
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </section>

          <section className="pf-card" aria-labelledby="pf-metrics-heading">
            <div className="pf-card-head">
              <div>
                <span className="pf-kicker">Body metrics</span>
                <h2 className="pf-card-title" id="pf-metrics-heading">Measurements &amp; targets</h2>
                <p className="pf-card-sub">Your latest measurements and the targets calculated from them.</p>
              </div>
              {missingMetrics && <span className="pf-missing-dot" title="Add weight and height" aria-label="Metrics incomplete" />}
            </div>
            <BodyMetricsPanel USER_ID={USER_ID} initialWeight={formData.weight_kg} initialHeight={formData.height_cm} onboarding={onboarding} showToast={showToast} editSignal={metricsEditSignal} onIdentitySaved={(g) => { if (g) setOnboarding(g); }} />
          </section>

          <section className="pf-section" aria-labelledby="pf-account-heading">
            <div className="pf-section-head">
              <div>
                <span className="pf-kicker">Account</span>
                <h2 className="pf-section-title" id="pf-account-heading">Profile details</h2>
              </div>
              <p className="pf-section-sub">Personal information and preferences</p>
            </div>

            <div className="pf-list">
              {/* My Account */}
              <div className="pf-list-item" ref={accountSectionRef}>
                <SectionRow icon="person" title="My Account" subtitle="Name, contact & bio" attention={needsOnboarding} expanded={openSection === 'account'} onClick={() => toggle('account')} />
                {openSection === 'account' && (
                  <div className="pf-row-panel">
                    <div className={`pf-account-form ${isMasterEditing ? '' : 'is-readonly'}`}>
                      {!isMasterEditing && (
                        <p className="pf-account-note pf-form-span">Tap Edit profile above to make changes.</p>
                      )}
                      <div className="min-w-0">
                        <label htmlFor="pf-name" className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Full name</label>
                        <input id="pf-name" value={formData.fullName} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'fullName')} placeholder="Your name" autoComplete="name" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60" />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="pf-email" className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Email (locked)</label>
                        <input id="pf-email" value={formData.email} readOnly className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-muted)] opacity-60" />
                      </div>
                      <div className="pf-form-span min-w-0">
                        <label htmlFor="pf-contact" className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Emergency contact</label>
                        <input id="pf-contact" value={formData.contact} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'contact')} placeholder="Name · phone" autoComplete="tel" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60" />
                      </div>
                      <div className="pf-form-span min-w-0">
                        <label htmlFor="pf-bio" className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Bio</label>
                        <textarea id="pf-bio" value={isGoalLikeBio(formData.bio) ? '' : formData.bio} disabled={!isMasterEditing} onChange={e => handleInputChange(e, 'bio')} rows={2} placeholder="Tell us about yourself" className="mt-1 w-full rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60 resize-y min-h-[76px]" />
                      </div>
                      <div className="pf-form-span min-w-0">
                        <label htmlFor="pf-goal" className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Goal</label>
                        <GoalPicker
                          value={onboarding?.goalType || ''}
                          disabled={!isMasterEditing}
                          onPick={(key) => {
                            // No active plan yet: create one right here via the
                            // setup mode of the same modal — never a wizard redirect.
                            if (!onboarding) { setChangeGoalOpen(true); return; }
                            setPendingGoalType(key);
                            setChangeGoalOpen(true);
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="pf-dob" className="block text-[length:var(--fs-10)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">DOB</label>
                        <input id="pf-dob" type="date" value={dob} disabled={!isMasterEditing}
                          onChange={e => { setDob(e.target.value); setIsEditing(true); }}
                          className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-50" />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="pf-sex" className="block text-[length:var(--fs-10)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Sex</label>
                        <select id="pf-sex" value={sex} disabled={!isMasterEditing}
                          onChange={e => { setSex(e.target.value); setIsEditing(true); }}
                          className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] text-[var(--text-primary)] outline-none disabled:opacity-50">
                          <option value="">—</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="pf-account-created pf-form-span">
                        <p className="pf-account-created-label">Created</p>
                        <p className="pf-account-created-value">{onboarding?.createdAt ? new Date(onboarding.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
                      </div>
                      {!onboarding && (
                        <p className="pf-account-note pf-form-span">DOB / sex apply once your plan exists — create it in My Goals below without leaving this page.</p>
                      )}
                      {isMasterEditing && isDirty && (
                        <div className="pf-account-actions pf-form-span">
                          <button type="button" onClick={() => { handleDiscard(); }} className="pf-account-discard">Discard</button>
                          <button type="button" onClick={async () => { await handleSave(); setIsMasterEditing(false); }} disabled={isSaving} className="pf-account-save">{isSaving ? 'Saving…' : 'Save changes'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* My Goals — full plan snapshot lives here (single home, no duplicate) */}
              <div className="pf-list-item" ref={goalsSectionRef}>
                <SectionRow icon="flag" title="My Goals" subtitle={onboarding?.goalType ? goalLabel(onboarding.goalType) : 'Set your fitness goal'} attention={missingGoal} expanded={openSection === 'goals'} onClick={() => toggle('goals')} />
                {openSection === 'goals' && (
                  <div className="pf-row-panel">
                    <GoalSnapshotCard onboarding={onboarding} onChangeGoal={() => setChangeGoalOpen(true)} onSetupPlan={() => setChangeGoalOpen(true)} />
                  </div>
                )}
              </div>

              {/* Personalization — edit the lifestyle + allergy answers given during onboarding */}
              <div className="pf-list-item">
                <SectionRow icon="tune" title="Personalization" subtitle="Allergies, sleep & recovery" expanded={openSection === 'personalization'} onClick={() => toggle('personalization')} />
                {openSection === 'personalization' && (
                  <div className="pf-row-panel">
                    <Suspense fallback={<div className="pf-panel-loading" role="status">Loading personalization…</div>}>
                      <PersonalizationSection
                        userId={USER_ID}
                        onboarding={onboarding}
                        onSaved={handlePersonalizationSaved}
                        showToast={showToast}
                      />
                    </Suspense>
                  </div>
                )}
              </div>

              {/* Devices & Sessions */}
              <div className="pf-list-item">
                <SectionRow icon="devices" title="Devices & Sessions" subtitle={sessionsSubtitle} expanded={openSection === 'devices'} onClick={() => toggle('devices')} />
                {openSection === 'devices' && (
                  <div className="pf-row-panel" aria-busy={sessionsLoading}>
                    {sessionsLoading ? (
                      <p className="pf-sessions-empty">Loading sessions…</p>
                    ) : sessions.length === 0 ? (
                      <p className="pf-sessions-empty">No active sessions found.</p>
                    ) : (
                      <div className="pf-sessions">
                        {sessions.map(s => (
                          <div key={s.id} className={`pf-session ${s.is_current ? 'is-current' : ''}`}>
                            <span className="pf-session-icon" aria-hidden="true">
                              <span className="material-symbols-outlined">{s.is_current ? 'smartphone' : 'computer'}</span>
                            </span>
                            <div className="pf-session-copy">
                              <p className="pf-session-device">{[s.browser, s.os].filter(Boolean).join(' on ') || 'Unknown device'}</p>
                              <p className="pf-session-meta">
                                {[s.city, s.country].filter(Boolean).join(', ') || 'Unknown location'}{s.is_current ? ' · Active now' : ''}
                              </p>
                            </div>
                            {s.is_current
                              ? <span className="pf-session-badge">Current</span>
                              : <button type="button" onClick={() => handleRevoke(s.id)} className="pf-session-revoke">Revoke</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="pf-section" aria-labelledby="pf-security-heading">
            <div className="pf-section-head">
              <div>
                <span className="pf-kicker">Account</span>
                <h2 className="pf-section-title" id="pf-security-heading">Security</h2>
              </div>
              <p className="pf-section-sub">Access and account controls</p>
            </div>

            <div className="pf-list">
              <div className="pf-list-item">
                <SectionRow icon="key" title="Change Password" subtitle="Keep your account secure" onClick={() => setChangePwOpen(true)} />
              </div>
              <div className="pf-list-item">
                <SectionRow
                  icon="verified_user"
                  title="Terms & Privacy"
                  subtitle={
                    user?.acceptedTermsAt
                      ? `Accepted ${new Date(user.acceptedTermsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}${user?.acceptedTermsVersion ? ` · v${user.acceptedTermsVersion}` : ''}`
                      : 'Consent not recorded'
                  }
                  onClick={() => showToast('Consent recorded when you registered — Terms & Privacy stay viewable under the Register page.', 'info')}
                />
              </div>
              <div className="pf-list-item">
                <SectionRow icon="logout" title="Log Out" subtitle="Sign out of this device" danger onClick={handleLogout} />
              </div>
              <div className="pf-list-item">
                <SectionRow
                  icon="pause_circle"
                  title="Deactivate Account"
                  subtitle="Reversible · ends all sessions"
                  danger
                  onClick={() => setDeactivateOpen(true)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <Suspense fallback={null}>
        {changePwOpen && (
          <ChangePasswordModal
            onClose={() => setChangePwOpen(false)}
            onSuccess={() => showToast('Password changed — security email & notification sent')}
            // Same email-OTP flow as auth — but as a modal, never a redirect.
            onForgotPassword={() => { setChangePwOpen(false); setForgotPwOpen(true); }}
          />
        )}
        {forgotPwOpen && (
          <ForgotPasswordModal
            defaultEmail={formData?.email || user?.email || ''}
            onClose={() => setForgotPwOpen(false)}
            onBack={() => { setForgotPwOpen(false); setChangePwOpen(true); }}
            onDone={async () => {
              setForgotPwOpen(false);
              // Reset-password signs EVERY device out (token bump) — end the
              // session here cleanly and land on login.
              await logout();
              navigate('/login');
            }}
          />
        )}
        {deactivateOpen && (
          <DeactivateAccountModal
            onClose={() => setDeactivateOpen(false)}
            onDeactivated={async () => {
              setDeactivateOpen(false);
              // Auth context cleanup (cache, sockets, query cache), then land on
              // the public site — reactivation lives behind the login screen.
              await logout();
              navigate('/');
            }}
          />
        )}
        {(changeGoalOpen || pendingIdentity) && (
          <ChangeGoalModal
            userId={USER_ID}
            currentGoal={pendingGoalType ? { ...onboarding, goalType: pendingGoalType } : onboarding}
            identity={pendingIdentity}
            onClose={() => { setChangeGoalOpen(false); setPendingGoalType(null); setPendingIdentity(null); }}
            onUpdated={(goal) => {
              if (goal) {
                setOnboarding(goal);
                // Sync My Account identity inputs with the freshly created/edited goal.
                setDob(goal?.dob ? String(goal.dob).slice(0, 10) : '');
                setSex(goal?.sex ? String(goal.sex).toUpperCase() : '');
              }
              setPendingGoalType(null);
              setPendingIdentity(null);
            }}
            showToast={showToast}
          />
        )}
      </Suspense>
      <Modal
        isOpen={!!showDiscardConfirm}
        onClose={cancelDiscard}
        title="Discard changes?"
        subtitle="Unsaved edits will be lost."
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={cancelDiscard}>Keep editing</Button>
            <Button variant="danger" onClick={confirmDiscard}>Discard</Button>
          </div>
        }
      >
        <p className="text-[length:var(--fs-13)] text-[var(--text-muted)]">Discard unsaved profile changes?</p>
      </Modal>
    </AccountPageShell>
  );
};

export default Profile;
