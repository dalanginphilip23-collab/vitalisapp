import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { BottomNav } from '../../../../components/index.js';
import AppShell from '../../../../components/AppShell.jsx';
import Icon from '../../../../components/Icon.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { WORKOUT_OPTIONS } from '../constants/workout.js';
import { getPickerOptions, resolveWorkout, searchGuideExercises, frameUrl, BRYL_CREDIT, guideFilterOptions, getAllGuideExercises } from '../constants/workoutGuide.js';
import { useRepCounter, speak } from '../hooks/useRepCounter.js';
import { useHoldTimer } from '../hooks/useHoldTimer.js';
import { useAICoach } from "../hooks/useAiCoach.js";
import { usePoseEngine }        from '../hooks/usePoseEngine.js';
import { useWorkoutSession }    from '../hooks/useWorkoutSession.js';
import { apiPost } from '../../../../lib/apiClient.js';
import { safeGet, safeSet } from '../../../../lib/storage.js';
import Dropdown from '../../../../components/ui/Dropdown.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

import WebcamFeed from '../components/WebcamFeed.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import DesktopWorkoutSelector from '../components/DesktopWorkoutSelector.jsx';
import MobileWorkoutPills from '../components/MobileWorkoutPills.jsx';
import RightPanel from '../components/RightPanel.jsx';
import RepProgressRing, { FormStatusPill } from '../components/RepProgressRing.jsx';
import { formStatus } from '../components/formStatus.js';
import CorrectionBanner from '../components/CorrectionBanner.jsx';
import SessionBottomBar from '../components/SessionBottomBar.jsx';
import WorkoutSummary from '../components/WorkoutSummary.jsx';
import WorkoutFeedbackSheet from '../components/WorkoutFeedbackSheet.jsx';
// Reused from the Log page: structured manual entry (sets: reps × weight) —
// same /api/workout-logs/manual backend, so manual saves count toward stats.
import AddWorkoutModal from '../../Log/components/AddWorkoutModal.jsx';
// Pick a card -> ask HOW to train it: camera tracker or manual entry.
import ExerciseChoiceModal from '../components/ExerciseChoiceModal.jsx';

// ── Minimum reps required to count a session as complete ─────────────────────
const MIN_REPS_DEFAULT = 5;

// ── Activity types that should NOT launch the camera (use manual complete) ───
const REST_ACTIVITY_TYPES = new Set(['Recovery', 'Mobility', 'Flexibility']);

// ── Early-exit confirmation dialog ───────────────────────────────────────────
// Receives plain values (not refs) so it never reads .current in JSX.
function EarlyExitDialog({ mode, reps, holdSecs, minReps, minHoldSecs, elapsedMins, requiredMins, onConfirm, onCancel }) {
  const progressText = mode === 'hold'
    ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Math.floor(holdSecs)}s held</span>
    : <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{reps} rep{reps !== 1 ? 's' : ''}</span>;
  const needText = requiredMins > 0
    ? ` This day requires at least ${requiredMins} mins to be marked complete.`
    : mode === 'hold'
      ? ` You need at least ${minHoldSecs}s held to complete this day.`
      : ` You need at least ${minReps} reps to complete this day.`;
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Workout incomplete"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel?.(); }}
      tabIndex={-1}
    >
      <div className="w-full max-w-sm my-auto rounded-2xl border shadow-2xl p-6 max-h-[90dvh] overflow-y-auto"
           style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
             style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span className="material-symbols-outlined text-red-400 text-[length:var(--fs-22)]"
                style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
        </div>

        <h3 className="text-base font-black text-center mb-1"
            style={{ color: 'var(--text-primary)' }}>Workout Incomplete</h3>
        <p className="text-xs text-center mb-5 leading-relaxed"
           style={{ color: 'var(--text-muted)' }}>
          You've only done {progressText} in{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{elapsedMins} min{elapsedMins !== 1 ? 's' : ''}</span>.
          {needText}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[48px] rounded-xl font-bold text-sm border transition-all"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-muted)' }}
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 min-h-[48px] rounded-xl font-bold text-sm transition-all"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171',
                     border: '1px solid rgba(239,68,68,0.3)' }}
          >
            End Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Workout chooser: pick a real Bryl exercise first, camera opens after ───
