import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { BottomNav, SidebarAnalytics, Topbar } from '../../../components/index.js';
import Icon from '../../../components/Icon.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { WORKOUT_OPTIONS } from '../constants/workout.js';
import { resolveWorkout, resolveExerciseName } from '../constants/workoutGuide.js';
import { useRepCounter, speak } from '../hooks/useRepCounter.js';
import { useHoldTimer } from '../hooks/useHoldTimer.js';
import { useAICoach } from "../hooks/useAiCoach.js";
import { usePoseEngine }        from '../hooks/usePoseEngine.js';
import { useWorkoutSession }    from '../hooks/useWorkoutSession.js';
import { apiPost } from '../../../lib/apiClient.js';
import { safeGet, safeSet } from '../../../lib/storage.js';
import Dropdown from '../../../components/ui/Dropdown.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

import WebcamFeed from '../components/WebcamFeed.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import DesktopWorkoutSelector from '../components/DesktopWorkoutSelector.jsx';
import MobileWorkoutPills from '../components/MobileWorkoutPills.jsx';
import RightPanel from '../components/RightPanel.jsx';
import RepProgressRing, { FormStatusPill } from '../components/RepProgressRing.jsx';
import { formStatus } from '../components/formStatus.js';
import CorrectionBanner from '../components/CorrectionBanner.jsx';
import WorkoutSummary from '../components/WorkoutSummary.jsx';
import EarlyExitDialog from '../components/EarlyExitDialog.jsx';
import WorkoutChooser from '../components/WorkoutChooser.jsx';

// ── Minimum reps required to count a session as complete ─────────────────────
const MIN_REPS_DEFAULT = 5;

// ── Activity types that should NOT launch the camera (use manual complete) ───
const REST_ACTIVITY_TYPES = new Set(['Recovery', 'Mobility', 'Flexibility']);

// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════
const CameraWorkout = () => {
  const { user } = useAuth();
  const USER_ID = user?.id ?? user?.userId ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const fromPlan = location.state?.fromPlan ?? null;

  const requiredMins = fromPlan?.durationMins ?? 0;
  const minReps      = MIN_REPS_DEFAULT;
  const minHoldSecs  = 30;

  // Plan-day queue: the day's exercise names resolved to countable workouts.
  // Unresolvable rows (e.g. stretches) are skipped — the tracker still lists them.
  const planQueue = useMemo(() => {
    const list = fromPlan?.exercises;
    if (!Array.isArray(list) || list.length === 0) return [];
    return list.map((ex) => {
      const id = resolveExerciseName(ex?.name);
      if (!id) return null;
      const r = resolveWorkout(id);
      if (!r) return null;
      const reps = parseInt(String(ex?.reps ?? ''), 10);
      const holdSecs = Number(ex?.durationSeconds) || null;
      return {
        id,
        label: r.label,
        mode: r.mode,
        sets: ex?.sets ?? null,
        repTarget: r.mode === 'hold' ? null : (Number.isFinite(reps) && reps > 0 ? reps : 10),
        holdTarget: r.mode === 'hold' ? (holdSecs && holdSecs > 0 ? Math.round(holdSecs) : 45) : null,
      };
    }).filter(Boolean);
  }, [fromPlan]);

  const [workoutType, setWorkoutType] = useState(() => {
    // Deep links: guide slugs ('push-up') or legacy ids ('pushup') both resolve.
    // Plan days auto-select the first queued workout. Otherwise null ->
    // user picks a workout first, camera opens after.
    if (location.state?.exerciseId) {
      if (resolveWorkout(location.state.exerciseId)) return location.state.exerciseId;
      const match = WORKOUT_OPTIONS.find(o => o.id === location.state.exerciseId);
      if (match) return match.id;
    }
    if (planQueue.length > 0) return planQueue[0].id;
    if (fromPlan?.activityType) {
      const bySlug = resolveWorkout(fromPlan.activityType.toLowerCase().replace(/\s+/g, '-'));
      if (bySlug) return bySlug.id;
      const match = WORKOUT_OPTIONS.find(
        o =>
          o.label.toLowerCase() === fromPlan.activityType.toLowerCase() ||
          o.id === fromPlan.activityType.toLowerCase()
      );
      if (match) return match.id;
    }
    return null;
  });

  const chosen = workoutType !== null;
  const resolved = (workoutType ? resolveWorkout(workoutType) : null) ?? (workoutType ? null : null);
  const workoutMode = resolved?.mode ?? 'rep';
  const counterType = resolved?.counterType ?? 'generic';

  // Rep + hold targets (user picks before Start, or seeded from the plan queue).
  // Manual input always allowed — editing overrides the current queue item.
  const [repTarget, setRepTarget] = useState(() => planQueue[0]?.repTarget ?? 5);
  const [repCustom, setRepCustom] = useState('');
  const [holdTarget, setHoldTarget] = useState(() => planQueue[0]?.holdTarget ?? 45);
  const [holdCustom, setHoldCustom] = useState('');

  // Queue position. Manual exercise picks exit queue mode (user takes over).
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueActive, setQueueActive] = useState(planQueue.length > 0);

  const [isRecording,     setIsRecording]     = useState(false);
  const [paused,          setPaused]          = useState(false);
  const [summary,         setSummary]         = useState(null);
  const [cameraOn,        setCameraOn]        = useState(() => safeGet('vitalis_cameraOn', 'true') !== 'false');
  const [voiceEnabled,    setVoiceEnabled]    = useState(() => safeGet('vitalis_voiceEnabled', 'true') !== 'false');
  const [logs,            setLogs]            = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [biometrics,      setBiometrics]      = useState({ alignment: 0, velocity: 0, symmetry: 0 });
  // Skeleton lock: true only while shoulders/hips are confidently visible.
  // Flips state on transitions only (pose fires ~10/sec) to avoid re-renders.
  const [tracking, setTracking] = useState(false);
  const trackingRef = useRef(false);

  // Session timer
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const sessionStartRef               = useRef(null);
  const timerRef                      = useRef(null);

  // FIX: snapshot of repCount at the moment the early-exit dialog is opened,
  // so JSX receives a plain number instead of reading repCountRef.current during render.
  const [earlyExitReps,    setEarlyExitReps]    = useState(0);
  const [showEarlyExit,    setShowEarlyExit]    = useState(false);
  const [pickerOpen,       setPickerOpen]       = useState(false);
  const [chooserQuery, setChooserQuery] = useState('');

  const webcamRef = useRef(null);
  const doStopRef = useRef(null);
  // Back-navigation stops the session without the summary sheet (the page
  // is leaving anyway) — only explicit stops show it.
  const skipSummaryRef = useRef(false);
  // Latest pose landmarks for the skeleton overlay (ref: no re-renders).
  const landmarksRef = useRef(null);
  // Rolling form samples while recording (capped) — the complete summary
  // averages these client-side. Cleared on every Start.
  const samplesRef = useRef([]);
  // Mirrors for callbacks that must read fresh values through refs.
  const elapsedSecsRef = useRef(0);
  const pendingNavRef = useRef(null);
  // Voice-warning cooldowns: onPoseResult fires ~10/sec, so unguarded speak()
  // calls cancel+restart audio every frame into garbled stutter. Max one
  // warning voice per 4s; overlay text still updates every frame.
  const lastWarnRef = useRef(0);
  const lastHoldCueRef = useRef(0);
  const WARN_COOLDOWN_MS = 4000;
  // Target-reached fires the stop sequence once — without this the rep/hold
  // branch re-triggers every frame until the 800ms stop lands (double logs,
  // double navigations).
  const reachedRef = useRef(false);
  // Queue mirrors (advance runs from a pose-callback timeout — refs stay fresh).
  const queueIndexRef  = useRef(0);
  const queueActiveRef = useRef(planQueue.length > 0);
  const planQueueRef   = useRef(planQueue);
  const completedRef   = useRef(0);
  const advanceRef     = useRef(null);

  useEffect(() => { planQueueRef.current = planQueue; }, [planQueue]);

  const { repCount, repCountRef, countRep, resetReps }           = useRepCounter({ voiceEnabled });
  const { holdSecs, holdRef, updateHold, resetHold, setHoldTarget: setHoldGoal } = useHoldTimer({ voiceEnabled });
  const { aiFeedback, isAnalyzing, setAiFeedback, maybeAnalyze } = useAICoach({ workoutType: resolved?.label ?? workoutType, voiceEnabled });
  const { startSession, endSession }                             = useWorkoutSession();

  useEffect(() => { setHoldGoal(holdTarget); }, [holdTarget, setHoldGoal]);

  // Warm up speech voices on mount: getVoices() is async and returns [] on
  // first call in Chrome — without this the opening "Starting…" cue speaks in
  // a fallback/robotic voice (or clips) instead of the preferred English one.
  useEffect(() => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return undefined;
      synth.getVoices();
      const warm = () => { try { synth.getVoices(); } catch { /* noop */ } };
      synth.addEventListener?.('voiceschanged', warm);
      return () => { try { synth.removeEventListener?.('voiceschanged', warm); } catch { /* noop */ } };
    } catch { return undefined; }
  }, []);

  // ── Timer: tick every second while recording and not paused ──────
  useEffect(() => {
    if (isRecording && !paused) {
      // Preserve elapsed time across pause/resume cycles
      sessionStartRef.current = Date.now() - elapsedSecs * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  // elapsedSecs intentionally excluded: we only want to (re)start the interval
  // when isRecording/paused flips, not on every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, paused]);

  useEffect(() => { elapsedSecsRef.current = elapsedSecs; }, [elapsedSecs]);

  const elapsedMins = Math.floor(elapsedSecs / 60);

  const isSessionComplete = useCallback(() => {
    if (!fromPlan) return true;
    if (workoutMode === 'hold') {
      if (requiredMins > 0) {
        return elapsedMins >= Math.ceil(requiredMins * 0.5) && Math.floor(holdRef.current) >= minHoldSecs;
      }
      return Math.floor(holdRef.current) >= minHoldSecs;
    }
    const reps = repCountRef.current;
    if (requiredMins > 0) {
      return elapsedMins >= Math.ceil(requiredMins * 0.5) && reps >= minReps;
    }
    return reps >= minReps;
  }, [fromPlan, requiredMins, elapsedMins, minReps, minHoldSecs, workoutMode, repCountRef, holdRef]);

  // ── The actual stop logic (called after confirmation if needed) ─
  const doStop = useCallback(() => {
    endSession('completed', repCountRef.current).catch(err => {
      if (import.meta.env.DEV) console.warn('[endSession] background error:', err);
    });

    const final = repCountRef.current;
    const held = Math.floor(holdRef.current);
    const label = resolved?.label ?? workoutType;
    // Plan-day queue: the summary covers the whole day, not just the last item.
    const queue = planQueueRef.current;
    const inQueue = queueActiveRef.current && queue.length > 0;
    // The current item only counts when it has any reps/hold behind it —
    // ending instantly on exercise 1 must read 0 done, not 1.
    const currentCounts = (workoutMode === 'hold' ? held : final) > 0;
    const queueDone = inQueue ? completedRef.current + (currentCounts ? 1 : 0) : 0;
    const msg = inQueue
      ? (queueDone >= queue.length
        ? `Day ${fromPlan.dayNumber} complete! All ${queue.length} exercises done. Great work!`
        : `Day ${fromPlan.dayNumber} stopped — ${queueDone} of ${queue.length} exercises done.`)
      : workoutMode === 'hold'
        ? `Session complete! You held ${held} seconds. Great work!`
        : `Session complete! You did ${final} ${final === 1 ? 'rep' : 'reps'}. Great work!`;
    setAiFeedback(msg);
    if (voiceEnabled) speak(msg, 1.0, 1.05);

    setLogs(prev => [...prev, {
      exercise: inQueue ? `Day ${fromPlan.dayNumber} — ${label}` : label,
      reps:     workoutMode === 'hold' ? `${held}s` : final,
      time:     new Date().toLocaleTimeString(),
    }]);

    const resolvedUserId = user?.id ?? user?.userId ?? null;

    // ── Complete summary (reference screen 3). Score is a documented
    // client-side heuristic: average of sampled postural symmetry for
    // alignment/balance + rep-cadence tempo. No backend change.
    const samples = samplesRef.current;
    const avgSym = samples.length
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : 0;
    const elapsed = elapsedSecsRef.current;
    let tempoState = '—';
    let tempoNum = null;
    if (workoutMode === 'hold') {
      const completedHold = held >= holdTarget;
      tempoState = completedHold ? 'Good' : 'Needs work';
      tempoNum = completedHold ? 90 : 50;
    } else if (final > 0 && elapsed > 0) {
      const secsPerRep = elapsed / final;
      const goodTempo = secsPerRep >= 1 && secsPerRep <= 8;
      tempoState = goodTempo ? 'Good' : 'Needs work';
      tempoNum = goodTempo ? 90 : 50;
    }
    const alignGood = avgSym >= 70;
    const scoreParts = [avgSym, avgSym];
    if (tempoNum !== null) scoreParts.push(tempoNum);
    const score = Math.max(0, Math.min(100, Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length)));
    const lastCue = aiFeedback && !/^(Select Exercise|Starting|Switched|Session complete|Exercise \d|Skipped)/.test(aiFeedback)
      ? aiFeedback
      : 'Nice work — consistency beats intensity. Keep it up.';
    if (!skipSummaryRef.current) {
      setSummary({
      exercise: inQueue ? `Day ${fromPlan.dayNumber}: ${fromPlan.dayTitle}` : label,
      achieved: inQueue
        ? `${queueDone} / ${queue.length} exercises`
        : workoutMode === 'hold' ? `${held}s / ${holdTarget}s held` : `${final} / ${repTarget} reps`,
      score,
      rows: [
        { label: 'Alignment', icon: 'accessibility_new', good: alignGood, state: avgSym > 0 ? (alignGood ? 'Good' : 'Needs work') : '—' },
        { label: 'Balance', icon: 'balance', good: alignGood, state: avgSym > 0 ? (alignGood ? 'Good' : 'Needs work') : '—' },
        { label: 'Tempo', icon: 'timer', good: tempoState === 'Good', state: tempoState },
      ],
      coach: lastCue,
      });
    }

    if (fromPlan) {
      // Deferred until Done — the summary shows first.
      pendingNavRef.current = () => navigate('/dashboard/plans', {
        state: { openTracker: fromPlan.planId },
      });
    }

    if (fromPlan && resolvedUserId && isSessionComplete()) {
      apiPost('/api/plans/progress/complete', {
        planId:    fromPlan.planId,
        dayNumber: fromPlan.dayNumber,
      })
        .catch(err => { if (import.meta.env.DEV) console.error('[fromPlan] day complete failed:', err); });
    }

    // Notify only meaningful sessions — never "Finished with 0 reps."
    const meaningful = workoutMode === 'hold' ? held > 0 : final > 0;
    if (resolvedUserId && meaningful) {
      apiPost('/api/notifications', {
        user_id:  resolvedUserId,
        message:  workoutMode === 'hold'
          ? `Workout Complete — ${label}: held ${held}s`
          : `Workout Complete — ${label}: ${final} ${final === 1 ? 'rep' : 'reps'}`,
        type:     'success',
        category: 'TRAINING',
      }).catch(err => { if (import.meta.env.DEV) console.error('Notification failed:', err); });
    }

    setElapsedSecs(0);
    setIsRecording(false);
    setPaused(false);
  }, [endSession, repCountRef, holdRef, workoutType, workoutMode, resolved, voiceEnabled, user, fromPlan, isSessionComplete, navigate, setAiFeedback, aiFeedback, repTarget, holdTarget]);

  // Pause / resume: freezes timer + rep counting; video and skeleton
  // preview keep running. Voice cues are gated on paused upstream.
  const handlePauseToggle = useCallback(() => {
    if (!isRecording) return;
    setPaused(prev => {
      const next = !prev;
      const msg = next ? 'Paused — press Resume to continue' : 'Resumed — keep going';
      setAiFeedback(msg);
      if (voiceEnabled) speak(msg, 0.95, 1.0);
      return next;
    });
  }, [isRecording, voiceEnabled, setAiFeedback]);

  // ── Plan-day queue: swap the session to a queue item (targets + counters
  // reset, recording + timer keep running so the day stays one session) ──
  const applyQueueItem = useCallback((item) => {
    if (!item) return;
    setWorkoutType(item.id);
    setRepTarget(item.repTarget ?? 5);
    setRepCustom('');
    setHoldTarget(item.holdTarget ?? 45);
    setHoldCustom('');
    setHoldGoal(item.holdTarget ?? 45);
    resetReps();
    resetHold();
    reachedRef.current = false;
  }, [resetReps, resetHold, setHoldGoal]);

  // Advance after a target is hit (or skipped): log the finished item, move
  // to the next, or finish the day when the queue is exhausted.
  const advanceToNext = useCallback((skipped = false) => {
    const queue = planQueueRef.current;
    const idx = queueIndexRef.current;
    const current = queue[idx];
    if (!current) { doStopRef.current?.(); return; }
    if (!skipped) {
      const done = repCountRef.current;
      const held = Math.floor(holdRef.current);
      setLogs(prev => [...prev, {
        exercise: current.label,
        reps:     current.mode === 'hold' ? `${held}s` : done,
        time:     new Date().toLocaleTimeString(),
      }]);
      completedRef.current += 1;
    }
    const next = queue[idx + 1];
    if (!next) { doStopRef.current?.(); return; }
    queueIndexRef.current = idx + 1;
    setQueueIndex(idx + 1);
    applyQueueItem(next);
    const target = next.mode === 'hold' ? `Hold for ${next.holdTarget} seconds` : `Target ${next.repTarget} reps`;
    const sets = next.sets ? ` (${next.sets} sets)` : '';
    const msg = skipped
      ? `Skipped. Next up ${idx + 2} of ${queue.length}: ${next.label}. ${target}${sets}.`
      : `Exercise ${idx + 2} of ${queue.length}: ${next.label}. ${target}${sets}.`;
    setAiFeedback(msg);
    if (voiceEnabled) speak(msg, 0.95, 1.0);
  }, [applyQueueItem, voiceEnabled, setAiFeedback, repCountRef, holdRef]);

  useEffect(() => { advanceRef.current = advanceToNext; }, [advanceToNext]);

  // Banner Skip: jump past the current queue item (not counted as done).
  const handleQueueSkip = useCallback(() => {
    if (!queueActiveRef.current) return;
    if (queueIndexRef.current >= planQueueRef.current.length - 1) return;
    // Freeze counting until the next item is applied (it resets this flag).
    reachedRef.current = true;
    advanceRef.current?.(true);
  }, []);

  // Summary Done: dismiss, then flush any deferred plan navigation.
  const handleSummaryDone = useCallback(() => {
    setSummary(null);
    const go = pendingNavRef.current;
    pendingNavRef.current = null;
    if (go) go();
  }, []);

  useEffect(() => { doStopRef.current = doStop; }, [doStop]);

  const handleStartStop = async () => {
    if (!chosen) return;
    if (!isRecording) {
      // ── START ──────────────────────────────────────────────────
      startSession(workoutType).catch(err => {
        if (import.meta.env.DEV) console.warn('[startSession] background error:', err);
      });
      resetReps();
      resetHold();
      samplesRef.current = [];
      pendingNavRef.current = null;
      skipSummaryRef.current = false;
      setSummary(null);
      setPaused(false);
      reachedRef.current = false;
      setHoldGoal(holdTarget);
      setElapsedSecs(0);

      const label = resolved?.label ?? workoutType;
      const cue = resolved?.cue ?? '';
      const goal = workoutMode === 'hold' ? `Hold for ${holdTarget} seconds.` : `Target ${repTarget} reps.`;
      // Fresh Start always restarts the plan queue from exercise 1.
      let msg;
      if (fromPlan && queueActiveRef.current && planQueueRef.current.length > 0) {
        queueIndexRef.current = 0;
        setQueueIndex(0);
        completedRef.current = 0;
        const first = planQueueRef.current[0];
        applyQueueItem(first);
        const target = first.mode === 'hold' ? `Hold for ${first.holdTarget} seconds.` : `Target ${first.repTarget} reps.`;
        const sets = first.sets ? ` (${first.sets} sets)` : '';
        msg = planQueueRef.current.length > 1
          ? `Starting Day ${fromPlan.dayNumber}: ${fromPlan.dayTitle}. Exercise 1 of ${planQueueRef.current.length}: ${first.label}. ${target}${sets}`
          : `Starting Day ${fromPlan.dayNumber}: ${fromPlan.dayTitle}. ${first.label}. ${target}${sets}`;
      } else {
        msg = fromPlan
          ? `Starting Day ${fromPlan.dayNumber}: ${fromPlan.dayTitle}. ${cue} ${goal}`
          : `Starting ${label}. ${cue} ${goal}`;
      }

      setAiFeedback(msg);
      if (voiceEnabled) speak(msg, 0.95, 1.0);
      setIsRecording(true);

    } else {
      // ── STOP — check if session qualifies ──────────────────────
      if (fromPlan && !isSessionComplete()) {
        // FIX: snapshot the current rep count into state NOW (event handler,
        // not during render) so the dialog can display it as a plain number.
        setEarlyExitReps(repCountRef.current);
        setShowEarlyExit(true);
        return;
      }
      doStop();
    }
  };

  const handleEarlyExitConfirm = () => {
    setShowEarlyExit(false);
    doStop();
  };
  const handleEarlyExitCancel = () => {
    setShowEarlyExit(false);
  };

  // Back navigation: end an in-progress session first so reps/hold progress
  // is logged instead of silently discarded, then leave.
  const handleBack = useCallback(() => {
    if (isRecording) {
      try { skipSummaryRef.current = true; doStopRef.current?.(); } catch { /* noop */ }
    }
    if (fromPlan) {
      navigate('/dashboard/plans', { state: { openTracker: fromPlan.planId } });
    } else {
      navigate('/dashboard');
    }
  }, [isRecording, fromPlan, navigate]);

  const { poseReady, loadError } = usePoseEngine({
    cameraOn,
    webcamRef,
    workoutType,
    onPoseResult: (landmarks, type, noDetectCount) => {
      landmarksRef.current = landmarks;
      const setTracked = (t) => {
        if (t !== trackingRef.current) { trackingRef.current = t; setTracking(t); }
      };
      if (!landmarks) {
        setTracked(false);
        if (isRecording && !paused) {
          if (noDetectCount === 3) {
            const msg = 'Camera blocked — step back so your full body is visible';
            setAiFeedback(msg);
            if (voiceEnabled) speak(msg, 0.95, 1.0);
          }
          maybeAnalyze(null);
        }
        setBiometrics({ alignment: 0, velocity: 0, symmetry: 0 });
        return;
      }

      const upperBody   = ['pushup', 'bicep_curl', 'overhead', 'lateral_raise'];
      const checkPoints = upperBody.includes(type) ? [11, 12, 13, 14] : [23, 24, 25, 26];
      const isVisible   = checkPoints.every(i => landmarks[i] && landmarks[i].visibility > 0.4);
      setTracked(isVisible);

      if (!isVisible && isRecording && !paused) {
        const msg = 'Move back — position your full body in the camera view';
        setAiFeedback(msg);
        // Throttled: this branch runs ~10/sec — unguarded it restarts the
        // utterance every frame (stutter). Overlay text still updates live.
        if (voiceEnabled && Date.now() - lastWarnRef.current > WARN_COOLDOWN_MS) {
          lastWarnRef.current = Date.now();
          speak(msg, 0.95, 1.0);
        }
        setBiometrics(prev => ({ ...prev, alignment: 30 }));
        return;
      }

      if (isRecording && isVisible && !paused) {
        if (workoutMode === 'hold') {
          const { holding } = updateHold(landmarks, true);
          if (!holding && voiceEnabled && Date.now() - lastHoldCueRef.current > WARN_COOLDOWN_MS) {
            lastHoldCueRef.current = Date.now();
            setAiFeedback('Hold steady — keep your position');
            speak('Hold steady — keep your position', 0.95, 1.0);
          }
          maybeAnalyze(landmarks);
          if (Math.floor(holdRef.current) >= holdTarget && !reachedRef.current) {
            reachedRef.current = true;
            const msg = `Target reached! ${holdTarget} seconds held.`;
            setAiFeedback(msg);
            if (voiceEnabled) speak(msg, 1.0, 1.05);
            setTimeout(() => {
              if (queueActiveRef.current && queueIndexRef.current < planQueueRef.current.length - 1) advanceRef.current?.();
              else doStopRef.current?.();
            }, 800);
          }
        } else {
          const before = repCountRef.current;
          countRep(landmarks, counterType);
          maybeAnalyze(landmarks);
          if (repCountRef.current >= repTarget && before < repTarget && !reachedRef.current) {
            reachedRef.current = true;
            const msg = `Target reached! ${repTarget} reps.`;
            setAiFeedback(msg);
            if (voiceEnabled) speak(msg, 1.0, 1.05);
            setTimeout(() => {
              if (queueActiveRef.current && queueIndexRef.current < planQueueRef.current.length - 1) advanceRef.current?.();
              else doStopRef.current?.();
            }, 800);
          }
        }
      }

      const lShoulder = landmarks[11];
      const rShoulder = landmarks[12];
      const symScore  = Math.max(0, 100 - Math.abs(lShoulder.y - rShoulder.y) * 500);
      // Honest biometrics: symmetry is computed from real shoulder landmarks.
      // Alignment mirrors the same real postural signal (not random); rep speed
      // is not instrumented yet so velocity stays 0 until wired. Card header
      // carries a Demo badge (see BioMetricsCard) — no fake precision.
      setBiometrics({
        alignment: isVisible ? Math.round(symScore) : 0,
        velocity:  0,
        symmetry:  Math.floor(symScore),
      });
      // Rolling form samples for the complete summary (capped, ref only).
      if (isRecording && !paused && isVisible) {
        samplesRef.current.push(Math.round(symScore));
        if (samplesRef.current.length > 600) samplesRef.current.shift();
      }
    },
  });

  const handleCameraToggle = () => {
    const next = !cameraOn;
    setCameraOn(next);
    safeSet('vitalis_cameraOn', String(next));
    if (!next) {
      // Drop the last pose so a stale skeleton never freezes on screen.
      landmarksRef.current = null;
      if (isRecording) setIsRecording(false);
    }
    if (voiceEnabled) speak(next ? 'Camera on.' : 'Camera off.');
  };

  const handleVoiceToggle = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    safeSet('vitalis_voiceEnabled', String(next));
    speak(next ? 'Voice on.' : 'Voice off.');
  };

  const handleWorkoutChange = (opt) => {
    const id = opt?.id ?? opt;
    if (!id) return;
    // Manual pick takes over — the plan queue stops auto-advancing.
    queueActiveRef.current = false;
    setQueueActive(false);
    // State first so selection always sticks, even if feedback fails.
    setWorkoutType(id);
    try {
      resetReps();
      resetHold();
      const r = resolveWorkout(id);
      setAiFeedback(`Switched to ${r?.label ?? opt?.label ?? id}. ${r?.cue ?? opt?.cue ?? ''}`);
      if (isRecording) setIsRecording(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[workout pick]', err);
    }
  };

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-row h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden relative">
      <div className="glass-content flex flex-1 min-w-0 min-h-0">
      {showEarlyExit && (
        <EarlyExitDialog
          mode={workoutMode}
          reps={earlyExitReps}
          holdSecs={holdRef.current}
          minReps={minReps}
          minHoldSecs={minHoldSecs}
          elapsedMins={elapsedMins}
          requiredMins={requiredMins > 0 ? Math.ceil(requiredMins * 0.5) : 0}
          onConfirm={handleEarlyExitConfirm}
          onCancel={handleEarlyExitCancel}
        />
      )}

      <div className="hidden md:block">
        <SidebarAnalytics onExpandChange={setSidebarExpanded} />
      </div>

      <div
        className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden transition-all duration-300"
      >
        {/* ── Unified app topbar (menu + Vitalis + bell + theme + avatar) ── */}
        <Topbar sidebarExpanded={sidebarExpanded} userId={USER_ID} />
        <div className="pt-14 md:pt-16">
        {fromPlan && (
          <div className="bg-[var(--accent-bg)] border-b border-[var(--accent-border)] px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] truncate">
                {fromPlan.planTitle}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest truncate">
                · Day {fromPlan.dayNumber}: {fromPlan.dayTitle}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {queueActive && planQueue.length > 1 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] whitespace-nowrap">
                  Exercise {Math.min(queueIndex + 1, planQueue.length)}/{planQueue.length}
                </span>
              )}
              {queueActive && isRecording && queueIndex < planQueue.length - 1 && (
                <button
                  onClick={handleQueueSkip}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 min-h-[32px] rounded-full border border-[var(--accent-border)] text-[var(--accent)] active:scale-95 transition-transform"
                >
                  Skip
                </button>
              )}
              {isRecording && (
                <span className="text-[10px] font-black tabular-nums text-[var(--accent)]">
                  {formatTime(elapsedSecs)}
                </span>
              )}
              {requiredMins > 0 && (
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
                  Goal: {Math.ceil(requiredMins * 0.5)} min
                </span>
              )}
            </div>
          </div>
        )}

        {chosen && (
          <SessionHeader
            workoutLabel={resolved?.label ?? workoutType}
            workoutSub={`${queueActive && planQueue.length > 1 ? `Exercise ${Math.min(queueIndex + 1, planQueue.length)}/${planQueue.length} · ` : ''}${resolved?.muscle ?? 'Full body'} · ${workoutMode === 'hold' ? `${holdTarget}s hold` : `${repTarget} reps`}`}
            isRecording={isRecording}
            paused={paused}
            cameraOn={cameraOn}
            voiceEnabled={voiceEnabled}
            onCameraToggle={handleCameraToggle}
            onVoiceToggle={handleVoiceToggle}
            onBack={handleBack}
            onChangeExercise={() => setPickerOpen(true)}
          />
        )}

        {chosen && (
          <>
            <MobileWorkoutPills
              workoutType={workoutType ?? undefined}
              onSelect={handleWorkoutChange}
              hideTrigger
              sheetOpen={pickerOpen}
              onSheetClose={() => setPickerOpen(false)}
            />
            <DesktopWorkoutSelector workoutType={workoutType ?? undefined} onSelect={handleWorkoutChange} />
          </>
        )}

        {!chosen ? (
          <WorkoutChooser
            query={chooserQuery}
            onQuery={setChooserQuery}
            onPick={(id) => { handleWorkoutChange({ id }); }}
            onBack={handleBack}
          />
        ) : (
        <>
        {/* Camera feed — upper position, above the rep card */}
        <div className="px-4 sm:px-4 md:px-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full pt-3 sm:pt-4">
          <div className="relative">
            <WebcamFeed
              webcamRef={webcamRef}
              cameraOn={cameraOn}
              isRecording={isRecording}
              poseReady={poseReady}
              loadError={loadError}
              aiFeedback={aiFeedback}
              isAnalyzing={isAnalyzing}
              repCount={workoutMode === 'hold' ? Math.floor(holdSecs) : repCount}
              onCameraToggle={handleCameraToggle}
              landmarksRef={landmarksRef}
              elapsedLabel={formatTime(elapsedSecs)}
              onStartStop={handleStartStop}
              onPauseToggle={handlePauseToggle}
              paused={paused}
              tracking={tracking}
              hideRepCount
            />
            {paused && isRecording && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#101410]/90 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest">
                Paused
              </div>
            )}
            {isRecording && !paused && aiFeedback && aiFeedback !== 'Select Exercise & Start' && (
              <CorrectionBanner
                text={aiFeedback}
                warn={formStatus(biometrics.alignment, biometrics.symmetry) === 'adjust'}
                onOpen={() => { if (voiceEnabled) speak(aiFeedback, 0.95, 1.0); }}
              />
            )}
          </div>
        </div>
        {/* Rep status card — ring + form + target in one place */}
        <div className="px-4 sm:px-4 md:px-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full mt-3 sm:mt-4">
          <div className="glass-card border border-[var(--border-light)] rounded-3xl p-4 sm:p-5">
            <div className="flex flex-col min-[440px]:flex-row min-[440px]:items-center gap-4 sm:gap-5">
              <div className="flex justify-center min-[440px]:justify-start shrink-0">
                <RepProgressRing
                  value={workoutMode === 'hold' ? Math.floor(holdSecs) : repCount}
                  target={workoutMode === 'hold' ? holdTarget : repTarget}
                  label={workoutMode === 'hold' ? 'SECS' : 'REPS'}
                  size={112}
                />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] truncate">
                    {workoutMode === 'hold' ? `Hold target · ${resolved?.label ?? ''}` : `Rep target · ${resolved?.label ?? ''}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Alignment</p>
                    <p className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {biometrics.alignment > 0 ? `${Math.round(biometrics.alignment)}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Tempo</p>
                    <p className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {workoutMode === 'hold'
                        ? formatTime(elapsedSecs)
                        : (repCount > 0 && elapsedSecs > 0 ? `${(elapsedSecs / repCount).toFixed(1)}s/rep` : '—')}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <FormStatusPill alignment={biometrics.alignment} symmetry={biometrics.symmetry} />
                </div>
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mt-4 mb-2">Set target</p>
            {workoutMode === 'hold' ? (
              <div className="flex items-center gap-2 flex-wrap">
                {[30, 45, 60, 90].map((s) => (
                  <button key={s} onClick={() => setHoldTarget(s)} disabled={isRecording}
                    className={`px-4 py-2.5 min-h-[44px] rounded-xl text-[12px] font-bold border transition-all active:scale-95 ${holdTarget === s ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                    {s}s
                  </button>
                ))}
                <input type="number" min={5} max={600} placeholder="Custom (s)" value={holdCustom}
                  disabled={isRecording}
                  onChange={(e) => {
                    setHoldCustom(e.target.value);
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 5 && v <= 600) setHoldTarget(Math.round(v));
                  }}
                  className="flex-1 min-w-[110px] h-12 min-h-[48px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-4 text-[16px] sm:text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {[5, 10, 15, 20].map((r) => (
                  <button key={r} onClick={() => { setRepTarget(r); setRepCustom(''); }} disabled={isRecording}
                    className={`px-4 py-2.5 min-h-[44px] rounded-xl text-[12px] font-bold border transition-all active:scale-95 ${repTarget === r ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                    {r}
                  </button>
                ))}
                <input type="number" min={1} max={500} placeholder="Custom reps" value={repCustom}
                  disabled={isRecording}
                  onChange={(e) => {
                    setRepCustom(e.target.value);
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 1 && v <= 500) setRepTarget(Math.round(v));
                  }}
                  className="flex-1 min-w-[110px] h-12 min-h-[48px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-4 text-[16px] sm:text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
            )}
          </div>
        </div>

        {/* Controls now live inside the camera feed (in-feed bar) so the
            fixed BottomNav can never cover them — no sticky bar needed. */}
        <main className="p-4 sm:p-4 md:p-8 md:pt-4 pb-28 md:pb-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col gap-4 sm:gap-6">
            <RightPanel logs={logs} />
          </div>
        </main>
        <WorkoutSummary summary={summary} onDone={handleSummaryDone} />
        </>
        )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%   { top: 0%;   opacity: 0; }
          50%  {             opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      </div>
      {/* Fixed outside the scroll column so it can never be trapped or covered */}
      <BottomNav />
    </div>
  );
};

export default CameraWorkout;