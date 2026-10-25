// Module 5 — training preferences + rule-based insights for the Plans page.
// Server state fetched manually via apiClient (repo convention: no react-query
// in feature hooks). Silent degradation: prefs/insights never block plans.
import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiGet, apiPost } from '../../../../lib/apiClient.js';

export function useTrainingPrefs() {
  const [prefs, setPrefs]             = useState(null);
  const [options, setOptions]         = useState({ equipment: [], locations: [], days: [] });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/training-preferences');
      setPrefs(data?.preferences ?? null);
      setOptions(data?.options ?? { equipment: [], locations: [], days: [] });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (body) => {
    // apiClient has no PUT helper — apiFetch handles it (auto JSON headers,
    // credentials, timeout, 401 funnel, matching apiPost's shape).
    const data = await apiFetch('/api/training-preferences', {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    });
    setPrefs(data?.preferences ?? null);
    return data?.preferences ?? null;
  }, []);

  return { prefs, options, loading, error, reload, save };
}

const EMPTY_INSIGHTS = { stats: null, tips: [] };

export function useTrainingInsights() {
  const [data, setData]     = useState(EMPTY_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet('/api/training-insights');
      setData({ stats: d?.stats ?? null, tips: Array.isArray(d?.tips) ? d.tips : [] });
    } catch {
      setData(EMPTY_INSIGHTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // One-click apply of a tip's action ('shorter' | 'gentle'). Returns the
  // server message; busy flag drives the Apply button's disabled state.
  const apply = useCallback(async (mode) => {
    if (!mode || applying) return null;
    setApplying(true);
    try {
      const res = await apiPost('/api/plans/adjust-from-goal', { mode });
      return res?.message ?? 'Plan adjusted';
    } catch {
      return null;
    } finally {
      setApplying(false);
    }
  }, [applying]);

  return { insights: data, tips: data.tips, stats: data.stats, loading, reload, apply, applying };
}
