// workoutGuide.js — Bryl Lim catalog adapter + mode router.
// Real data: all 302 exercises from @bryllim/workout-guide manifest.
// Every exercise resolves to exactly one functional mode — never guide-only:
//   REP mode  = weight_reps | bodyweight_reps | assisted_bodyweight
//   HOLD mode = duration | distance_duration | isStretch
import { exercises, getExercise, searchExercises, getAssetUrl } from '@bryllim/workout-guide';

// Bryl slug -> internal rep-counter type (useRepCounter switch cases).
// Unmapped slugs fall through to 'generic' (existing default branch).
const SLUG_TO_COUNTER = {
  'push-up': 'pushup',
  'weighted-push-up': 'pushup',
  'incline-push-up': 'pushup',
  'squat': 'squat',
  'front-squat': 'squat',
  'hack-squat': 'squat',
  'walking-lunge': 'lunge',
  'reverse-lunge': 'lunge',
  'bicep-curl': 'bicep_curl',
  'dumbbell-curl': 'bicep_curl',
  'overhead-press': 'overhead',
  'crunch': 'crunch',
  'decline-sit-up': 'situp',
  'lateral-raise': 'lateral_raise',
  'calf-raise': 'calfraise',
  'seated-calf-raise': 'calfraise',
};

const HOLD_TYPES = new Set(['duration', 'distance_duration']);

export function isHoldExercise(ex) {
  if (!ex) return false;
  return HOLD_TYPES.has(ex.exerciseType) || ex.isStretch === true;
}

export function getWorkoutMode(ex) {
  return isHoldExercise(ex) ? 'hold' : 'rep';
}

export function counterTypeFor(slug) {
  if (!slug) return 'generic';
  if (SLUG_TO_COUNTER[slug]) return SLUG_TO_COUNTER[slug];
  // Legacy internal ids still work (pushup, squat, ...).
  const legacy = ['pushup', 'squat', 'lunge', 'bicep_curl', 'overhead', 'crunch', 'situp', 'lateral_raise', 'calfraise'];
  if (legacy.includes(slug)) return slug;
  return 'generic';
}

export function frameUrl(slug, frame = 1) {
  try {
    return getAssetUrl(slug, /** @type {1 | 2 | 3} */ (frame)) || null;
  } catch {
    return null;
  }
}

// Resolve any id (legacy 'pushup' or Bryl 'push-up') to a working workout object.
export function resolveWorkout(id) {
  if (!id) return null;
  const ex = getExercise(id);
  if (ex) {
    const mode = getWorkoutMode(ex);
    return {
      id: ex.slug,
      slug: ex.slug,
      label: ex.name,
      cue: `${ex.name} — ${ex.primaryMuscle} · ${ex.equipment}. Follow the guide frames and hold your form.`,
      icon: mode === 'hold' ? 'timer' : 'fitness_center',
      mode,
      counterType: counterTypeFor(ex.slug),
      equipment: ex.equipment,
      muscle: ex.primaryMuscle,
      exerciseType: ex.exerciseType,
      frames: [frameUrl(ex.slug, 1), frameUrl(ex.slug, 2), frameUrl(ex.slug, 3)],
      exercise: ex,
    };
  }
  // Legacy fallback (kept for deep links / plan activityTypes).
  const legacyLabels = {
    pushup: 'Push-Ups', squat: 'Squats', plank: 'Plank', lunge: 'Lunges',
    overhead: 'OH Press', dip: 'Dips', burpee: 'Burpees', jumpingjack: 'Jumping Jacks',
    mountainclimb: 'Mountain Climbers', highknee: 'High Knees', glute_bridge: 'Glute Bridge',
    crunch: 'Crunches', situp: 'Sit-Ups', bicep_curl: 'Bicep Curls', tricep_ext: 'Tricep Ext.',
    lateral_raise: 'Lateral Raise', deadlift: 'Deadlift', hip_thrust: 'Hip Thrust',
    sideplank: 'Side Plank', boxjump: 'Box Jumps', pullup: 'Pull-Ups', calfraise: 'Calf Raises',
  };
  const holdLegacy = new Set(['plank', 'sideplank', 'glute_bridge']);
  if (legacyLabels[id]) {
    return {
      id, slug: id, label: legacyLabels[id],
      cue: `Get into position for ${legacyLabels[id]}.`,
      icon: holdLegacy.has(id) ? 'timer' : 'fitness_center',
      mode: holdLegacy.has(id) ? 'hold' : 'rep',
      counterType: counterTypeFor(id),
      equipment: 'Bodyweight', muscle: 'Full Body', exerciseType: null,
      frames: [], exercise: null,
    };
  }
  return null;
}