function WorkoutChooser({ query, onQuery, onPick, onBack }) {
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');
  const [type, setType] = useState('');
  const filterOpts = useMemo(() => guideFilterOptions(), []);
  const q = query.trim();
  const hasFilters = Boolean(q || equipment || muscle || type);
  const libraryTotal = useMemo(() => getAllGuideExercises().length, []);
  const list = useMemo(() => {
    if (q || equipment || muscle || type) {
      return searchGuideExercises(q, {
        ...(equipment ? { equipment } : {}),
        ...(muscle ? { primaryMuscle: muscle } : {}),
        ...(type ? { exerciseType: type } : {}),
      }).slice(0, 48);
    }
    return getPickerOptions();
  }, [q, equipment, muscle, type]);
  const clearFilters = () => {
    onQuery('');
    setEquipment('');
    setMuscle('');
    setType('');
  };
  return (
    <main className="p-4 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full">
      <div className="glass-card border border-[var(--border-light)] rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to dashboard"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-18)] text-[var(--text-primary)]">arrow_back</span>
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.25em] text-[var(--accent)]">Workouts</p>
            <h2 className="text-[length:var(--fs-18)] sm:text-[length:var(--fs-20)] font-black tracking-tight leading-tight">Choose your workout</h2>
            <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] mt-0.5 leading-snug">Real Bryl exercises — pick one, then choose camera or manual.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[length:var(--fs-18)] text-[var(--text-muted)] pointer-events-none">search</span>
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Name, equipment, or muscle"
            aria-label="Search exercises"
            className="w-full h-12 min-h-[48px] rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] pl-11 pr-11 text-[length:var(--fs-16)] sm:text-[length:var(--fs-13)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)]" />
          {query && (
            <button
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 mb-2">
          <p className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Filters{hasFilters && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent)]">{[equipment, muscle, type].filter(Boolean).length + (q ? 1 : 0)}</span>}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[length:var(--fs-11)] font-bold text-[var(--accent)] hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Equipment', value: equipment, set: setEquipment, options: filterOpts.equipment, all: 'All' },
            { label: 'Muscle', value: muscle, set: setMuscle, options: filterOpts.muscles, all: 'All' },
            { label: 'Type', value: type, set: setType, options: filterOpts.types, all: 'All' },
          ].map(f => (
            <Dropdown
              key={f.label}
              label={f.label}
              value={f.value}
              onChange={f.set}
              options={f.options}
              allLabel={f.all}
            />
          ))}
        </div>
        <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] mt-3">
          {hasFilters ? (
            <><span className="font-bold text-[var(--text-primary)] tabular-nums">{list.length}</span> of <span className="font-bold text-[var(--text-primary)] tabular-nums">{libraryTotal}</span> exercises found</>
          ) : (
            <><span className="font-bold text-[var(--text-primary)] tabular-nums">{list.length}</span> quick picks · <span className="font-bold text-[var(--accent)] tabular-nums">{libraryTotal}</span> in full library</>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3 items-stretch">
          {list.map((opt) => {
            const slug = opt.slug ?? opt.id;
            const img = frameUrl(slug, 1);
            const label = opt.name ?? opt.label ?? slug;
            const isHold = (opt.mode ?? (opt.exerciseType === 'duration' || opt.exerciseType === 'distance_duration' || opt.isStretch ? 'hold' : 'rep')) === 'hold';
            return (
              <button key={slug} type="button" onClick={() => onPick(opt)}
                className="text-left rounded-2xl border border-[var(--border-light)] bg-[var(--bg-hover)]/50 hover:border-[var(--accent-border)] hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-all duration-300 overflow-hidden h-full">
                <span className="relative block aspect-square" style={{ background: '#1E1E1E' }}>
                  {img
                    ? <img src={img} alt={label} loading="lazy" className="w-full h-full object-contain p-2"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[length:var(--fs-28)] text-white">fitness_center</span>}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[length:var(--fs-9)] font-black uppercase tracking-widest ${isHold ? 'bg-sky-500/90 text-white' : 'bg-[var(--accent)] text-[var(--text-inverse)]'}`}>
                    {isHold ? 'Hold' : 'Reps'}
                  </span>
                </span>
                <span className="block p-2.5">
                  <span className="block text-[length:var(--fs-12)] font-bold truncate">{label}</span>
                  <span className="block text-[length:var(--fs-10)] text-[var(--text-muted)] mt-0.5">{isHold ? 'Hold · timer' : 'Reps · camera count'}</span>
                </span>
              </button>
            );
          })}
        </div>
        {list.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[length:var(--fs-13)] font-bold text-[var(--text-primary)]">No matches</p>
            <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] mt-1">Try another search or clear the filters.</p>
            <button onClick={clearFilters} className="mt-3 h-11 px-5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-[length:var(--fs-12)] font-bold active:scale-95 transition-all">
              Clear filters
            </button>
          </div>
        )}
        <p className="text-[length:var(--fs-10)] mt-4 leading-relaxed text-[var(--text-muted)]">{BRYL_CREDIT}</p>
      </div>
    </main>
  );
}

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

  const [workoutType, setWorkoutType] = useState(() => {
    // Deep links: Bryl slugs ('push-up') or legacy ids ('pushup') both resolve.
    // Otherwise null -> user picks a workout first, camera opens after.
    if (location.state?.exerciseId) {
      if (resolveWorkout(location.state.exerciseId)) return location.state.exerciseId;
      const match = WORKOUT_OPTIONS.find(o => o.id === location.state.exerciseId);
      if (match) return match.id;
    }
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

  // Rep + hold targets (user picks before Start). Manual input allowed.
  const [repTarget, setRepTarget] = useState(5);
  const [repCustom, setRepCustom] = useState('');
  const [holdTarget, setHoldTarget] = useState(45);
  const [holdCustom, setHoldCustom] = useState('');

  const [isRecording,     setIsRecording]     = useState(false);
  const [paused,          setPaused]          = useState(false);
  const [summary,         setSummary]         = useState(null);
  const [feedbackFor,     setFeedbackFor]     = useState(null); // Module 5 — feedback sheet
  const [cameraOn,        setCameraOn]        = useState(() => safeGet('vitalis_cameraOn', 'true') !== 'false');
  const [voiceEnabled,    setVoiceEnabled]    = useState(() => safeGet('vitalis_voiceEnabled', 'true') !== 'false');
  const [logs,            setLogs]            = useState([]);
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
  const [manualOpen,       setManualOpen]       = useState(false);
  // Chosen library exercise awaiting the "camera or manual?" decision.
  const [choiceEx,         setChoiceEx]         = useState(null);
  // Exercise label carried from the choice modal into the manual form.
  const [manualTitle,      setManualTitle]      = useState('');
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
  // double notifications, double navigations).
  const reachedRef = useRef(false);

  const { repCount, repCountRef, countRep, resetReps }           = useRepCounter({ voiceEnabled });
  const { holdSecs, holdRef, updateHold, resetHold, setHoldTarget: setHoldGoal } = useHoldTimer({ voiceEnabled });
  const { aiFeedback, isAnalyzing, setAiFeedback, maybeAnalyze } = useAICoach({ workoutType: resolved?.label ?? workoutType, voiceEnabled });
  const { startSession, pauseSession, resumeSession, endSession, sessionResult } = useWorkoutSession();

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
    const msg = workoutMode === 'hold'
      ? `Session complete! You held ${held} seconds. Great work!`
      : `Session complete! You did ${final} ${final === 1 ? 'rep' : 'reps'}. Great work!`;
    setAiFeedback(msg);
    if (voiceEnabled) speak(msg, 1.0, 1.05);

    setLogs(prev => [...prev, {
      exercise: label,
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
    const lastCue = aiFeedback && !/^(Select Exercise|Starting|Switched|Session complete)/.test(aiFeedback)
      ? aiFeedback
      : 'Nice work — consistency beats intensity. Keep it up.';
    if (!skipSummaryRef.current) {
      setSummary({
      exercise: label,
      achieved: workoutMode === 'hold' ? `${held}s / ${holdTarget}s held` : `${final} / ${repTarget} reps`,
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
  // Module 5: the server row is paused/resumed too, so logged duration
  // excludes pause time (fire-and-forget — never blocks the session UI).
  const handlePauseToggle = useCallback(() => {
    if (!isRecording) return;
    setPaused(prev => {
      const next = !prev;
      if (next) pauseSession();
      else resumeSession();
      const msg = next ? 'Paused — press Resume to continue' : 'Resumed — keep going';
      setAiFeedback(msg);
      if (voiceEnabled) speak(msg, 0.95, 1.0);
      return next;
    });
  }, [isRecording, voiceEnabled, setAiFeedback, pauseSession, resumeSession]);

  // Summary Done: dismiss, then either collect the post-workout self-report
  // (Module 5) or flush any deferred plan navigation. Feedback only for
  // sessions we actually persisted — otherwise it's just skipped.
  const flushPendingNav = useCallback(() => {
    const go = pendingNavRef.current;
    pendingNavRef.current = null;
    if (go) go();
  }, []);

  const handleSummaryDone = useCallback(() => {
    setSummary(null);
    if (sessionResult?.id) {
      setFeedbackFor(sessionResult.id);
      return;
    }
    flushPendingNav();
  }, [sessionResult, flushPendingNav]);

  const handleFeedbackClose = useCallback(() => {
    setFeedbackFor(null);
    flushPendingNav();
  }, [flushPendingNav]);

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
      const msg = fromPlan
        ? `Starting Day ${fromPlan.dayNumber}: ${fromPlan.dayTitle}. ${cue} ${goal}`
        : `Starting ${label}. ${cue} ${goal}`;

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
            setTimeout(() => doStopRef.current?.(), 800);
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
            setTimeout(() => doStopRef.current?.(), 800);
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
    <AppShell
      userId={USER_ID}
      mobileTitle="Camera Workout"
      contentClassName=""
      mainClassName="app-main--flush"
      bottomNav={<BottomNav />}
    >
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

      {/* ── Exercise choice: camera vs manual entry ── */}
      {choiceEx && (
        <ExerciseChoiceModal
          exercise={choiceEx}
          onUseCamera={() => {
            const id = choiceEx.id;
            setChoiceEx(null);
            handleWorkoutChange({ id });
          }}
          onLogManually={() => {
            const label = choiceEx.label;
            setChoiceEx(null);
            setManualOpen(true);
            // Pre-fill the manual modal's session name with the chosen exercise.
            setManualTitle(label);
          }}
          onClose={() => setChoiceEx(null)}
        />
      )}

      {/* ── Manual workout entry (reused Log-page modal) ── */}
      {manualOpen && (
        <AddWorkoutModal
          initialTitle={manualTitle}
          onClose={() => { setManualOpen(false); setManualTitle(''); }}
          onSaved={(log) => {
            // Surface the save in the in-page session history, same shape as camera rows.
            const mins = Number(log?.duration_seconds) > 0
              ? Math.round(Number(log.duration_seconds) / 60)
              : null;
            const detail = log?.rep_count > 0
              ? `${log.rep_count} ${log.rep_count === 1 ? 'rep' : 'reps'}${mins != null ? ` · ${mins}m` : ''}`
              : (mins != null ? `${mins}m` : 'logged');
            setLogs(prev => [...prev, {
              exercise: log?.workout_type ?? 'Manual workout',
              reps: detail,
              time: new Date().toLocaleTimeString(),
            }]);
            setAiFeedback(`Logged manually: ${log?.workout_type ?? 'workout'}. Nice work!`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <div>
        {/* ── Unified app topbar (menu + Vitalis + bell + theme + avatar) ── */}
        <div>
        {fromPlan && (
          <div className="bg-[var(--accent-bg)] border-b border-[var(--accent-border)] px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--accent)] truncate">
                {fromPlan.planTitle}
              </span>
              <span className="text-[length:var(--fs-10)] text-[var(--text-muted)] uppercase tracking-widest truncate">
                · Day {fromPlan.dayNumber}: {fromPlan.dayTitle}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isRecording && (
                <span className="text-[length:var(--fs-10)] font-black tabular-nums text-[var(--accent)]">
                  {formatTime(elapsedSecs)}
                </span>
              )}
              {requiredMins > 0 && (
                <span className="text-[length:var(--fs-10)] text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
                  Goal: {Math.ceil(requiredMins * 0.5)} min
                </span>
              )}
            </div>
          </div>
        )}

        {chosen && (
          <SessionHeader
            workoutLabel={resolved?.label ?? workoutType}
            workoutSub={`${resolved?.muscle ?? 'Full body'} · ${workoutMode === 'hold' ? `${holdTarget}s hold` : `${repTarget} reps`}`}
            isRecording={isRecording}
            paused={paused}
            cameraOn={cameraOn}
            voiceEnabled={voiceEnabled}
            onCameraToggle={handleCameraToggle}
            onVoiceToggle={handleVoiceToggle}
            onBack={handleBack}
            onChangeExercise={() => setPickerOpen(true)}
            onLogManual={() => setManualOpen(true)}
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
            onPick={(opt) => {
              // Every picked exercise asks: camera tracker or manual logging?
              const slug = opt?.slug ?? opt?.id;
              setChoiceEx(slug ? {
                id: slug,
                label: opt?.name ?? opt?.label ?? slug,
                img: frameUrl(slug, 1),
              } : null);
            }}
            onBack={handleBack}
          />
        ) : (
        <>
        {/* Camera feed — upper position, above the rep card */}
        <div className="px-[clamp(16px,3vw,32px)] max-w-7xl 2xl:max-w-[1400px] mx-auto w-full pt-3 sm:pt-4">
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
              tracking={tracking}
              hideRepCount
            />
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
        <div className="px-[clamp(16px,3vw,32px)] max-w-7xl 2xl:max-w-[1400px] mx-auto w-full mt-3 sm:mt-4">
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
                  <span className="text-[length:var(--fs-10)] font-black uppercase tracking-widest text-[var(--text-muted)] truncate">
                    {workoutMode === 'hold' ? `Hold target · ${resolved?.label ?? ''}` : `Rep target · ${resolved?.label ?? ''}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-2.5">
                    <p className="text-[length:var(--fs-9)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Alignment</p>
                    <p className="text-[length:var(--fs-13)] font-bold tabular-nums text-[var(--text-primary)] mt-0.5">
                      {biometrics.alignment > 0 ? `${Math.round(biometrics.alignment)}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-3 py-2.5">
                    <p className="text-[length:var(--fs-9)] font-bold uppercase tracking-widest text-[var(--text-muted)]">Tempo</p>
                    <p className="text-[length:var(--fs-13)] font-bold tabular-nums text-[var(--text-primary)] mt-0.5">
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
            <p className="text-[length:var(--fs-10)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mt-4 mb-2">Set target</p>
            {workoutMode === 'hold' ? (
              <div className="flex items-center gap-2 flex-wrap">
                {[30, 45, 60, 90].map((s) => (
                  <button key={s} onClick={() => setHoldTarget(s)} disabled={isRecording}
                    className={`px-4 py-2.5 min-h-[44px] rounded-xl text-[length:var(--fs-12)] font-bold border transition-all active:scale-95 ${holdTarget === s ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
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
                  className="flex-1 min-w-[110px] h-12 min-h-[48px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-4 text-[length:var(--fs-16)] sm:text-[length:var(--fs-12)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {[5, 10, 15, 20].map((r) => (
                  <button key={r} onClick={() => { setRepTarget(r); setRepCustom(''); }} disabled={isRecording}
                    className={`px-4 py-2.5 min-h-[44px] rounded-xl text-[length:var(--fs-12)] font-bold border transition-all active:scale-95 ${repTarget === r ? 'bg-[var(--accent)] text-[var(--text-inverse)] border-[var(--accent)]' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
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
                  className="flex-1 min-w-[110px] h-12 min-h-[48px] rounded-xl bg-[var(--bg-hover)] border border-[var(--border-light)] px-4 text-[length:var(--fs-16)] sm:text-[length:var(--fs-12)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
            )}
          </div>
        </div>

        <main className="p-4 sm:p-4 md:p-8 md:pt-4 pb-28 md:pb-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col gap-4 sm:gap-6">
            <RightPanel logs={logs} />
          </div>
        </main>
        <div className="sticky bottom-[76px] md:static z-30 px-[clamp(16px,3vw,32px)] max-w-7xl 2xl:max-w-[1400px] mx-auto w-full pb-2 md:pb-0">
          <div className="glass-card border border-[var(--border-light)] rounded-3xl p-3 shadow-lg md:shadow-none md:bg-none md:border-0 md:p-0 md:rounded-none md:shadow-none">
            <SessionBottomBar
              isRecording={isRecording}
              paused={paused}
              cameraOn={cameraOn}
              onPauseToggle={handlePauseToggle}
              onStartStop={handleStartStop}
            />
          </div>
        </div>
        <div className="h-2 md:hidden" />
        <WorkoutSummary summary={summary} onDone={handleSummaryDone} />
        <WorkoutFeedbackSheet logId={feedbackFor} onClose={handleFeedbackClose} />
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
    </AppShell>
  );
};

export default CameraWorkout;