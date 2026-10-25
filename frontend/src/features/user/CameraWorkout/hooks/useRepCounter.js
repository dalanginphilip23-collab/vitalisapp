import { useCallback, useEffect, useRef, useState } from 'react';

function angle3(a, b, c) {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((rad * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

function buildRepCounter() {
  let phase = 'up';
  const angleHistory = [];
  const HIST = 3;
  const push = (v) => {
    angleHistory.push(v);
    if (angleHistory.length > HIST) angleHistory.shift();
    const sorted = [...angleHistory].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const visible = (lm, idxs) => idxs.every((i) => {
    const p = lm?.[i];
    if (!p) return false;
    if (p.visibility != null && p.visibility < 0.5) return false;
    return Number.isFinite(p.x) && Number.isFinite(p.y);
  });
  return function countRep(lm, workoutType) {
    try {
      if (!Array.isArray(lm) || lm.length < 29) return false;
      switch (workoutType) {
        case 'pushup': {
          if (!visible(lm, [11, 13, 15])) return false;
          const ang = push(angle3(lm[11], lm[13], lm[15]));
          if (ang < 90  && phase === 'up')   { phase = 'down'; return false; }
          if (ang > 155 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'squat': {
          if (!visible(lm, [23, 25, 27])) return false;
          const ang = push(angle3(lm[23], lm[25], lm[27]));
          if (ang < 100 && phase === 'up')   { phase = 'down'; return false; }
          if (ang > 160 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'lunge': {
          if (!visible(lm, [23, 25, 27])) return false;
          const ang = push(angle3(lm[23], lm[25], lm[27]));
          if (ang < 110 && phase === 'up')   { phase = 'down'; return false; }
          if (ang > 160 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'bicep_curl': {
          if (!visible(lm, [11, 13, 15])) return false;
          const ang = push(angle3(lm[11], lm[13], lm[15]));
          if (ang < 60  && phase === 'up')   { phase = 'down'; return false; }
          if (ang > 150 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'overhead': {
          if (!visible(lm, [13, 11, 23])) return false;
          const ang = push(angle3(lm[13], lm[11], lm[23]));
          if (ang > 160 && phase === 'up')   { phase = 'down'; return false; }
          if (ang < 80  && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'crunch':
        case 'situp': {
          if (!visible(lm, [11, 23, 25])) return false;
          const ang = push(angle3(lm[11], lm[23], lm[25]));
          if (ang < 80  && phase === 'up')   { phase = 'down'; return false; }
          if (ang > 140 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'lateral_raise': {
          if (!visible(lm, [11, 12, 13, 14])) return false;
          const shoulderY = (lm[11].y + lm[12].y) / 2;
          const elbowY    = (lm[13].y + lm[14].y) / 2;
          if (elbowY < shoulderY - 0.02 && phase === 'up')   { phase = 'down'; return false; }
          if (elbowY > shoulderY + 0.04 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        case 'calfraise': {
          if (!visible(lm, [23, 24, 27, 28])) return false;
          const ankleY = (lm[27].y + lm[28].y) / 2;
          const hipY   = (lm[23].y + lm[24].y) / 2;
          const rel    = hipY - ankleY;
          if (rel > 0.52 && phase === 'up')   { phase = 'down'; return false; }
          if (rel < 0.46 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
        default: {
          if (!visible(lm, [23, 24])) return false;
          const hipY = (lm[23].y + lm[24].y) / 2;
          if (hipY < 0.40 && phase === 'up')   { phase = 'down'; return false; }
          if (hipY > 0.55 && phase === 'down') { phase = 'up';   return true;  }
          return false;
        }
      }
    } catch {
      return false;
    }
  };
}

// interrupt=true (default): cut off whatever is playing — for start/stop/
// warnings/milestones. interrupt=false: skip silently when something is
// already spoken — for routine AI coaching cues, so a cue arriving mid-speech
// doesn't cancel+restart audio into garbled stutter.
export function speak(text, rate = 1.05, pitch = 1.0, interrupt = true) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    if (!interrupt && (synth.speaking || synth.pending)) return;
    if (synth.speaking) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = rate;
    u.pitch  = pitch;
    u.volume = 1;
    const voices    = synth.getVoices();
    const preferred =
      voices.find(v => /en[-_](US|GB|AU)/i.test(v.lang) && /Natural|Samantha|Google/i.test(v.name)) ||
      voices.find(v => /en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    synth.speak(u);
  } catch {
    /* voice unavailable — stay silent, overlay text still shows */
  }
}

export function useRepCounter({ voiceEnabled }) {
  const [repCount, setRepCount] = useState(0);

  const repCountRef      = useRef(0);
  const lastSpokenRef    = useRef(0);
  const repCounterRef    = useRef(buildRepCounter());

  useEffect(() => { repCountRef.current = repCount; }, [repCount]);

  // Voice milestone announcements — spoken-rep guard lives in a ref (not state)
  // so announcing never triggers a render cascade.
  useEffect(() => {
    if (!voiceEnabled || repCount === 0 || repCount === lastSpokenRef.current) return;
    if (repCount % 10 === 0) {
      speak(`${repCount} reps! Great work, keep going!`, 1.1, 1.05);
    } else if (repCount % 5 === 0) {
      speak(`${repCount}!`);
    }
    lastSpokenRef.current = repCount;
  }, [repCount, voiceEnabled]);

  const countRep = useCallback((landmarks, type) => {
    const didRep = repCounterRef.current(landmarks, type);
    if (didRep) {
      setRepCount((prev) => {
        const next = prev + 1;
        repCountRef.current = next;
        return next;
      });
    }
  }, []);

  const resetReps = useCallback(() => {
    repCounterRef.current = buildRepCounter();
    setRepCount(0);
    lastSpokenRef.current = 0;
    repCountRef.current = 0;
  }, []);

  return { repCount, repCountRef, countRep, resetReps };
}