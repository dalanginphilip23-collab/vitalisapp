import { GOAL_TYPES } from '../../Onboarding/constants/goals.js';
import {
  getAllGuideExercises,
  isHoldExercise,
} from '../../CameraWorkout/constants/workoutGuide.js';

export { GOAL_TYPES };

// Weighted gear = muscle-building stimulus. Bodyweight/Cardio = conditioning.
const WEIGHTED_EQUIPMENT = new Set([
  'Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Plate', 'Pull-up Bar', 'Resistance Band',
]);

const STRENGTH_MUSCLES = new Set([
  'Chest', 'Back', 'Lats', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Forearms', 'Upper Back', 'Rear Delts',
]);

// Conditioning picks for fat loss: cardio machines + dynamic bodyweight work.
// Static stretches never count as training here.
const CONDITIONING_NAMES = new Set([
  'burpee', 'jumping-jack', 'mountain-climber', 'high-knees', 'jump-squat',
  'battle-ropes', 'jump-rope', 'running', 'cycling',
]);

const isWeighted = (ex) => WEIGHTED_EQUIPMENT.has(ex.equipment);
const isStrengthMuscle = (ex) => STRENGTH_MUSCLES.has(ex.primaryMuscle);
const isRepWork = (ex) =>
  ex.exerciseType === 'weight_reps' ||
  ex.exerciseType === 'bodyweight_reps' ||
  ex.exerciseType === 'assisted_bodyweight';
const isCardioGear = (ex) => ex.equipment === 'Cardio';

// Goal -> catalog predicate. Muscle goals see only weighted strength work;
// weight-loss sees only conditioning; maintain/performance see everything
// except static stretches so the mix stays trainable.
export function goalMatchesExercise(goalKey, ex) {
  if (!ex || ex.isStretch) return false;
  switch (goalKey) {
    case 'BUILD_MUSCLE':
    case 'GAIN_WEIGHT':
      if (ex.exerciseType === 'weight_reps' && isWeighted(ex)) return true;
      if (ex.exerciseType === 'assisted_bodyweight' && isStrengthMuscle(ex)) return true;
      return false;
    case 'LOSE_WEIGHT':
      if (isCardioGear(ex)) return true;
      if (ex.equipment === 'Bodyweight' && (isRepWork(ex) || ex.exerciseType === 'duration' || ex.exerciseType === 'distance_duration')) {
        return CONDITIONING_NAMES.has(ex.slug) || ex.exerciseType === 'distance_duration';
      }
      return false;
    case 'MAINTAIN_WEIGHT':
    case 'PERFORMANCE':
      return true;
    default:
      return true;
  }
}

// Full goal-filtered catalog (stable guide order) for the plan picker.
export function exercisesForGoal(goalKey, query = '') {
  const q = query.trim().toLowerCase();
  return getAllGuideExercises().filter((ex) => {
    if (!goalMatchesExercise(goalKey, ex)) return false;
    if (!q) return true;
    return (
      ex.name?.toLowerCase().includes(q) ||
      ex.equipment?.toLowerCase().includes(q) ||
      ex.primaryMuscle?.toLowerCase().includes(q)
    );
  });
}

// Deterministic auto-fill: round-robin across primary muscles so the starter
// set covers the whole body instead of five chest moves. Falls back to the
// unfiltered catalog when a bucket is unexpectedly small.
export function autoFillForGoal(goalKey, count = 6) {
  let pool = getAllGuideExercises().filter((ex) => goalMatchesExercise(goalKey, ex));
  if (pool.length < count) {
    pool = getAllGuideExercises().filter((ex) => !ex.isStretch);
  }
  const byMuscle = new Map();
  for (const ex of pool) {
    const m = ex.primaryMuscle || 'Other';
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m).push(ex);
  }
  const groups = [...byMuscle.values()];
  const picked = [];
  const seen = new Set();
  let round = 0;
  while (picked.length < count && round < Math.max(...groups.map((g) => g.length))) {
    for (const g of groups) {
      if (picked.length >= count) break;
      const ex = g[round];
      if (ex && !seen.has(ex.slug)) {
        seen.add(ex.slug);
        picked.push(ex.slug);
      }
    }
    round += 1;
  }
  return picked;
}

// Guide exercise -> plan_exercises row payload (matches backend input schema).
export function planExerciseFromGuide(ex) {
  if (!ex) return null;
  if (isHoldExercise(ex)) {
    return { name: ex.name, sets: 3, reps: null, durationSeconds: 45, restSeconds: 30, notes: null };
  }
  return { name: ex.name, sets: 3, reps: '10', durationSeconds: null, restSeconds: 60, notes: null };
}

export function guideBySlug(slug) {
  return getAllGuideExercises().find((e) => e.slug === slug) || null;
}

// Goal -> suggested plan focus tag (mirrors backend tagForGoal).
export function goalTypeToTag(goalKey) {
  if (goalKey === 'LOSE_WEIGHT') return 'Fat Loss';
  if (goalKey === 'BUILD_MUSCLE' || goalKey === 'GAIN_WEIGHT') return 'Strength';
  if (goalKey === 'PERFORMANCE') return 'Performance';
  return 'General';
}

export const goalLabel = (key) => GOAL_TYPES.find((g) => g.key === key)?.label || key || '—';
