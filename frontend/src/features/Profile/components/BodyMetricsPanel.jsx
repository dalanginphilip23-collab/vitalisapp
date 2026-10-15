import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiClient.js';
import { computeBMI, bmiCategory, calcBMR, activityFactors } from '../utils/metrics.js';
import { activityLabel } from '../../Onboarding/constants/goals.js';
import { useUnits } from '../../../hooks/useUnits.js';
import { kgToLb, lbToKg, cmToFtIn, ftInToCm, round1, formatWeight, formatHeight } from '../../../lib/units.js';

const BodyMetricsPanel = ({ USER_ID, initialWeight, initialHeight, onboarding, showToast, onMetricsSaved, editSignal }) => {
  const units = useUnits();
  const imperial = units === 'imperial';
  // Canonical state stays metric (backend + BMI/BMR math). Imperial inputs
  // edit raw display strings that convert back on every keystroke.
  const [weight, setWeight] = useState(initialWeight || '');
  const [height, setHeight] = useState(initialHeight || '');
  const [weightRaw, setWeightRaw] = useState('');
  const [heightFtRaw, setHeightFtRaw] = useState('');
  const [heightInRaw, setHeightInRaw] = useState('');
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
    if (onboarding.dob) {
      const dobDate = new Date(onboarding.dob);
      if (!Number.isNaN(dobDate.getTime())) {
        const ageCalc = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (ageCalc > 0 && ageCalc < 120) setAge(String(ageCalc));
      }
    }
    if (onboarding.sex) setGender(String(onboarding.sex).toLowerCase());
    if (onboarding.activityLevel) {
      const label = activityLabel(onboarding.activityLevel);
      if (activityFactors[label]) setActivity(label);
    }
  }, [onboarding]);
  // NOTE: no auto-collapse effect here — collapsing on weight/height/age change
  // would close the form while the user is typing. `editing` starts false.
  // Single master Edit button (Profile) drives this panel via editSignal.
  useEffect(() => {
    if (editSignal > 0) setEditing(true);
  }, [editSignal]);

  // Snapshot metric state into imperial display strings when the editor
  // opens (or units flip mid-edit) so typing never round-trips per keystroke.
  useEffect(() => {
    if (!editing || !imperial) return;
    setWeightRaw(weight === '' ? '' : String(kgToLb(Number(weight))));
    const { ft, inch } = cmToFtIn(Number(height) || 0);
    setHeightFtRaw(height === '' ? '' : String(ft));
    setHeightInRaw(height === '' ? '' : String(inch));
  // weight/height intentionally snapshotted, not tracked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, imperial]);

  const onWeightRaw = (v) => {
    setWeightRaw(v);
    if (v === '') { setWeight(''); return; }
    const n = Number(v);
    if (Number.isFinite(n)) setWeight(String(lbToKg(n)));
  };

  const onHeightFtInRaw = (ftV, inV) => {
    setHeightFtRaw(ftV);
    setHeightInRaw(inV);
    const ft = Number(ftV);
    const inch = inV === '' ? 0 : Number(inV);
    if (ftV !== '' && Number.isFinite(ft) && Number.isFinite(inch)) {
      setHeight(String(ftInToCm(ft, inch)));
    } else if (ftV === '' && inV === '') {
      setHeight('');
    }
  };



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
    const wKg = parseFloat(weight);
    const hCm = parseFloat(height);
    if (!Number.isFinite(wKg) || wKg < 25 || wKg > 350) { showToast?.(imperial ? 'Enter a valid weight (55–770 lb).' : 'Enter a valid weight (25–350 kg).', 'error'); return; }
    if (!Number.isFinite(hCm) || hCm < 50 || hCm > 300) { showToast?.(imperial ? 'Enter a valid height.' : 'Enter a valid height (50–300 cm).', 'error'); return; }
    setIsSaving(true);
    try {
      await apiFetch(`/api/bmi/${USER_ID}`, {
        method: 'POST',
        body: JSON.stringify({ weight_kg: round1(wKg), height_cm: round1(hCm), age: age || null, gender }),
      });
      showToast?.('Metrics saved — BMI updated');
      setEditing(false);
      onMetricsSaved?.();
    } catch (e) { showToast?.(e.message || 'Save failed', 'error'); } finally { setIsSaving(false); }
  };

  const hasResult = bmi != null && tdee != null;
  return (
    <div className="space-y-3">
      {/* Editable inputs — always visible when editing, collapsed to summary when not */}
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {imperial ? (
              <div className="min-w-0"><label htmlFor="bm-weight" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Weight (lb)</label><input id="bm-weight" type="number" min="55" max="770" step="0.2" value={weightRaw} onChange={e=>onWeightRaw(e.target.value)} placeholder="171.5" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
            ) : (
              <div className="min-w-0"><label htmlFor="bm-weight" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Weight (kg)</label><input id="bm-weight" type="number" min="25" max="350" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="55.0" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
            )}
            {imperial ? (
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Height (ft / in)</span>
                <div className="mt-1 flex gap-2">
                  <input id="bm-height-ft" type="number" min="2" max="8" step="1" value={heightFtRaw} onChange={e=>onHeightFtInRaw(e.target.value, heightInRaw)} placeholder="6" aria-label="Height feet" className="w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                  <input id="bm-height-in" type="number" min="0" max="11.9" step="0.5" value={heightInRaw} onChange={e=>onHeightFtInRaw(heightFtRaw, e.target.value)} placeholder="1" aria-label="Height inches" className="w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
            ) : (
              <div className="min-w-0"><label htmlFor="bm-height" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Height (cm)</label><input id="bm-height" type="number" min="50" max="300" step="0.5" value={height} onChange={e=>setHeight(e.target.value)} placeholder="185.0" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
            )}
            <div className="min-w-0"><label htmlFor="bm-age" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Age</label><input id="bm-age" type="number" min="5" max="120" value={age} onChange={e=>setAge(e.target.value)} placeholder="23" className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></div>
            <div className="min-w-0"><label htmlFor="bm-gender" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gender</label><select id="bm-gender" value={gender} onChange={e=>setGender(e.target.value)} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none"><option value="male">male</option><option value="female">female</option><option value="other">other</option></select></div>
            <div className="col-span-2"><label htmlFor="bm-activity" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity Level</label><select id="bm-activity" value={activity} onChange={e=>setActivity(e.target.value)} className="mt-1 w-full h-12 min-h-[44px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 text-[16px] sm:text-[13px] text-[var(--text-primary)] outline-none">{Object.keys(activityFactors).map(k=><option key={k} value={k}>{k}</option>)}</select></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={()=>setEditing(false)} className="flex-1 h-12 min-h-[44px] rounded-xl border border-[var(--border-light)] text-[12px] font-bold text-[var(--text-muted)] active:scale-[0.98] transition-all">Cancel</button>
            <button onClick={handleSave} disabled={isSaving || !weight || !height} className="flex-1 h-12 min-h-[44px] rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-black disabled:opacity-50 active:scale-[0.98] transition-all">{isSaving ? 'Saving…' : 'Save & Calculate'}</button>
          </div>
        </div>
      ) : hasResult ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center [&>div]:min-w-0">
            <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-2 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Weight</p><p className="text-[13px] font-bold text-[var(--text-primary)] mt-1 break-words tabular-nums">{formatWeight(weight, units)}</p></div>
            <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] px-2 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Height</p><p className="text-[13px] font-bold text-[var(--text-primary)] mt-1 break-words tabular-nums">{formatHeight(height, units)}</p></div>
            <div className="bg-[var(--bg-hover)] border border-[var(--accent-border)] rounded-[12px] px-2 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">BMI</p><p className="text-[15px] font-black tabular-nums" style={{ color: bmiInfo.color }}>{bmi}</p><p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: bmiInfo.color }}>{bmiInfo.label}</p></div>
          </div>
          <div className="h-px bg-[var(--border-light)]" />
          <button onClick={()=>setExpanded(v=>!v)} className="w-full flex items-center justify-center gap-1 text-[10px] font-black tracking-[0.15em] uppercase text-[var(--accent)] py-2 min-h-[44px]">VIEW ALL METRICS <span className={`material-symbols-outlined text-[14px] transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span></button>
          {expanded && (
            <>
              <div className="h-px bg-[var(--border-light)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Details</p>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Age</p><p className="text-[13px] font-bold text-[var(--text-primary)] mt-1">{age}</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gender</p><p className="text-[13px] font-bold text-[var(--text-primary)] mt-1 capitalize">{gender}</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Activity</p><p className="text-[11px] font-bold text-[var(--text-primary)] mt-1 leading-snug">{activity}</p></div>
              </div>
              <div className="rounded-[16px] p-4 text-center bg-[var(--accent-solid)]">
                <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--accent-solid-fg)]/80">Total Daily Energy Expenditure</p>
                <p className="text-[28px] font-black text-[var(--accent-solid-fg)] mt-1 tabular-nums">{tdee.toLocaleString()} <span className="text-[12px] font-bold text-[var(--accent-solid-fg)]/70">kcal</span></p>
                <p className="text-[10px] font-bold text-[var(--accent-solid-fg)]/70 mt-1 tabular-nums">BMR {bmr.toLocaleString()} <span className="opacity-40">|</span> Activity {activityKcal}</p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Calorie Targets</p>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                {[{label:'CUT', val:targets.cut, sub:'Fat loss'},{label:'MAINTAIN', val:targets.maintain, sub:'Current weight'},{label:'BULK', val:targets.bulk, sub:'Muscle gain'}].map(c=>(
                  <div key={c.label} className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-[var(--accent)]">{c.label}</p>
                    <p className="text-[14px] font-black text-[var(--text-primary)] mt-1 break-words tabular-nums">{c.val.toLocaleString()}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{c.sub}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] shrink-0">Macronutrients</p>
                <div className="flex gap-1 bg-[var(--bg-hover)] rounded-full p-1 overflow-x-auto no-scrollbar max-w-full">
                  {['MODERATE CARB','LOWER CARB','HIGHER CARB'].map(m=>(
                    <button key={m} onClick={()=>setMacroMode(m)} aria-pressed={macroMode===m} className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.08em] whitespace-nowrap shrink-0 min-h-[32px] ${macroMode===m ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'text-[var(--text-muted)]'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex bg-[var(--bg-hover)]">
                <div className="bg-[var(--accent)]" style={{width:`${macros.protein.pct}%`}} />
                <div className="bg-[var(--accent)] opacity-55" style={{width:`${macros.fat.pct}%`}} />
                <div className="bg-[var(--accent)] opacity-30" style={{width:`${macros.carbs.pct}%`}} />
              </div>
              <div className="grid grid-cols-3 gap-2 [&>div]:min-w-0">
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold tracking-[0.12em] text-[var(--accent)]">PROTEIN</p><p className="text-[14px] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.protein.g}g</p><p className="text-[9px] text-[var(--text-muted)] tabular-nums">{macros.protein.kcal} kcal · {macros.protein.pct}%</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold tracking-[0.12em] text-[var(--accent)]">FAT</p><p className="text-[14px] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.fat.g}g</p><p className="text-[9px] text-[var(--text-muted)] tabular-nums">{macros.fat.kcal} kcal · {macros.fat.pct}%</p></div>
                <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[12px] p-3 text-center"><p className="text-[10px] font-bold tracking-[0.12em] text-[var(--accent)]">CARBS</p><p className="text-[14px] font-black text-[var(--text-primary)] break-words tabular-nums">{macros.carbs.g}g</p><p className="text-[9px] text-[var(--text-muted)] tabular-nums">{macros.carbs.kcal} kcal · {macros.carbs.pct}%</p></div>
              </div>
              <p className="flex justify-between text-[9px] text-[var(--text-disabled)]"><span>{activity}</span><span>{new Date().toISOString().slice(0,10)} · {new Date().toLocaleTimeString()}</span></p>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--text-muted)] text-center py-2">Tap Edit Profile above to enter weight & height</p>
        </div>
      )}
    </div>
  );
};

export default BodyMetricsPanel;
