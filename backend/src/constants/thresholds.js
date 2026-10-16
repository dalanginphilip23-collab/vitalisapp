/** Shared tunable thresholds — single source for health scoring and plan math.
 * Import these instead of hardcoding numbers in controllers/utils.
 * Values are product decisions; change here, not at call sites. */

const READINESS_BANDS = {
  HIGH: 85,
  MODERATE: 70,
  LIGHT: 50,
};

const READINESS_WEIGHTS = {
  SLEEP_DURATION: 30,
  SLEEP_QUALITY: 20,
  STRESS: 15,
  SORENESS: 10,
  ENERGY: 15,
  ACTIVITY: 10,
};

// Activity-fallback scoring (no check-in present)
const ACTIVITY_TARGETS = {
  STEP_TARGET: 8000,
  CALORIE_TARGET: 600,
  STEP_POINTS: 35,
  CALORIE_POINTS: 35,
  SLEEP_PER_LOG: 5,
  SLEEP_MAX: 25,
  ACTIVITY_CAP: 95,
  CHECKIN_ACTIVITY_POINTS: 10,
  SLEEP_LOG_POINTS: 3,
  SLEEP_LOG_MAX: 10,
};

const KCAL = {
  FLOOR_FEMALE: 1200,
  FLOOR_MALE: 1500,
  LOSE_GRADUAL: 300,
  LOSE_DEFAULT: 500,
  LOSE_FASTER: 750,
  GAIN_MODERATE: 400,
  GAIN_DEFAULT: 250,
  MUSCLE_SURPLUS: 200,
  PERFORMANCE_SURPLUS: 100,
  FAT_RATIO: 0.25,
  KCAL_PER_G_FAT: 9,
  KCAL_PER_G_PROTEIN_CARB: 4,
};

module.exports = { READINESS_BANDS, READINESS_WEIGHTS, ACTIVITY_TARGETS, KCAL };
