import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../../../lib/apiClient.js';
import { useToastStore } from '../../../../stores/toastStore.js';
import Button from '../../../../components/ui/Button.jsx';
import Spinner from '../../../../components/ui/Spinner.jsx';

// MyFitnessPal-inspired quick log: one tap → the right logging surface.
// Weight logs inline; check-in opens the dashboard modal via onCheckIn;
// everything else deep-links to its module.
const QuickLog = ({ userId, onWeightLogged, onCheckIn }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [weighing, setWeighing] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [mode, setMode] = useState('menu'); // menu | weight

  const close = () => { setOpen(false); setMode('menu'); setWeight(''); setWeightError(''); };

  const logWeight = async (e) => {
    e.preventDefault();
    const w = Number(weight);
    if (weighing || !Number.isFinite(w) || w < 30 || w > 300) {
      setWeightError('Enter a valid weight (30–300 kg).');
      return;
    }
    setWeighing(true);
    setWeightError('');
    try {
      // Weight-only BMI log: reuse height from profile via backend sync path
      const profile = await apiGet(`/api/profile/${userId}`).catch(() => null);
      const heightRaw = profile?.height_cm ?? profile?.profile?.height_cm;
      const height = Number(heightRaw);
      if (!Number.isFinite(height) || height < 50 || height > 300) throw new Error('Set your height in Profile first.');
      const data = await apiPost(`/api/bmi/${userId}`, { weight_kg: w, height_cm: height });
      onWeightLogged?.(data);
      close();
    } catch (err) {
      // Surface stays open on failure so the value isn't lost
      setWeightError(err.message || 'Could not log weight.');
      useToastStore.getState().addToast(err.message || 'Could not log weight.', 'error');
      setWeighing(false);
    } finally {
      setWeighing(false);
    }
  };

  const items = [
    { icon: 'restaurant', label: 'Add Meal', action: () => navigate('/dashboard/meal-tracker?manual=1') },
    { icon: 'photo_camera', label: 'Scan Meal with AI', action: () => navigate('/dashboard/meal-tracker?scan=1') },
    { icon: 'monitor_weight', label: 'Log Weight', action: () => setMode('weight') },
    { icon: 'fitness_center', label: 'Log Workout', action: () => navigate('/dashboard/workouts') },
    { icon: 'directions_run', label: 'Start Activity', action: () => navigate('/dashboard/activity-map') },
    // Sleep is logged through the Daily Recovery check-in (captures hours + quality).
    { icon: 'fact_check', label: 'Daily Recovery Check-In', action: () => onCheckIn?.() },
  ];

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[length:var(--fs-13)] shadow-lg hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-transform">
        <span className="material-symbols-outlined text-[length:var(--fs-20)] font-bold">add</span> Quick Log
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={close}>
          <div className="glass-panel border border-[var(--border-light)] w-full max-w-[400px] rounded-[20px] p-4" onClick={(e) => e.stopPropagation()}>
            {mode === 'menu' ? (
              <>
                <div className="flex justify-between items-center px-2 py-2">
                  <p className="text-[length:var(--fs-11)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Quick Log</p>
                  <button onClick={close} aria-label="Close"
                    className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]">
                    <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
                  </button>
                </div>
                {items.map((it) => (
                  <button key={it.label} onClick={() => { close(); it.action(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] hover:bg-[var(--bg-hover)] transition-colors text-left">
                    <span className="w-9 h-9 rounded-full bg-[var(--bg-card)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[length:var(--fs-18)] text-[var(--accent)]">{it.icon}</span>
                    </span>
                    <span className="text-[length:var(--fs-14)] font-semibold">{it.label}</span>
                    <span className="material-symbols-outlined text-[length:var(--fs-18)] text-[var(--text-muted)] ml-auto">chevron_right</span>
                  </button>
                ))}
              </>
            ) : (
              <form onSubmit={logWeight} className="p-2">
                <p className="text-[length:var(--fs-11)] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Log Weight (kg)</p>
                <input type="number" min="30" max="300" step="0.1" autoFocus placeholder="e.g. 77.8"
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  className="w-full h-12 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-16)] outline-none focus:border-[var(--accent)]" />
                {weightError && <p className="text-[length:var(--fs-11)] font-semibold text-[var(--error)] mt-2">{weightError}</p>}
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setMode('menu')} disabled={weighing}
                    className="flex-1 h-11 rounded-[12px] border border-[var(--border-light)] text-[length:var(--fs-13)] font-bold disabled:opacity-50">Back</button>
                  <Button type="submit" loading={weighing} disabled={weighing || !Number(weight)} className="flex-1 !h-11">
                    {weighing ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default QuickLog;
