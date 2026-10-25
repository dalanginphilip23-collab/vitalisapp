/** Readiness scoring from checkin/activity signals. Pure, no I/O. */
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
  if (score >= 85) return 'High intensity training approved';
  if (score >= 70) return 'Moderate training today';
  if (score >= 50) return 'Light workout recommended';
  return 'Rest recommended';
}

/**
 * Readiness score from checkin/activity signals.
 * @param {{ checkin?: Record<string, any> | null, sleepCount?: number, steps?: number, calories?: number }} props
 * @returns {{ readiness: number | null, hasData: boolean, source: 'checkin' | 'activity' | null, recommendation: string | null }}
 */
function calcReadiness({ checkin, sleepCount = 0, steps = 0, calories = 0 } = {}) {
  if (checkin) {
    const sorenessVal = checkin.soreness_level ?? checkin.soreness;
    const sleepPts = sleepDurationScore(checkin.sleep_hours) * 30;
    const qualityPts = levelScore(checkin.sleep_quality, 'HIGH') * 20;
    const stressPts = levelScore(checkin.stress_level, 'LOW') * 15;
    const sorePts = levelScore(sorenessVal, 'LOW') * 10;
    const energyPts = levelScore(checkin.energy_level, 'HIGH') * 15;
    const active = steps > 0 || calories > 0;
    const activityPts = active ? 10 : Math.min(sleepCount * 3, 10);
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
  const stepScore = Math.min(steps / 8000, 1) * 35;
  const calScore = Math.min(calories / 600, 1) * 35;
  const sleepScore = Math.min(sleepCount * 5, 25);
  const readiness = Math.min(95, Math.round(stepScore + calScore + sleepScore));
  return {
    readiness,
    hasData: true,
    source: 'activity',
    recommendation: recommendation(readiness),
  };
}

module.exports = { calcReadiness, recommendation };
