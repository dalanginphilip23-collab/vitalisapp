import { useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';

const TAGS = ['General', 'Strength', 'Cardio', 'Fat Loss', 'Mobility', 'Flexibility', 'Performance'];
const INTENSITIES = ['Low', 'Moderate', 'High'];

const selectCls = 'mt-1 w-full h-12 min-h-[44px] rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-14)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]';
const inputCls = 'mt-1 w-full h-12 min-h-[44px] rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-16)] sm:text-[length:var(--fs-14)] outline-none focus:border-[var(--accent)] text-[var(--text-primary)]';
const labelCls = 'text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]';

// Create/edit sheet for user-owned plans. Pure presentational: all API lives in usePlan.
// Create mode: initial == null (duration + generate visible). Edit mode: initial = plan
// (duration hidden — length stays fixed so days/progress keep matching).
export default function PersonalPlanSheet({ open, onClose, acting, error, onCreate, onGenerate, initial, onSave }) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState(initial?.title || '');
  const [tag, setTag] = useState(initial?.tag || 'General');
  const [intensity, setIntensity] = useState(initial?.intensity || 'Moderate');
  // Raw input value (string|number) so the number field can be emptied while
  // typing; Number() is applied in valid/submit below.
  const [durationDays, setDurationDays] = useState(/** @type {number | string} */ (7));
  const [description, setDescription] = useState(initial?.description || '');

  const valid = isEdit
    ? title.trim().length > 0
    : title.trim().length > 0 && Number(durationDays) >= 1 && Number(durationDays) <= 84;

  const submit = async () => {
    if (!valid || acting) return;
    if (isEdit) {
      const saved = await onSave?.(initial.id, {
        title: title.trim().slice(0, 100),
        tag, intensity, targetFocus: tag,
        description: description.trim().slice(0, 2000),
      });
      if (saved) onClose?.();
      return;
    }
    const created = await onCreate?.({
      title: title.trim().slice(0, 100),
      tag, intensity, targetFocus: tag,
      durationDays: Number(durationDays),
      description: description.trim().slice(0, 2000),
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
      subtitle={isEdit ? 'Yours only — changes save instantly.' : 'Yours only — a 7-day starter is generated, edit anytime.'}
      icon={isEdit ? 'edit' : 'add'}
      footer={(
        <div className="flex flex-col sm:flex-row gap-2">
          {!isEdit && (
            <button
              type="button"
              onClick={generate}
              disabled={acting}
              className="flex-1 h-12 min-h-[44px] px-4 rounded-[12px] border border-[var(--border-light)] text-[length:var(--fs-13)] font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {acting ? 'Working…' : 'Generate from my goal'}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!valid || acting}
            className="flex-1 h-12 min-h-[44px] px-4 rounded-[12px] bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-13)] font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="personal-plan-tag">Focus</label>
            <select id="personal-plan-tag" value={tag} onChange={(e) => setTag(e.target.value)} className={selectCls}>
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
        {error ? <p role="alert" className="text-[length:var(--fs-12)] font-semibold text-[var(--error)]">{error}</p> : null}
      </div>
    </Modal>
  );
}
