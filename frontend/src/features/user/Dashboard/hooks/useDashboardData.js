import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, apiPost } from '../../../../lib/apiClient.js';
import { acquireSocket, releaseSocket, joinUserRoom } from '../../../../lib/socket.js';
import { localTodayIso } from '../lib/dashboardFormat.js';

export const useDashboardData = (USER_ID) => {
  const [data, setData]             = useState({ stats: {}, profile: {}, checkin: null });
  const [insights, setInsights]     = useState([]);
  const [biometrics, setBiometrics] = useState([]);
  const [workouts, setWorkouts]     = useState([]);
  const [dashboardError, setDashboardError] = useState(null);
  const [loaded, setLoaded]         = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Best-effort post-log AI refresh: never throws or blocks the UI.
  const generateFitnessInsight = useCallback(async (_biometrics, newStats) => {
    if (!USER_ID) return;
    try {
      const res = await apiPost('/api/ai/analysis', {
        stats: {
          sleep_duration: Number(newStats?.sleep_duration) || 0,
          sleep_quality: Number(newStats?.sleep_quality) || 0,
          water_intake_ml: Number(newStats?.water_intake_ml) || 0,
          calories_burned: Number(newStats?.calories_burned) || 0,
          steps: Number(newStats?.steps) || 0,
          workout_duration_mins: Number(newStats?.workout_duration_mins) || 0,
        },
      }, { timeoutMs: 60000 }).catch(() => null);
      if (res?.insights?.length) setInsights(res.insights);
    } catch {
      /* dashboard already shows fresh DB stats without AI text */
    }
  }, [USER_ID]);

  const authOverrideRef = useRef({ name: null, avatar: null });

  const setAuthOverride = useCallback((name, avatar) => {
    authOverrideRef.current = { name, avatar };
    setData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        ...(name   && { name }),
        ...(avatar && { avatar_url: avatar }),
      },
    }));
  }, []);

  // Auth values always win over API values.
  const mergeData = (apiResult) => ({
    ...apiResult,
    profile: {
      ...apiResult.profile,
      ...(authOverrideRef.current.name   && { name:       authOverrideRef.current.name }),
      ...(authOverrideRef.current.avatar && { avatar_url: authOverrideRef.current.avatar }),
    },
  });

  useEffect(() => {
    if (!USER_ID) return;

    // Independent signals so one abort doesn't cancel the other parallel fetches.
    const controllers = new Set();
    const trackFetch = (path, opts = {}) => {
      const c = new AbortController();
      controllers.add(c);
      return apiFetch(path, { ...opts, signal: c.signal }).finally(() => controllers.delete(c));
    };
    const socket = acquireSocket();

    const fetchDashboardData = async (isRetry = false) => {
      try {
        // Sleep/workout 404s fall back to empty; dashboard errors still surface.
        const [result, sleepData, bioData, workoutData] = await Promise.all([
          trackFetch(`/api/dashboard/${USER_ID}?today=${localTodayIso()}`),
          trackFetch(`/api/sleep/${USER_ID}/today`).catch(() => ({})),
          trackFetch(`/api/sleep/${USER_ID}?range=D&metric=duration`).catch(() => []),
          trackFetch(`/api/workout-logs`).catch(() => ({ logs: [] })),
        ]);

        setData(mergeData({
          ...result,
          stats: {
            ...result.stats,
            water_intake_ml: result.stats?.water_intake_ml ?? sleepData?.water_intake_ml ?? 0,
            sleep_duration:  result.stats?.sleep_duration  ?? sleepData?.sleep_duration  ?? 0,
            sleep_quality:   result.stats?.sleep_quality   ?? sleepData?.sleep_quality   ?? 0,
          },
        }));

        if (Array.isArray(bioData) && bioData.length > 0) {
          setBiometrics(bioData);
        }

        const logs = Array.isArray(workoutData?.logs) ? workoutData.logs : [];
        setWorkouts(logs);

        if (result.insights) setInsights(result.insights);
        setDashboardError(null);
        setLoaded(true);

      } catch (error) {
        if (controllers.size === 0) return; // unmounted
        const isNetwork = error?.status === 0 || error?.code === 'TIMEOUT';
        if (isNetwork && !isRetry) {
          await new Promise((r) => setTimeout(r, 1500));
          return fetchDashboardData(true);
        }
        let hint = error;
        if (isNetwork) {
          try {
            await trackFetch('/api/health', { skipAuthRedirect: true, timeoutMs: 5000 });
            hint = new Error('Dashboard request timed out, but the server is up. It may be a slow query — try again.');
          } catch {
            hint = new Error("Backend unreachable. Start it with 'npm run dev' in backend/ and check VITE_API_URL.");
          }
          hint.cause = error;
        }
        setDashboardError(hint);
        setLoaded(true);
        if (import.meta.env.DEV) {
          console.error('Fetch Error:', error);
        }
      }
    };

    fetchDashboardData();
    joinUserRoom(USER_ID);

    const handleNewBiometric = (newPoint) => {
      const normalised = {
        label: newPoint.recorded_at
          ? new Date(newPoint.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : newPoint.label ?? '--:--',
        value: newPoint.value ?? newPoint.sleep_duration ?? 0,
      };
      setBiometrics(prev => [...prev.slice(-19), normalised]);
    };

    const handleNewInsight = (insight) => {
      setInsights(prev => [insight, ...prev].slice(0, 5));
    };

    socket.on('new-biometric-data',   handleNewBiometric);
    // New event name; legacy 'new-clinical-insight' kept for backward compatibility.
    socket.on('new-fitness-insight',  handleNewInsight);
    socket.on('new-clinical-insight', handleNewInsight);

    return () => {
      for (const c of [...controllers]) { try { c.abort(); } catch { /* noop */ } }
      controllers.clear();
      socket.off('new-biometric-data',   handleNewBiometric);
      socket.off('new-fitness-insight',  handleNewInsight);
      socket.off('new-clinical-insight', handleNewInsight);
      releaseSocket();
    };
  }, [USER_ID, refreshKey]);

  return {
    data,
    insights,
    biometrics,
    workouts,
    dashboardError,
    loaded,
    setData,
    setInsights,
    setBiometrics,
    setAuthOverride,
    mergeData,
    refresh,
    generateFitnessInsight,
    // Aliases kept so older callers using generateAiInsight/generateClinicalInsight keep working
    generateAiInsight: generateFitnessInsight,
    generateClinicalInsight: generateFitnessInsight,
  };
};