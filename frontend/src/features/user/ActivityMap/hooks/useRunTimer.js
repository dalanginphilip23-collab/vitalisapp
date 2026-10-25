import { useState, useEffect, useRef } from 'react';
import { haversineMeters, formatPace } from '../utils/geo.js';

// Segments under this are jitter (the geolocation hook already rejected
// duplicates); anything larger is summed as real movement.
const MIN_SEGMENT_M = 0.3;

const EMPTY_METRICS = { time: 0, distance: 0, pace: '–', calories: 0 };

export const useRunTimer = (isRecording, locationStatus, path) => {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [splits, setSplits]   = useState([]);

  const timerRef          = useRef(null);
  const splitsRef         = useRef([]);
  const lastSplitRef      = useRef(0);
  const splitStartTimeRef = useRef(0);
  const prevPathRef       = useRef(path);
  // Cumulative, monotonic totals — the source of truth for the UI.
  const totalsRef         = useRef({ time: 0, distance: 0 });
  // Index into path of the first point NOT yet consumed for distance.
  const processedIdxRef   = useRef(1);
  // Skip exactly one boundary segment after (re)start — the GPS settle jump.
  const resumeSkipRef     = useRef(false);
  const wasRecordingRef   = useRef(false);
  // Monotonic wall clock (immune to system clock changes / tab throttling
  // is handled by summing real deltas instead of counting ticks).
  const lastTickRef       = useRef(0);

  // Keep prevPathRef in sync with latest path
  useEffect(() => {
    prevPathRef.current = path;
  }, [path]);

  // Arm the one-segment boundary skip whenever recording (re)starts.
  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      resumeSkipRef.current = true;
      lastTickRef.current = performance.now();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      clearInterval(timerRef.current);
      return undefined;
    }

    lastTickRef.current = performance.now();

    timerRef.current = setInterval(() => {
      // ── Active time from a monotonic clock (no drift, no clock jumps) ───────
      const now = performance.now();
      const dtSec = Math.max(0, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      totalsRef.current.time += dtSec;
      const t = totalsRef.current.time;

      // ── Real GPS distance only ─────────────────────────────────────────────
      // No simulated movement: when GPS is unavailable the timer keeps
      // counting but distance stays at its last real value. Recording without
      // GPS is blocked at the Start button (see ActivityMap).
      // All new segments since the last tick are summed — not just the newest.
      const currentPath = prevPathRef.current;
      if (locationStatus === 'granted' && currentPath.length >= 2) {
        if (currentPath.length < processedIdxRef.current) {
          processedIdxRef.current = Math.max(1, currentPath.length);
        }
        let start = processedIdxRef.current;
        if (resumeSkipRef.current && currentPath.length > start) {
          start += 1; // skip the settle/teleport boundary segment
          resumeSkipRef.current = false;
        }
        for (let i = Math.max(1, start); i < currentPath.length; i++) {
          const deltaM = haversineMeters(currentPath[i - 1], currentPath[i]);
          if (deltaM >= MIN_SEGMENT_M) {
            totalsRef.current.distance += deltaM / 1000; // convert to km
          }
        }
        processedIdxRef.current = currentPath.length;
      }

      const d = totalsRef.current.distance;

      // ── Pace (min/km) — honest "–" until there is real distance ────────────
      const pace = formatPace(t, d);

      // ── Calories (MET ~8 for running, avg 70 kg) ──────────────────────────
      const cal = Math.floor(d * 60);

      // ── Splits (per-km pace, not overall average) ──────────────────────────
      const km = Math.floor(d);
      if (km > lastSplitRef.current) {
        lastSplitRef.current = km;
        const splitSecs = Math.max(1, Math.round(t - splitStartTimeRef.current));
        splitStartTimeRef.current = t;
        const spm = Math.floor(splitSecs / 60);
        const spc = Math.floor(splitSecs % 60);
        const splitPace = `${spm}'${spc.toString().padStart(2, '0')}"`;
        const ns = { km: splitsRef.current.length + 1, pace: splitPace };
        splitsRef.current = [...splitsRef.current, ns];
        setSplits([...splitsRef.current]);
      }

      setMetrics({ time: Math.floor(t), distance: d, pace, calories: cal });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isRecording, locationStatus]);

  const resetMetrics = () => {
    setMetrics(EMPTY_METRICS);
    setSplits([]);
    totalsRef.current        = { time: 0, distance: 0 };
    splitsRef.current        = [];
    lastSplitRef.current     = 0;
    splitStartTimeRef.current = 0;
    processedIdxRef.current  = 1;
    resumeSkipRef.current    = true; // skip the initial GPS settle jump
  };

  return {
    metrics,
    splits,
    splitsRef,
    resetMetrics,
  };
};