export function prescriptionForGuide(exOrId) {
  const ex = typeof exOrId === 'string' ? getExercise(exOrId) : exOrId;
  if (ex && isHoldExercise(ex)) {
    return { sets: 3, reps: '45s hold', weight: ex.equipment || 'Bodyweight' };
  }
  if (ex) {
    return { sets: 3, reps: '10 reps', weight: ex.equipment || 'Bodyweight' };
  }
  return { sets: 3, reps: '10 reps', weight: 'Bodyweight' };
}

// Catalog helpers — real Bryl data.
export function getAllGuideExercises() {
  return exercises;
}

export function searchGuideExercises(query = '', filters = {}) {
  try {
    return searchExercises(query, filters);
  } catch {
    return exercises;
  }
}

export function guideFilterOptions() {
  const eq = new Set();
  const mu = new Set();
  const ty = new Set();
  for (const e of exercises) {
    if (e.equipment) eq.add(e.equipment);
    if (e.primaryMuscle) mu.add(e.primaryMuscle);
    if (e.exerciseType) ty.add(e.exerciseType);
  }
  return {
    equipment: [...eq].sort(),
    muscles: [...mu].sort(),
    types: [...ty].sort(),
  };
}

// Curated camera picker: real Bryl data, every entry functional (rep or hold).
// Covers the previous 23-option set; unmapped extras live in the full library.
const PICKER_SLUGS = [
  'push-up', 'squat', 'plank', 'walking-lunge', 'overhead-press', 'dip',
  'burpee', 'jumping-jack', 'mountain-climber', 'high-knees', 'glute-bridge',
  'crunch', 'decline-sit-up', 'bicep-curl', 'lateral-raise', 'deadlift',
  'hip-thrust', 'side-plank', 'pull-up', 'calf-raise', 'wall-sit', 'reverse-lunge',
];

const PICKER_ICONS = {
  'push-up': 'fitness_center', 'squat': 'accessibility_new', 'plank': 'horizontal_rule',
  'walking-lunge': 'directions_walk', 'reverse-lunge': 'directions_walk',
  'overhead-press': 'upload', 'dip': 'unfold_more', 'burpee': 'bolt',
  'jumping-jack': 'sports_gymnastics', 'mountain-climber': 'landscape', 'high-knees': 'directions_run',
  'glute-bridge': 'airline_seat_flat', 'crunch': 'airline_seat_recline_normal',
  'decline-sit-up': 'self_improvement', 'bicep-curl': 'sports_mma',
  'lateral-raise': 'open_with', 'deadlift': 'arrow_downward', 'hip-thrust': 'chair',
  'side-plank': 'rotate_90_degrees_cw', 'pull-up': 'keyboard_arrow_up',
  'calf-raise': 'footprint', 'wall-sit': 'chair',
};

export function getPickerOptions() {
  const opts = [];
  for (const slug of PICKER_SLUGS) {
    const r = resolveWorkout(slug);
    if (!r) continue;
    opts.push({ id: r.id, label: r.name || r.label, icon: PICKER_ICONS[slug] || 'fitness_center', cue: r.cue, mode: r.mode });
  }
  // Legacy extras with no Bryl match stay functional via generic counter.
  opts.push(
    { id: 'tricep_ext', label: 'Tricep Ext.', icon: 'back_hand', cue: 'Stand or sit, arm extended overhead.', mode: 'rep' },
    { id: 'boxjump', label: 'Box Jumps', icon: 'upload_file', cue: 'Stand in front of the box, camera to your side.', mode: 'rep' },
  );
  return opts;
}

export const BRYL_CREDIT = 'Original exercise artwork by Everkinetic, expanded by Bryl Lim, licensed under CC BY-SA 4.0.';
