import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../lib/apiClient.js';
import { qk } from '../../../../lib/queries.js';

// Today's logged macros (from food-logs) for the Today screen + Macro Coach.
// Use local date (en-CA = YYYY-MM-DD) so PH timezone matches MySQL CURDATE().
const todayKey = () => new Date().toLocaleDateString('en-CA');

export const useTodayMeals = (userId) => {
  const [meals, setMeals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, trans_fat: 0, polyunsaturated_fat: 0, monounsaturated_fat: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/food-logs/${userId}`);
      // Warm the canonical cache so new query hooks stay in sync with legacy hook
      qc.setQueryData(qk.foodLogs(userId), data);
      const records = Array.isArray(data) ? data : data.records || [];
      const today = records.filter((m) => m.logged_at && String(m.logged_at).startsWith(todayKey()));
      setMeals({
        kcal: Math.round(today.reduce((a, m) => a + (Number(m.calories) || 0), 0)),
        protein: Math.round(today.reduce((a, m) => a + (Number(m.protein) || 0), 0)),
        carbs: Math.round(today.reduce((a, m) => a + (Number(m.carbs) || 0), 0)),
        fat: Math.round(today.reduce((a, m) => a + (Number(m.fat) || 0), 0)),
        saturated_fat: Math.round(today.reduce((a, m) => a + (Number(m.saturated_fat) || 0), 0) * 10) / 10,
        trans_fat: Math.round(today.reduce((a, m) => a + (Number(m.trans_fat) || 0), 0) * 10) / 10,
        polyunsaturated_fat: Math.round(today.reduce((a, m) => a + (Number(m.polyunsaturated_fat) || 0), 0) * 10) / 10,
        monounsaturated_fat: Math.round(today.reduce((a, m) => a + (Number(m.monounsaturated_fat) || 0), 0) * 10) / 10,
        count: today.length,
      });
    } catch {
      // Empty plate — cards render zeros with log CTA
    } finally {
      setLoading(false);
    }
  }, [userId, qc]);

  useEffect(() => { refresh(); }, [refresh]);

  return { meals, loading, refreshMeals: refresh };
};
