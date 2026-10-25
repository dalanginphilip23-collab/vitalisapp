// Shared goal vocabulary — single source for onboarding, profile, dashboard, AI.
export const GOAL_TYPES = [
  { key: 'LOSE_WEIGHT', label: 'Lose Weight / Fat', desc: 'Reduce body weight and body fat.', icon: 'local_fire_department' },
  { key: 'MAINTAIN_WEIGHT', label: 'Maintain Weight', desc: 'Maintain weight while improving fitness.', icon: 'balance' },
  { key: 'GAIN_WEIGHT', label: 'Gain Weight', desc: 'Gradually increase body weight.', icon: 'trending_up' },
  { key: 'BUILD_MUSCLE', label: 'Build Muscle', desc: 'Focus on muscle growth and strength.', icon: 'fitness_center' },
  { key: 'PERFORMANCE', label: 'Improve Performance', desc: 'Endurance, strength and athletic performance.', icon: 'directions_run' },
];

export const goalLabel = (key) => GOAL_TYPES.find((g) => g.key === key)?.label || key || '—';

export const ACTIVITY_LEVELS = [
  { key: 'SEDENTARY', label: 'Sedentary', desc: 'Mostly sitting / minimal exercise', icon: 'chair' },
  { key: 'LIGHTLY_ACTIVE', label: 'Lightly Active', desc: 'Activity 1–3 days per week', icon: 'directions_walk' },
  { key: 'MODERATELY_ACTIVE', label: 'Moderately Active', desc: 'Activity 3–5 days per week', icon: 'directions_run' },
  { key: 'VERY_ACTIVE', label: 'Very Active', desc: 'Activity 6–7 days per week', icon: 'bolt' },
  { key: 'HIGHLY_ACTIVE', label: 'Highly Active', desc: 'Intense training or demanding lifestyle', icon: 'local_fire_department' },
];

export const activityLabel = (key) => ACTIVITY_LEVELS.find((a) => a.key === key)?.label || key || '—';

export const PACES = {
  LOSE_WEIGHT: ['GRADUAL', 'MODERATE', 'FASTER'],
  GAIN_WEIGHT: ['GRADUAL', 'MODERATE'],
};

export const FOCUSES = {
  BUILD_MUSCLE: ['GENERAL', 'STRENGTH', 'HYPERTROPHY'],
  MAINTAIN_WEIGHT: ['GENERAL', 'STRENGTH', 'ENDURANCE', 'BODY_COMPOSITION'],
  PERFORMANCE: ['ENDURANCE', 'STRENGTH', 'CONDITIONING', 'ATHLETIC'],
};

export const SLEEP_QUALITY = ['LOW', 'MODERATE', 'GOOD'];
export const STRESS_LEVELS = ['LOW', 'MODERATE', 'HIGH'];
export const EXERCISE_FREQ = ['NEVER', '1_2_DAYS', '3_5_DAYS', '6_7_DAYS'];
export const RECOVERY_LEVELS = ['LOW', 'MODERATE', 'HIGH'];

// Human labels for enum-style option values. Day ranges get en-dashes;
// anything else falls back to underscore → space + sentence case.
// (String.replace('_',' ') only swaps the FIRST underscore — this helper
// replaces all of them, so '1_2_DAYS' never leaks into the UI.)
export const EXERCISE_FREQ_LABELS = {
  NEVER: 'Never',
  '1_2_DAYS': '1–2 days',
  '3_5_DAYS': '3–5 days',
  '6_7_DAYS': '6–7 days',
};

export const humanizeOption = (o) => {
  const s = String(o ?? '');
  if (EXERCISE_FREQ_LABELS[s]) return EXERCISE_FREQ_LABELS[s];
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};
