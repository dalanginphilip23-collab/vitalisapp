// Goal profile registry — the single "goal -> behaviour" contract.
//
// This is the brain behind goal-aware adaptation: nutrition targets, training
// emphasis, recovery focus and the AI coaching directive for each of the 5
// onboarding goals. Numeric values intentionally mirror the numbers already
// used by utils/planEngine.js (macro splits) and the dashboard's workout goal
// (workoutGoalMin) so nothing drifts. tests/unit/goalProfile.test.js asserts
// the planEngine/goalProfile tuples stay in sync.
//
// LABELS/ICONS: the client renders goal + activity labels from
// frontend/src/features/user/Onboarding/constants/goals.js (display only —
// that file carries no numeric behaviour). Numeric adaptation stays
// server-side here + planEngine; there is intentionally NO numeric frontend
// mirror.

const GOAL_PROFILES = {
  LOSE_WEIGHT: {
    key: 'LOSE_WEIGHT',
    label: 'Lose Weight / Fat',
    icon: 'local_fire_department',
    planTag: 'Fat Loss',
    focus: 'BODY_COMPOSITION',
    workoutGoalMin: 45,
    trainingEmphasis: 'Cardio + full-body circuits',
    nutritionNote: 'Calorie deficit — keep protein high to preserve muscle.',
    recoveryEmphasis: 'Sleep 7h+ and hydration drive fat loss.',
    aiDirective:
      'Stay in a calorie deficit, protect muscle with high protein, and keep daily movement/steps up.',
    // nutrition math (mirrors planEngine)
    kcalDelta: -500,
    proteinPerKg: 2.0,
  },
  MAINTAIN_WEIGHT: {
    key: 'MAINTAIN_WEIGHT',
    label: 'Maintain Weight',
    icon: 'balance',
    planTag: 'General',
    focus: 'GENERAL',
    workoutGoalMin: 30,
    trainingEmphasis: 'Balanced strength + cardio',
    nutritionNote: 'Eat at maintenance — balanced macros, steady habits.',
    recoveryEmphasis: 'Consistent sleep keeps weight stable.',
    aiDirective:
      'Hold calories around maintenance, keep protein adequate, and train consistently for body composition.',
    kcalDelta: 0,
    proteinPerKg: 1.6,
  },
  GAIN_WEIGHT: {
    key: 'GAIN_WEIGHT',
    label: 'Gain Weight',
    icon: 'trending_up',
    planTag: 'Strength',
    focus: 'GENERAL',
    workoutGoalMin: 45,
    trainingEmphasis: 'Progressive strength training',
    nutritionNote: 'Small calorie surplus — eat regularly and hit protein.',
    recoveryEmphasis: 'Rest days are when you grow — prioritize sleep.',
    aiDirective:
      'Eat in a small calorie surplus, train with progressive overload, and keep protein and sleep high.',
    kcalDelta: 250,
    proteinPerKg: 1.8,
  },
  BUILD_MUSCLE: {
    key: 'BUILD_MUSCLE',
    label: 'Build Muscle',
    icon: 'fitness_center',
    planTag: 'Strength',
    focus: 'STRENGTH',
    workoutGoalMin: 60,
    trainingEmphasis: 'Hypertrophy + strength splits',
    nutritionNote: 'Slight surplus with high protein to build muscle.',
    recoveryEmphasis: 'Muscle grows during recovery — sleep and rest matter.',
    aiDirective:
      'Train for hypertrophy/strength with progressive overload, eat a slight surplus and hit high protein.',
    kcalDelta: 200,
    proteinPerKg: 2.2,
  },
  PERFORMANCE: {
    key: 'PERFORMANCE',
    label: 'Improve Performance',
    icon: 'directions_run',
    planTag: 'Performance',
    focus: 'ENDURANCE',
    workoutGoalMin: 60,
    trainingEmphasis: 'Endurance + conditioning',
    nutritionNote: 'Fuel performance — carbs around training, adequate protein.',
    recoveryEmphasis: 'Recovery quality sets your performance ceiling.',
    aiDirective:
      'Build endurance and conditioning, fuel sessions with carbs, and protect recovery to perform.',
    kcalDelta: 100,
    proteinPerKg: 1.8,
  },
};

// Safe fallback when a goal type is unknown/missing.
const DEFAULT_GOAL_PROFILE = GOAL_PROFILES.MAINTAIN_WEIGHT;

const GOAL_TYPES = Object.keys(GOAL_PROFILES);

/** Resolve a goal profile by type (case-insensitive). Returns null when unknown. */
function getGoalProfile(goalType) {
  const key = String(goalType || '').toUpperCase();
  return GOAL_PROFILES[key] || null;
}

module.exports = { GOAL_PROFILES, DEFAULT_GOAL_PROFILE, GOAL_TYPES, getGoalProfile };
