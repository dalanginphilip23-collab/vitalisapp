import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../../../lib/apiClient.js';

// Single source for the active goal — dashboard, nutrition, progress and AI
// all read from here so the selected goal drives the whole system.
export const useActiveGoal = (userId) => {
  const [goal, setGoal] = useState(null);
  const [currentWeightKg, setCurrentWeightKg] = useState(null);
  const [progressPct, setProgressPct] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await apiGet(`/api/goals/active/${userId}`);
      setGoal(data.goal || null);
      setCurrentWeightKg(data.currentWeightKg ?? null);
      setProgressPct(data.progressPct ?? null);
    } catch {
      // No goal yet — consumers render their empty states
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { goal, currentWeightKg, progressPct, loading, refresh };
};
