import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GOAL_TYPES, goalLabel } from '../../Onboarding/constants/goals.js';
import ChangeGoalModal from '../../Profile/components/ChangeGoalModal.jsx';
import { useToastStore } from '../../../../stores/toastStore.js';
import { apiPost } from '../../../../lib/apiClient.js';

const goalIcon = (goalType) => GOAL_TYPES.find((g) => g.key === goalType)?.icon || 'flag';

// Goal detail sheet — opened from the Dashboard "Goal" card so "View"
// shows the actual goal (targets, weight progress) instead of landing
// on the generic Analytics page.
export default function GoalDetailSheet({ userId, goal, currentWeightKg, progressPct, onClose, onUpdated }) {
  const navigate = useNavigate();
  const [changeOpen, setChangeOpen] = useState(false);
  const [recalBusy, setRecalBusy] = useState(false);

  const addToast = (msg, type = 'success') => {
    try {
      useToastStore.getState().addToast(msg, type);
    } catch { /* noop */ }
  };

  // Manual recalibration — re-derives daily kcal/macros from the latest
  // weigh-in (auto version is threshold-gated inside the backend; this
  // forces the recompute).
  const recalibrate = async () => {
    if (recalBusy) return;
    setRecalBusy(true);
    try {
      const data = await apiPost(`/api/goals/active/${userId}/recalibrate`, {});
      const kcal = data?.plan?.dailyKcal;
      addToast(
        kcal != null
          ? `Targets updated to ${Number(kcal).toLocaleString()} kcal/day — recalibrated to your latest weight.`
          : data?.message || 'Targets recalibrated to your latest weight.'
      );
      onUpdated?.(data?.goal);
    } catch (err) {
      addToast(err?.message || 'Recalibration failed — try again.', 'error');
    } finally {
      setRecalBusy(false);
    }
  };

  const startKg = goal?.weightKg != null ? Number(goal.weightKg) : null;
  const targetKg = goal?.targetWeightKg != null ? Number(goal.targetWeightKg) : null;
  const currentKg = currentWeightKg != null ? Number(currentWeightKg) : startKg;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="glass-panel border border-[var(--border-light)] w-full max-w-[440px] rounded-[20px] p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center">
                <span className="material-symbols-outlined text-[length:var(--fs-20)]">{goalIcon(goal?.goalType)}</span>
              </span>
              <div>
                <h3 className="text-[length:var(--fs-17)] font-bold leading-tight">{goal ? goalLabel(goal.goalType) : 'Goal'}</h3>
                <p className="text-[length:var(--fs-11)] text-[var(--text-muted)]">Your active fitness goal</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)]"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
            </button>
          </div>

          {/* Daily targets */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5">
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Daily Calories</p>
              <p className="text-[length:var(--fs-20)] font-black mt-0.5">
                {goal?.dailyKcal != null ? Number(goal.dailyKcal).toLocaleString() : '—'}
                <span className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]"> kcal</span>
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5">
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Protein Target</p>
              <p className="text-[length:var(--fs-20)] font-black mt-0.5">
                {goal?.proteinG != null ? Number(goal.proteinG) : '—'}
                <span className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]"> g</span>
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5">
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Carbs Target</p>
              <p className="text-[length:var(--fs-20)] font-black mt-0.5">
                {goal?.carbsG != null ? Number(goal.carbsG) : '—'}
                <span className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]"> g</span>
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] p-3.5">
              <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Fat Target</p>
              <p className="text-[length:var(--fs-20)] font-black mt-0.5">
                {goal?.fatG != null ? Number(goal.fatG) : '—'}
                <span className="text-[length:var(--fs-11)] font-bold text-[var(--text-muted)]"> g</span>
              </p>
            </div>
          </div>

          {/* Weight journey */}
          {targetKg != null && (
            <div className="mt-3 rounded-[14px] bg-[var(--bg-hover)] border border-[var(--border-light)] p-4">
              <div className="flex justify-between items-baseline">
                <p className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Weight Journey</p>
                {progressPct != null && (
                  <p className="text-[length:var(--fs-12)] font-black text-[var(--accent)]">{progressPct}%</p>
                )}
              </div>
              <p className="text-[length:var(--fs-14)] font-bold mt-1.5">
                {startKg != null ? `${startKg} kg` : '—'}
                <span className="text-[var(--text-muted)] font-semibold"> → </span>
                {currentKg != null ? `${currentKg} kg` : '—'}
                <span className="text-[var(--text-muted)] font-semibold"> → </span>
                {targetKg} kg
              </p>
              {progressPct != null && (
                <div className="h-2 bg-[var(--bg-active)] rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                  />
                </div>
              )}
              {currentKg != null && currentKg !== startKg && (
                <button
                  onClick={recalibrate}
                  disabled={recalBusy}
                  className="w-full mt-2.5 h-9 rounded-[10px] border border-[var(--border-light)] text-[length:var(--fs-11)] font-bold text-[var(--text-muted)] flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[length:var(--fs-16)]">
                    {recalBusy ? 'progress_activity' : 'refresh'}
                  </span>
                  {recalBusy ? 'Recalibrating…' : `Recalibrate targets to ${currentKg} kg`}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setChangeOpen(true)}
              className="flex-1 h-12 rounded-[12px] border border-[var(--border-light)] font-bold text-[length:var(--fs-13)] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-18)]">edit</span> Change Goal
            </button>
            <button
              onClick={() => { onClose?.(); navigate('/dashboard/plans'); }}
              className="flex-1 h-12 rounded-[12px] bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[length:var(--fs-13)] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-18)]">book</span> View Plans
            </button>
          </div>
        </div>
      </div>

      {changeOpen && (
        <ChangeGoalModal
          userId={userId}
          currentGoal={goal}
          showToast={addToast}
          onClose={() => setChangeOpen(false)}
          onUpdated={(updated) => {
            setChangeOpen(false);
            onUpdated?.(updated);
          }}
        />
      )}
    </>
  );
}
