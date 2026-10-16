/** Readiness scoring from checkin/activity signals. Pure, no I/O. */
const { READINESS_BANDS, READINESS_WEIGHTS, ACTIVITY_TARGETS } = require('../constants/thresholds');
const levelScore = (level, good = 'LOW') => {
  const v = String(level || '').toUpperCase();
  if (good === 'LOW') {
    if (v === 'LOW') return 1;
    if (v === 'MODERATE') return 0.6;
    if (v === 'HIGH') return 0.25;
    return 0.5;
  }
  if (v === 'HIGH' || v === 'GOOD') return 1;
  if (v === 'MODERATE') return 0.6;
  if (v === 'LOW' || v === 'POOR') return 0.25;
  return 0.5;
};

function sleepDurationScore(hours) {
  if (hours == null || hours === '') return 0.5; // unknown = neutral
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return 0;
  if (h >= 7 && h <= 9) return 1;
  if (h >= 6 && h < 7) return 0.7;
  if (h > 9 && h <= 10) return 0.7;
  if (h >= 5 && h < 6) return 0.4;
  return 0.2;
}

function recommendation(score) {
  if (score == null) return null;
  if (score >= READINESS_BANDS.HIGH) return 'High intensity training approved';
  if (score >= READINESS_BANDS.MODERATE) return 'Moderate training today';
  if (score >= READINESS_BANDS.LIGHT) return 'Light workout recommended';
  return 'Rest recommended';
}

// Returns { readiness: number|null, hasData, source: 'checkin'|'activity'|null, recommendation }
function calcReadiness({ checkin, sleepCount = 0, steps = 0, calories = 0 } = {}) {
  if (checkin) {
    const sorenessVal = checkin.soreness_level ?? checkin.soreness;
    const sleepPts = sleepDurationScore(checkin.sleep_hours) * READINESS_WEIGHTS.SLEEP_DURATION;
    const qualityPts = levelScore(checkin.sleep_quality, 'HIGH') * READINESS_WEIGHTS.SLEEP_QUALITY;
    const stressPts = levelScore(checkin.stress_level, 'LOW') * READINESS_WEIGHTS.STRESS;
    const sorePts = levelScore(sorenessVal, 'LOW') * READINESS_WEIGHTS.SORENESS;
    const energyPts = levelScore(checkin.energy_level, 'HIGH') * READINESS_WEIGHTS.ENERGY;
    const active = steps > 0 || calories > 0;
    const activityPts = active
      ? ACTIVITY_TARGETS.CHECKIN_ACTIVITY_POINTS
      : Math.min(sleepCount * ACTIVITY_TARGETS.SLEEP_LOG_POINTS, ACTIVITY_TARGETS.SLEEP_LOG_MAX);
    const readiness = Math.min(
      100,
      Math.round(sleepPts + qualityPts + stressPts + sorePts + energyPts + activityPts)
    );
    return {
      readiness,
      hasData: true,
      source: 'checkin',
      recommendation: recommendation(readiness),
    };
  }

  const hasData = Boolean(steps > 0 || calories > 0 || sleepCount > 0);
  if (!hasData)
    return {
      readiness: null,
      hasData: false,
      source: null,
      recommendation: null,
    };
  const stepScore = Math.min(steps / ACTIVITY_TARGETS.STEP_TARGET, 1) * ACTIVITY_TARGETS.STEP_POINTS;
  const calScore = Math.min(calories / ACTIVITY_TARGETS.CALORIE_TARGET, 1) * ACTIVITY_TARGETS.CALORIE_POINTS;
  const sleepScore = Math.min(sleepCount * ACTIVITY_TARGETS.SLEEP_PER_LOG, ACTIVITY_TARGETS.SLEEP_MAX);
  const readiness = Math.min(ACTIVITY_TARGETS.ACTIVITY_CAP, Math.round(stepScore + calScore + sleepScore));
  return {
    readiness,
    hasData: true,
    source: 'activity',
    recommendation: recommendation(readiness),
  };
}

module.exports = { calcReadiness, recommendation };
