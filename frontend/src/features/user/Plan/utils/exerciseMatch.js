// Module 5 — exercise normalization for the plan tracker.
// Maps plan-day exercise names onto the 302-exercise Bryl catalog (workoutGuide)
// to (1) tag muscle groups, (2) suggest equipment-compatible alternatives.
import { getAllGuideExercises } from '../../CameraWorkout/constants/workoutGuide.js';

/** 'Bodyweight Squats' / "child's pose hold" → 'bodyweightsquats' */
const normalizeName = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Catalog + user-pref equipment to one comparable token ('Dumbbells' → 'dumbbell'). */
export const normalizeEquipment = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '').replace(/equipment$/, '');

// Keyword priors for plan names that don't match the catalog exactly
// (primaryMuscle tag only — good enough for scheduling/grouping tags).
const MUSCLE_HINTS = [
  { keys: ['pushup', 'push up'], muscle: 'Chest' },
  { keys: ['bench'], muscle: 'Chest' },
  { keys: ['squat'], muscle: 'Legs' },
  { keys: ['lunge'], muscle: 'Legs' },
  { keys: ['plank'], muscle: 'Core' },
  { keys: ['crunch', 'situp', 'sit up', 'core'], muscle: 'Core' },
  { keys: ['bridge', 'glute'], muscle: 'Glutes' },
  { keys: ['jacks', 'jump', 'cardio', 'runner', 'run', 'skater', 'high knee'], muscle: 'Cardio' },
  { keys: ['breathing', 'stretch', 'pose', 'mobility', 'cow'], muscle: 'Mobility' },
  { keys: ['curl', 'row'], muscle: 'Back' },
  { keys: ['raise', 'press'], muscle: 'Shoulders' },
];

export function _nameIndex() {
  const idx = new Map();
  for (const ex of getAllGuideExercises()) {
    const key = normalizeName(ex.name);
    if (key && !idx.has(key)) idx.set(key, ex);
    // primary alias: first word of slug words joined — e.g. 'pull_up' → 'pullup'
    const slugKey = normalizeName(ex.slug);
    if (slugKey && !idx.has(slugKey)) idx.set(slugKey, ex);
  }
  return idx;
}

let cachedIndex = null;

export function matchExercise(name) {
  if (!cachedIndex) cachedIndex = _nameIndex();
  const norm = normalizeName(name);
  if (!norm) return null;
  if (cachedIndex.has(norm)) return cachedIndex.get(norm);
  // Partial: either side contains the other (≥5 chars to avoid noise).
  for (const [key, ex] of cachedIndex) {
    if (key.length >= 5 && (norm.includes(key) || key.includes(norm))) return ex;
  }
  return null;
}

/** Muscle tag for a plan exercise name (catalog first, keyword hints fallback). */
export function muscleFor(name) {
  const match = matchExercise(name);
  if (match?.primaryMuscle) return match.primaryMuscle;
  const norm = normalizeName(name);
  for (const hint of MUSCLE_HINTS) {
    if (hint.keys.some((k) => norm.includes(normalizeName(k)))) return hint.muscle;
  }
  return null;
}

/** Chip rollup for a list of plan exercises: e.g. [{tag:'Chest',n:2}, …]. */
export function summarizeMuscles(exercises) {
  const counts = new Map();
  for (const ex of exercises || []) {
    const m = muscleFor(ex?.name);
    if (!m) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n);
}

/**
 * Alternatives for a plan exercise: same primary muscle as its best catalog
 * match, equipment the user self-reported (Module 5) — 'no equipment'/
 * bodyweight entries always allowed. Excludes the matched exercise itself.
 */
export function suggestAlternatives(name, prefsEquipment = []) {
  const allowed = new Set((prefsEquipment || []).map(normalizeEquipment));
  const allowBodyweightOnly = allowed.size === 0;
  const match = matchExercise(name);
  const targetMuscle = match?.primaryMuscle ?? muscleFor(name);
  const catalog = getAllGuideExercises();

  const equipmentOk = (catEq) => {
    const norm = normalizeEquipment(catEq);
    if (norm === 'none' || norm === 'bodyweight' || norm === 'no equipment') return true;
    if (allowBodyweightOnly) return false;
    for (const a of allowed) {
      if (a === norm) return true;
      // loose match: 'resistanceband' vs 'band', phrase containment
      if (a.length >= 4 && (a.includes(norm) || norm.includes(a))) return true;
    }
    return false;
  };

  return catalog
    .filter((ex) => {
      if (match && ex.slug === match.slug) return false;
      if (targetMuscle && ex.primaryMuscle === targetMuscle) return equipmentOk(ex.equipment);
      return false;
    })
    .slice(0, 5)
    .map((ex) => ({
      slug: ex.slug,
      name: ex.name,
      equipment: ex.equipment,
      muscle: ex.primaryMuscle,
    }));
}
