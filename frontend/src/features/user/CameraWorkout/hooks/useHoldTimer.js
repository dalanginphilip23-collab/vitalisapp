// useHoldTimer.js — time-based hold mode for duration/stretch exercises.
// Accumulates hold seconds only while the pose is visible AND stable.
// Wobble pauses (never full-resets): pause on unstable/lost frames.
import { useCallback, useEffect, useRef, useState } from 'react';
import { speak } from './useRepCounter.js';

const FRAME_DT = 0.15; // usePoseEngine sends a frame every ~150ms
const STABLE_JITTER = 0.012; // normalized-coord drift threshold

function keyPoints(lm) {
  // Shoulders + hips drive stability for holds (plank, wall-sit, stretches).
  return [lm[11], lm[12], lm[23], lm[24]].filter(Boolean);
}

export function useHoldTimer({ voiceEnabled }) {
  const [holdSecs, setHoldSecs] = useState(0);
  const holdRef = useRef(0);
  const prevRef = useRef(null);
  const spokenRef = useRef(new Set());
  const targetRef = useRef(45);

  useEffect(() => { holdRef.current = holdSecs; }, [holdSecs]);

  const setTarget = useCallback((secs) => {
    targetRef.current = Math.max(5, Math.min(600, Number(secs) || 45));
    spokenRef.current = new Set();
  }, []);

  // Returns { holding, stable } for overlay text.
  const update = useCallback((landmarks, visible) => {
    if (!landmarks || !visible) {
      prevRef.current = null;
      return { holding: false, stable: false };
    }
    const pts = keyPoints(landmarks);
    if (pts.length < 3) {
      prevRef.current = null;
      return { holding: false, stable: false };
    }
    let stable = true;
    const prev = prevRef.current;
    if (prev && prev.length === pts.length) {
      let drift = 0;
      for (let i = 0; i < pts.length; i++) {
        drift += Math.abs(pts[i].x - prev[i].x) + Math.abs(pts[i].y - prev[i].y);
      }
      stable = drift / pts.length < STABLE_JITTER;
    }
    prevRef.current = pts.map((p) => ({ x: p.x, y: p.y }));

    if (stable) {
      const next = holdRef.current + FRAME_DT;
      holdRef.current = next;
      setHoldSecs(next);
    }
    return { holding: stable, stable };
  }, []);

  // Voice milestones: halfway, 10s left, final 5-4-3-2-1.
  useEffect(() => {
    if (!voiceEnabled) return;
    const target = targetRef.current;
    const done = Math.floor(holdRef.current);
    const spoken = spokenRef.current;
    const say = (k, msg) => {
      if (!spoken.has(k)) {
        spoken.add(k);
        speak(msg, 1.05, 1.0);
      }
    };
    if (done >= Math.floor(target / 2) && target >= 20) say('half', 'Halfway there, hold steady!');
    const left = Math.ceil(target - holdRef.current);
    if (left === 10) say('10left', 'Ten seconds left!');
    if (left <= 5 && left >= 1) say(`c${left}`, `${left}!`);
  }, [holdSecs, voiceEnabled]);

  const resetHold = useCallback(() => {
    holdRef.current = 0;
    setHoldSecs(0);
    prevRef.current = null;
    spokenRef.current = new Set();
  }, []);

  return { holdSecs, holdRef, updateHold: update, resetHold, setHoldTarget: setTarget };
}
