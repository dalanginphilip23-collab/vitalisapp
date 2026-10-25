import { useCallback, useRef, useState } from 'react';
import { apiPost, apiPatch } from '../../../../lib/apiClient.js';

export function useWorkoutSession() {
  const [sessionId,     setSessionId]     = useState(null);
  const [isActive,      setIsActive]      = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionError,  setSessionError]  = useState(null);

  const sessionIdRef = useRef(null);

  const startSession = useCallback(async (workoutType) => {
    setSessionError(null);
    setSessionResult(null);

    try {
      const data = await apiPost('/api/workout-logs/start', { workout_type: workoutType });
      sessionIdRef.current = data.session_id;
      setSessionId(data.session_id);
      setIsActive(true);
      if (import.meta.env.DEV) console.info('[useWorkoutSession] started → id:', data.session_id);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useWorkoutSession] startSession failed:', err.message);
      setSessionError(err.message);
      // Don't rethrow — caller is fire-and-forget
    }
  }, []);

  // ── Module 5: pause/resume sync ─────────────────────────────────────────────
  // Local camera timers keep working as before; these calls just keep the
  // server row in step so wall-clock duration excludes paused time. Both are
  // fire-and-forget — a network hiccup must never interrupt the session UI.
  const pauseSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;
    try {
      await apiPost(`/api/workout-logs/${id}/pause`, {});
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useWorkoutSession] pauseSession failed:', err.message);
    }
  }, []);

  const resumeSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return;
    try {
      await apiPost(`/api/workout-logs/${id}/resume`, {});
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useWorkoutSession] resumeSession failed:', err.message);
    }
  }, []);

  const endSession = useCallback(async (status = 'completed', repCount = 0, sets = undefined) => {
    const id = sessionIdRef.current;
    if (!id) {
      if (import.meta.env.DEV) console.warn('[useWorkoutSession] endSession called with no active session');
      return;
    }

    setSessionError(null);

    try {
      const body = { status, rep_count: repCount };
      // Only include sets when the caller supplies them — legacy shape stays
      // identical on the wire otherwise.
      if (sets !== undefined) body.sets = sets;
      const data = await apiPatch(`/api/workout-logs/${id}/end`, body);
      setSessionResult(data);
      if (import.meta.env.DEV) console.info('[useWorkoutSession] ended → duration:', data.duration_seconds, 's');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useWorkoutSession] endSession failed:', err.message);
      setSessionError(err.message);
      // Don't rethrow — caller is fire-and-forget
    } finally {
      sessionIdRef.current = null;
      setSessionId(null);
      setIsActive(false);
    }
  }, []);

  return { sessionId, isActive, startSession, pauseSession, resumeSession, endSession, sessionResult, sessionError };
}
