// Module 6 — body measurements: weight (kg), body fat %, and the five-tape
// set (chest/waist/hips/arm/thigh cm). One row per user per day — saving
// today's entry again updates it. A weight entry mirrors into BMI history so
// the Body tab's BMI table and the AI weight-trend context stay in sync.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import Button from '../../../../components/ui/Button.jsx';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import { apiGet, apiPost, apiFetch } from '../../../../lib/apiClient.js';

const FIELDS = [
  { key: 'weight_kg',    label: 'Weight',     unit: 'kg', min: 20,  max: 500, step: '0.1' },
  { key: 'body_fat_pct', label: 'Body fat',   unit: '%',  min: 1,   max: 70,  step: '0.1' },
  { key: 'chest_cm',     label: 'Chest',      unit: 'cm', min: 40,  max: 200, step: '0.1' },
  { key: 'waist_cm',     label: 'Waist',      unit: 'cm', min: 30,  max: 250, step: '0.1' },
  { key: 'hips_cm',      label: 'Hips',       unit: 'cm', min: 40,  max: 250, step: '0.1' },
  { key: 'arm_cm',       label: 'Arm',        unit: 'cm', min: 15,  max: 70,  step: '0.1' },
  { key: 'thigh_cm',     label: 'Thigh',      unit: 'cm', min: 25,  max: 120, step: '0.1' },
];

const EMPTY = () => {
  const o = {};
  FIELDS.forEach((f) => { o[f.key] = ''; });
  o.notes = '';
  return o;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Weight delta headline across the visible history.
function WeightSummary({ measurements }) {
  const withWeight = measurements.filter((m) => m.weight_kg != null);
  if (withWeight.length < 2) return null;
  const first = withWeight[withWeight.length - 1];
  const last = withWeight[0];
  const delta = Number(last.weight_kg) - Number(first.weight_kg);
  if (Number(first.weight_kg) === Number(last.weight_kg)) return null;
  return (
    <p className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]">
      <span className={delta < 0 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}>
        {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
      </span>{' '}
      since {new Date(first.recorded_at + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
    </p>
  );
}

export default function BodyMeasurementsPanel({ userId }) {
  const [rows,     setRows]    = useState(null);
  const [error,    setError]   = useState(null);
  const [form,     setForm]    = useState(EMPTY);
  const [date,     setDate]    = useState(todayKey());
  const [saving,   setSaving]  = useState(false);
  const [formErr,  setFormErr] = useState('');

  const load = async () => {
    try {
      const data = await apiGet('/api/progress/measurements');
      setRows(Array.isArray(data?.measurements) ? data.measurements : []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  const sorted = useMemo(() => [...(rows || [])].sort((a, b) => (b.recorded_at > a.recorded_at ? 1 : -1)), [rows]);

  const save = async () => {
    if (saving) return;
    const payload = {};
    let any = false;
    for (const f of FIELDS) {
      const v = String(form[f.key]).trim();
      if (v === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < f.min || n > f.max) {
        setFormErr(`${f.label} must be ${f.min}–${f.max} ${f.unit}`);
        return;
      }
      payload[f.key] = n;
      any = true;
    }
    if (!any) {
      setFormErr('Enter at least one value.');
      return;
    }
    payload.recorded_at = date;
    payload.notes = form.notes;
    setFormErr('');
    setSaving(true);
    try {
      await apiPost('/api/progress/measurements', payload);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await apiFetch(`/api/progress/measurements/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-card border border-[var(--border-light)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full space-y-4" data-user={userId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[length:var(--fs-15)] font-extrabold tracking-tight">Body Measurements</h3>
          <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">
            One entry per day — re-saving today updates it. Weight syncs to your BMI history automatically.
          </p>
        </div>
        <WeightSummary measurements={sorted} />
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* Entry form */}
      <div className="rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="meas-date" className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-muted)] shrink-0">
            Date
          </label>
          <input
            id="meas-date"
            type="date"
            max={todayKey()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 flex-1 min-w-0 bg-[var(--input-bg)] rounded-xl px-3 text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-[length:var(--fs-10)] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {f.label} <span className="text-[var(--text-disabled)]">({f.unit})</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step}
                value={form[f.key]}
                onChange={(e) => { setForm((p) => ({ ...p, [f.key]: e.target.value })); setFormErr(''); }}
                className="w-full h-10 bg-[var(--input-bg)] rounded-xl px-3 text-[length:var(--fs-13)] font-bold text-[var(--text-primary)] tabular-nums border border-[var(--input-border)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          ))}
        </div>
        <input
          type="text"
          placeholder="Note (optional — e.g. morning, fasted)"
          value={form.notes}
          maxLength={300}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="w-full h-10 bg-[var(--input-bg)] rounded-xl px-3 text-sm text-[var(--text-primary)] border border-[var(--input-border)] outline-none focus:border-[var(--accent)]"
        />
        {formErr && <p className="text-[length:var(--fs-11)] font-bold text-[var(--error)]" role="alert">{formErr}</p>}
        <Button onClick={save} loading={saving} disabled={saving} fullWidth className="!py-3 !text-[length:var(--fs-11)] !font-black !uppercase !tracking-widest">
          <Icon name="straighten" className="text-[length:var(--fs-14)]" /> Save measurements
        </Button>
      </div>

      {/* History */}
      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-6 text-center">No measurements yet — log your first entry above.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border-light)]">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                {['Date', 'Weight', 'BF %', 'Chest', 'Waist', 'Hips', 'Arm', 'Thigh', 'Note', ''].map((h) => (
                  <th key={h} className="px-3 py-3 text-[length:var(--fs-9)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {sorted.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-3 py-3 text-[length:var(--fs-12)] font-black text-[var(--text-primary)] whitespace-nowrap">
                    {new Date(m.recorded_at + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] font-bold text-[var(--accent)] tabular-nums">{m.weight_kg ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] font-bold text-[var(--text-secondary)] tabular-nums">{m.body_fat_pct ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] text-[var(--text-secondary)] tabular-nums">{m.chest_cm ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] text-[var(--text-secondary)] tabular-nums">{m.waist_cm ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] text-[var(--text-secondary)] tabular-nums">{m.hips_cm ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] text-[var(--text-secondary)] tabular-nums">{m.arm_cm ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-12)] text-[var(--text-secondary)] tabular-nums">{m.thigh_cm ?? '—'}</td>
                  <td className="px-3 py-3 text-[length:var(--fs-11)] text-[var(--text-muted)] max-w-[180px] truncate" title={m.notes || ''}>{m.notes || ''}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => remove(m.id)} aria-label="Delete entry" className="w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors">
                      <Icon name="delete" className="text-[length:var(--fs-14)]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
