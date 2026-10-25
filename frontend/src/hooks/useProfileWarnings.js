import { useEffect, useState } from 'react';
import { apiGet } from '../lib/apiClient.js';

// 30s in-memory cache — the header remounts on every dashboard/* navigation,
// so a short cache stops this from refiring a GET on every nav.
const _cache = new Map(); // userId -> { at, data }
const getCached = (uid) => {
  const e = _cache.get(uid);
  if (e && Date.now() - e.at < 30000) return e.data;
  return null;
};
const setCached = (uid, data) => {
  _cache.set(uid, { at: Date.now(), data });
  if (_cache.size > 50) _cache.delete(_cache.keys().next().value);
};

/**
 * "Profile setup incomplete" warnings for the header/avatar.
 *
 * Rule (broadest variant): unfinished onboarding OR missing body metrics
 * (height/weight) OR no active fitness goal.
 *
 * Onboarding + goal live on the auth user, so those reasons appear
 * immediately. Metrics/goal come from GET /api/profile/:id — read-only,
 * best-effort: the header never blocks or errors on this call.
 *
 * @param {number|string|null} authedUserId only pass a proven session user id
 * @param {{ onboardingCompleted?: boolean, fitness_goal?: unknown, goalType?: unknown, goal?: unknown } | null} user
 * @returns {{ hasWarning: boolean, reasons: string[] }}
 */
export function useProfileWarnings(authedUserId, user) {
  const [profile, setProfile] = useState(() => (authedUserId ? getCached(authedUserId) : null));

  useEffect(() => {
    if (!authedUserId) return undefined;
    let alive = true;
    // Async IIFE: keeps setState out of the synchronous effect body (lint) and
    // lets a cache hit resolve without an extra render pass.
    (async () => {
      const hit = getCached(authedUserId);
      if (hit) {
        if (alive) setProfile(hit);
        return;
      }
      try {
        const data = await apiGet(`/api/profile/${authedUserId}`);
        if (data) setCached(authedUserId, data);
        if (alive && data) setProfile(data);
      } catch { /* best-effort: fall back to whatever the auth user says */ }
    })();
    return () => { alive = false; };
  }, [authedUserId]);

  const hasHeight = Boolean(profile?.height_cm || profile?.onboarding?.heightCm);
  const hasWeight = Boolean(profile?.weight_kg || profile?.onboarding?.weightKg);
  const hasGoal = Boolean(
    profile?.onboarding?.goalType || user?.fitness_goal || user?.goalType || user?.goal,
  );

  const reasons = [];
  if (user?.onboardingCompleted === false) reasons.push('finish onboarding');
  if (profile && (!hasHeight || !hasWeight)) reasons.push('add your body metrics');
  if (profile && !hasGoal) reasons.push('set a fitness goal');

  return { hasWarning: reasons.length > 0, reasons };
}
