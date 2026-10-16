import { useState, useEffect, useRef } from 'react';
import {
  haversineDistanceM,
  acceptSegment,
  acceptLegacySegment,
  settleDecision,
  MAX_SETTLE_SKIPS,
} from '../lib/runMath.js';

export const useRunTimer = (isRecording, locationStatus, path, fixesRef) => {
  const [metrics, setMetrics] = useState({
    time: 0,
    distance: 0,
    pace: "0'00\"",
    calories: 0,
  });
  const [splits, setSplits] = useState([]);

  const timerRef      = useRef(null);
  const splitsRef     = useRef([]);
  const lastSplitRef  = useRef(0);
  const splitStartTimeRef = useRef(0);
  const prevPathRef   = useRef(path);
  // Index into path of the first point NOT yet consumed for distance.
  // The old code only measured the single newest segment per 1s tick, so
  // every extra GPS fix between ticks was silently dropped (under-count).
  const processedIdxRef = useRef(1);
  // Post-(re)start settle budget: skip segments until the receiver locks on
  // (first fix with accuracy <= 15m), up to MAX_SETTLE_SKIPS. The old single
  // boolean skipped exactly one leg, letting the settling tail leak distance.
  const settleBudgetRef = useRef(0);
  const wasRecordingRef = useRef(false);
  // Wall-clock anchor: background tabs throttle setInterval, so tick counting
  // undercounts real elapsed time. Elapsed is derived from Date.now() minus
  // accumulated pause time instead.
  const startedAtRef = useRef(null);
  const pausedMsRef = useRef(0);
  const pauseBeganRef = useRef(null);

  // Keep prevPathRef in sync with latest path
  useEffect(() => {
    prevPathRef.current = path;
  }, [path]);

  // Arm the settle-skip budget + wall-clock anchor on (re)start; freeze the
  // clock on pause so background time never bills.
  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      settleBudgetRef.current = MAX_SETTLE_SKIPS;
      if (pauseBeganRef.current != null) {
        pausedMsRef.current += Date.now() - pauseBeganRef.current;
        pauseBeganRef.current = null;
      }
    }
    if (!isRecording && wasRecordingRef.current) {
      pauseBeganRef.current = Date.now();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setMetrics((prev) => {
          const elapsed = startedAtRef.current == null
            ? prev.time + 1
            : Math.round((Date.now() - startedAtRef.current - pausedMsRef.current) / 1000);
          // Never run backwards (pause/resume edge) — wall clock only moves on.
          const t = Math.max(prev.time + (startedAtRef.current == null ? 1 : 0), elapsed);

          // ── Real GPS distance only ─────────────────────────────────────────
          // No simulated movement: when GPS is unavailable the timer keeps
          // counting but distance stays at its last real value. Recording
          // without GPS is blocked at the Start button (see ActivityMap),
          // so this branch only covers GPS dropping mid-run.
          // ALL new segments since the last tick are summed (not just the
          // newest one) — otherwise fast GPS update rates under-count.
          let d = prev.distance;
          const currentPath = prevPathRef.current;
          const fixes = fixesRef?.current ?? [];
          if (locationStatus === 'granted' && currentPath.length >= 2) {
            if (currentPath.length < processedIdxRef.current) {
              processedIdxRef.current = Math.max(1, currentPath.length);
            }
            let start = Math.max(1, processedIdxRef.current);
            for (let i = start; i < currentPath.length; i++) {
              // Settle gate: ignore the post-(re)start tail until accuracy locks.
              if (settleBudgetRef.current > 0) {
                const r = settleDecision(fixes[i]?.acc, settleBudgetRef.current);
                settleBudgetRef.current = r.budget;
                if (r.skip) continue;
              }
              const deltaM = haversineDistanceM(currentPath[i - 1], currentPath[i]);
              const a = fixes[i - 1];
              const b = fixes[i];
              if (a && b) {
                const dtSec = (b.t - a.t) / 1000;
                // Speed-gated: teleports fail on m/s, slow-but-real legs pass
                // however long the fix interval was (up to the stale-gap cap).
                if (acceptSegment({ deltaM, dtSec }).ok) {
                  d += deltaM / 1000; // convert to km
                }
              } else if (acceptLegacySegment(deltaM)) {
                // No timestamps (old path shape) — legacy distance-only gate.
                d += deltaM / 1000;
              }
            }
            processedIdxRef.current = currentPath.length;
          }

          // ── Pace (min/km) ──────────────────────────────────────────────────
          const ps   = d > 0 ? t / d : 0;
          const pm   = Math.floor(ps / 60);
          const pc   = Math.floor(ps % 60);
          const pace = `${pm}'${pc.toString().padStart(2, '0')}"`;

          // ── Calories (MET ~8 for running, avg 70 kg) ──────────────────────
          const cal = Math.floor(d * 60);

          // ── Splits (per-km pace, not overall average) ──────────────────────
          const km = Math.floor(d);
          if (km > lastSplitRef.current) {
            lastSplitRef.current = km;
            const splitSecs = Math.max(1, t - splitStartTimeRef.current);
            splitStartTimeRef.current = t;
            const spm = Math.floor(splitSecs / 60);
            const spc = Math.floor(splitSecs % 60);
            const splitPace = `${spm}'${spc.toString().padStart(2, '0')}"`;
            const ns = { km: splitsRef.current.length + 1, pace: splitPace };
            splitsRef.current = [...splitsRef.current, ns];
            setSplits([...splitsRef.current]);
          }

          return { time: t, distance: d, pace, calories: cal };
        });

        // NOTE: no simulated path drift — the route only grows from real
        // geolocation watch positions (see useGeolocation).
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRecording, locationStatus, fixesRef]);

  const resetMetrics = () => {
    setMetrics({ time: 0, distance: 0, pace: "0'00\"", calories: 0 });
    setSplits([]);
    splitsRef.current    = [];
    lastSplitRef.current = 0;
    splitStartTimeRef.current = 0;
    processedIdxRef.current = 1;
    settleBudgetRef.current = MAX_SETTLE_SKIPS; // skip the initial GPS settle jump
    // Called synchronously on Start (before recording flips true) — anchor the
    // wall clock here so background-tab throttle never undercounts time.
    startedAtRef.current = Date.now();
    pausedMsRef.current = 0;
    pauseBeganRef.current = null;
  };

  return {
    metrics,
    splits,
    splitsRef,
    resetMetrics,
  };
};