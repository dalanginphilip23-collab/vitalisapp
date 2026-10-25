import { useEffect, useState } from 'react';
import { apiPost } from '../../../../lib/apiClient.js';

const LEVELS_3 = ['LOW', 'MODERATE', 'HIGH'];
const QUALITY = ['LOW', 'MODERATE', 'GOOD'];

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`h-10 px-4 rounded-full text-[length:var(--fs-12)] font-bold uppercase tracking-wider border transition-colors ${active ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'}`}>
    {children}
  </button>
);

// Daily recovery check-in: sleep, quality, stress, soreness, energy.
// Feeds Readiness v2. Prefills today's existing answers when present.
const CheckInModal = ({ userId, initial, onClose, onSaved }) => {
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('MODERATE');
  const [stressLevel, setStressLevel] = useState('MODERATE');
  const [soreness, setSoreness] = useState('LOW');
  const [energyLevel, setEnergyLevel] = useState('MODERATE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initial) return;
    if (initial.sleep_hours != null) setSleepHours(String(initial.sleep_hours));
    if (initial.sleep_quality) setSleepQuality(initial.sleep_quality);
    if (initial.stress_level) setStressLevel(initial.stress_level);
    if (initial.soreness || initial.soreness_level) setSoreness(initial.soreness || initial.soreness_level);
    if (initial.energy_level) setEnergyLevel(initial.energy_level);
  }, [initial]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (sleepHours === '' || Number(sleepHours) < 0 || Number(sleepHours) > 24) {
      setError('Enter last night’s sleep duration (0–24h).');
      return;
    }
    setSaving(true); setError('');
    try {
      const data = await apiPost(`/api/checkins/${userId}`, {
        sleepHours: Number(sleepHours), sleepQuality, stressLevel, soreness, energyLevel,
      });
      onSaved?.(data.checkin);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-panel border border-[var(--border-light)] w-full max-w-[440px] rounded-[20px] p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[length:var(--fs-17)] font-bold">Daily Check-In</h3>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
          </button>
        </div>
        <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] mb-4">How are you feeling today? Powers your readiness score.</p>

        {error && <p className="bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-lg text-[var(--error)] text-[length:var(--fs-11)] font-semibold p-2.5 mb-3 text-center">{error}</p>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Sleep Duration (hours)</label>
            <input type="number" min="0" max="24" step="0.5" placeholder="7.5" value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 outline-none focus:border-[var(--accent)]" />
          </div>
          {/** @type {[string, string[], string, any][]} */ ([
            ['Sleep Quality', QUALITY, sleepQuality, setSleepQuality],
            ['Stress', LEVELS_3, stressLevel, setStressLevel],
            ['Muscle Soreness', LEVELS_3, soreness, setSoreness],
            ['Energy / Recovery', LEVELS_3, energyLevel, setEnergyLevel],
          ]).map(([label, opts, val, set]) => (
            <div key={label}>
              <label className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {opts.map((o) => <Chip key={o} active={val === o} onClick={() => set(o)}>{o}</Chip>)}
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="w-full h-12 rounded-[12px] bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[length:var(--fs-13)] disabled:opacity-50">
            {saving ? 'Saving...' : 'Complete Check-In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CheckInModal;
