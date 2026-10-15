import { useMemo, useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import {
  GOAL_TYPES,
  autoFillForGoal,
  exercisesForGoal,
  goalLabel,
  goalTypeToTag,
  guideBySlug,
  planExerciseFromGuide,
} from '../utils/goalExerciseMap.js';

const TAGS = ['General', 'Strength', 'Cardio', 'Fat Loss', 'Mobility', 'Flexibility', 'Performance'];
const INTENSITIES = ['Low', 'Moderate', 'High'];
const AUTO_FILL_COUNT = 6;

const selectCls = 'mt-1 w-full h-12 min-h-[44px] rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[16px] sm:text-[14px] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]';
const inputCls = 'mt-1 w-full h-12 min-h-[44px] rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[16px] sm:text-[14px] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]';
const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]';

// Create/edit sheet for user-owned plans. Pure presentational: all API lives in usePlan.
// Create mode: initial == null. The training goal filters the workout picker
// (muscle goals see only weighted strength work, fat-loss only conditioning),
// auto-fills 6 picks, and the user can swap any of them. Duration + generate
// visible. Edit mode: initial = plan (duration hidden — length stays fixed so
// days/progress keep matching; goal still editable and stored).
export default function PersonalPlanSheet({ open, onClose, acting, error, onCreate, onGenerate, initial, onSave, activeGoalKey }) {
  const isEdit = Boolean(initial?.id);
  const initialGoal = initial?.goal_type || initial?.goalType || activeGoalKey || 'BUILD_MUSCLE';
  const [title, setTitle] = useState(initial?.title || '');
  const [goalKey, setGoalKey] = useState(GOAL_TYPES.some((g) => g.key === initialGoal) ? initialGoal : 'BUILD_MUSCLE');
  const [tag, setTag] = useState(initial?.tag || goalTypeToTag(initialGoal));
  const [tagTouched, setTagTouched] = useState(false);
  const [intensity, setIntensity] = useState(initial?.intensity || 'Moderate');
  const [durationDays, setDurationDays] = useState(7);
  const [description, setDescription] = useState(initial?.description || '');
  const [picked, setPicked] = useState(() => autoFillForGoal(initialGoal, AUTO_FILL_COUNT));
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const options = useMemo(() => exercisesForGoal(goalKey, query), [goalKey, query]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);

  const changeGoal = (next) => {
    setGoalKey(next);
    // Keep focus in sync with the goal until the user overrides it by hand.
    if (!tagTouched) setTag(goalTypeToTag(next));
    // Re-seed the workout list for the new goal; user swaps after.
    setPicked(autoFillForGoal(next, AUTO_FILL_COUNT));
    setQuery('');
  };

  const togglePick = (slug) => {
    setPicked((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const valid = isEdit
    ? title.trim().length > 0
    : title.trim().length > 0 && Number(durationDays) >= 1 && Number(durationDays) <= 84 && picked.length > 0;

  const submit = async () => {
    if (!valid || acting) return;
    if (isEdit) {
      const saved = await onSave?.(initial.id, {
        title: title.trim().slice(0, 100),
        tag, intensity, targetFocus: tag,
        goalType: goalKey,
        description: description.trim().slice(0, 2000),
      });
      if (saved) onClose?.();
      return;
    }
    const created = await onCreate?.({
      title: title.trim().slice(0, 100),
      tag, intensity, targetFocus: tag,
      goalType: goalKey,
      durationDays: Number(durationDays),
      description: description.trim().slice(0, 2000),
      exercises: picked
        .map((slug) => planExerciseFromGuide(guideBySlug(slug)))
        .filter(Boolean),
    });
    if (created) onClose?.();
  };

  const generate = async () => {
    if (acting) return;
    const data = await onGenerate?.();
    if (data?.planId) onClose?.();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? 'Edit personal plan' : 'New personal plan'}
      subtitle={isEdit ? 'Yours only — changes save instantly.' : 'Yours only — pick a goal, we pre-fill matching workouts.'}
      icon={isEdit ? 'edit' : 'add'}
      footer={(
        <div className="flex flex-col sm:flex-row gap-2">
          {!isEdit && (
            <button
              type="button"
              onClick={generate}
              disabled={acting}
              className="flex-1 h-12 min-h-[44px] px-4 rounded-[12px] border border-[var(--border-light)] text-[13px] font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {acting ? 'Working…' : 'Generate from my goal'}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!valid || acting}
            className="flex-1 h-12 min-h-[44px] px-4 rounded-[12px] bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[13px] font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {acting ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="personal-plan-title">Title</label>
          <input
            id="personal-plan-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My Night-Shift Strength"
            maxLength={100}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="personal-plan-goal">Training goal — filters the workouts</label>
          <select id="personal-plan-goal" value={goalKey} onChange={(e) => changeGoal(e.target.value)} className={selectCls}>
            {GOAL_TYPES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {goalKey === 'BUILD_MUSCLE' || goalKey === 'GAIN_WEIGHT'
              ? 'Only weighted strength workouts are offered.'
              : goalKey === 'LOSE_WEIGHT'
                ? 'Only fat-loss conditioning workouts are offered.'
                : 'A balanced mix of strength + conditioning is offered.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="personal-plan-tag">Focus</label>
            <select
              id="personal-plan-tag"
              value={tag}
              onChange={(e) => { setTag(e.target.value); setTagTouched(true); }}
              className={selectCls}
            >
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="personal-plan-intensity">Intensity</label>
            <select id="personal-plan-intensity" value={intensity} onChange={(e) => setIntensity(e.target.value)} className={selectCls}>
              {INTENSITIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {!isEdit && (
          <>
            <div>
              <label className={labelCls} htmlFor="personal-plan-days">Length (days, 1–84)</label>
              <input
                id="personal-plan-days"
                type="number"
                min={1}
                max={84}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className={labelCls}>Workouts for this goal ({picked.length})</span>
                <button
                  type="button"
                  onClick={() => { setPicked(autoFillForGoal(goalKey, AUTO_FILL_COUNT)); setQuery(''); }}
                  className="text-[11px] font-bold text-[var(--accent)] hover:underline"
                >
                  Reset picks
                </button>
              </div>
              {picked.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {picked.map((slug) => {
                    const ex = guideBySlug(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => togglePick(slug)}
                        title="Remove from plan"
                        className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[12px] font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                      >
                        {ex?.name || slug}
                        <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">close</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p role="alert" className="text-[12px] font-semibold text-[var(--error)] mt-2">
                  Pick at least one workout below.
                </p>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                className="mt-2 w-full h-11 rounded-[12px] border border-[var(--border-light)] text-[12px] font-bold text-[var(--text-secondary)] active:scale-[0.99] transition-all"
              >
                {pickerOpen ? 'Hide workout list' : `Swap / add — ${goalLabel(goalKey)} list`}
              </button>
              {pickerOpen && (
                <div className="mt-2 rounded-[12px] border border-[var(--border-light)] overflow-hidden">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none">search</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search this goal's workouts"
                      aria-label="Search goal workouts"
                      className="w-full h-11 bg-[var(--bg-hover)] pl-10 pr-3 text-[14px] outline-none placeholder:text-[var(--text-disabled)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-light)]">
                    {options.map((ex) => {
                      const on = pickedSet.has(ex.slug);
                      return (
                        <button
                          key={ex.slug}
                          type="button"
                          onClick={() => togglePick(ex.slug)}
                          aria-pressed={on}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-[var(--accent-solid)] border-[var(--accent)]' : 'border-[var(--border-medium)]'}`}>
                            {on && <span className="material-symbols-outlined text-[14px] text-[var(--accent-solid-fg)]">check</span>}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-bold truncate text-[var(--text-primary)]">{ex.name}</span>
                            <span className="block text-[11px] text-[var(--text-muted)]">{ex.primaryMuscle} · {ex.equipment}</span>
                          </span>
                        </button>
                      );
                    })}
                    {options.length === 0 && (
                      <p className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">No matches — try another search.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <div>
          <label className={labelCls} htmlFor="personal-plan-desc">Notes (optional)</label>
          <input
            id="personal-plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this plan for?"
            maxLength={2000}
            className={inputCls}
          />
        </div>
        {error ? <p role="alert" className="text-[12px] font-semibold text-[var(--error)]">{error}</p> : null}
      </div>
    </Modal>
  );
}
