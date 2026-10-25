// tests/unit/goalProfile.test.js — goalProfile registry ↔ planEngine sync
// + the pace-delta table (Module 8: SLOW/AGGRESSIVE now mapped, not ignored).
// Pure, no DB. Guards the "goal -> behaviour" contract against drift.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { GOAL_PROFILES, DEFAULT_GOAL_PROFILE, GOAL_TYPES, getGoalProfile } = require('../../src/utils/goalProfile');
const { generatePlan } = require('../../src/utils/planEngine');

const BASE = {
  weightKg: 70,
  heightCm: 170,
  dob: '2000-01-01',
  sex: 'male',
  activityLevel: 'MODERATELY_ACTIVE',
};

describe('goalProfile registry integrity', () => {
  it('covers the 5 onboarding goals with a full behaviour bundle', () => {
    for (const key of ['LOSE_WEIGHT', 'MAINTAIN_WEIGHT', 'GAIN_WEIGHT', 'BUILD_MUSCLE', 'PERFORMANCE']) {
      const p = GOAL_PROFILES[key];
      assert.ok(p, `missing profile ${key}`);
      assert.equal(p.key, key);
      assert.ok(Number.isFinite(p.kcalDelta), `${key} kcalDelta missing`);
      assert.ok(p.proteinPerKg > 0, `${key} proteinPerKg missing`);
      assert.ok(p.workoutGoalMin >= 30, `${key} workoutGoalMin missing`);
      assert.ok(p.aiDirective && p.trainingEmphasis, `${key} AI/training directive missing`);
    }
    assert.equal(GOAL_TYPES.length, 5);
  });

  it('getGoalProfile is case-insensitive and unknown types fall back to MAINTAIN', () => {
    assert.equal(getGoalProfile('build_muscle').key, 'BUILD_MUSCLE');
    assert.equal(getGoalProfile('nonsense'), null);
    assert.equal(DEFAULT_GOAL_PROFILE.key, 'MAINTAIN_WEIGHT');
  });
});

describe('goalProfile ↔ planEngine numeric sync', () => {
  // Default (MODERATE) pace: generatePlan must land exactly on the profile's
  // kcalDelta, and protein on proteinPerKg — these two files must never drift.
  it('default-pace kcal delta matches each goal profile', () => {
    for (const key of GOAL_TYPES) {
      const profile = GOAL_PROFILES[key];
      const plan = generatePlan({ ...BASE, goalType: key });
      assert.equal(plan.dailyKcal - plan.tdee, profile.kcalDelta, `kcalDelta drift for ${key}`);
    }
  });

  it('protein grams track the profile proteinPerKg', () => {
    for (const key of GOAL_TYPES) {
      const profile = GOAL_PROFILES[key];
      const plan = generatePlan({ ...BASE, goalType: key });
      assert.equal(plan.proteinG, Math.round(profile.proteinPerKg * BASE.weightKg), `proteinPerKg drift for ${key}`);
    }
  });

  it('offered workout minutes stay sane vs the projection consistency check (30 default)', () => {
    for (const key of GOAL_TYPES) {
      assert.ok(GOAL_PROFILES[key].workoutGoalMin >= 30, `${key} target below maintain floor`);
    }
  });
});

describe('planEngine pace table (all validated paces produce real deltas)', () => {
  it('LOSE_WEIGHT: SLOW/GRADUAL/MODERATE/FASTER/AGGRESSIVE → -250/-300/-500/-750/-750', () => {
    const want = { SLOW: -250, GRADUAL: -300, MODERATE: -500, FASTER: -750, AGGRESSIVE: -750 };
    for (const [pace, delta] of Object.entries(want)) {
      const plan = generatePlan({ ...BASE, goalType: 'LOSE_WEIGHT', pace });
      assert.equal(plan.dailyKcal - plan.tdee, delta, `pace ${pace} fell to default instead of ${delta}`);
    }
  });

  it('GAIN_WEIGHT: SLOW/GRADUAL/MODERATE/FASTER/AGGRESSIVE → 125/250/400/250/400', () => {
    const want = { SLOW: 125, GRADUAL: 250, MODERATE: 400, FASTER: 250, AGGRESSIVE: 400 };
    for (const [pace, delta] of Object.entries(want)) {
      const plan = generatePlan({ ...BASE, goalType: 'GAIN_WEIGHT', pace });
      assert.equal(plan.dailyKcal - plan.tdee, delta, `pace ${pace} fell to default instead of ${delta}`);
    }
  });

  it('unknown pace keeps the historical default (+250 gain deficit-safe floors apply)', () => {
    const plan = generatePlan({ ...BASE, goalType: 'LOSE_WEIGHT', pace: 'WHATEVER' });
    assert.equal(plan.dailyKcal - plan.tdee, -500);
    const gain = generatePlan({ ...BASE, goalType: 'GAIN_WEIGHT', pace: 'WHATEVER' });
    assert.equal(gain.dailyKcal - gain.tdee, 250);
    // FASTER on a small frame must clamp to the sex floor, not starve.
    const tiny = generatePlan({
      weightKg: 55, heightCm: 150, dob: '2000-01-01', sex: 'female',
      activityLevel: 'SEDENTARY', goalType: 'LOSE_WEIGHT', pace: 'FASTER',
    });
    assert.equal(tiny.dailyKcal, 1200); // female floor
    const tinyMale = generatePlan({
      weightKg: 55, heightCm: 150, dob: '2000-01-01', sex: 'male',
      activityLevel: 'SEDENTARY', goalType: 'LOSE_WEIGHT', pace: 'FASTER',
    });
    assert.equal(tinyMale.dailyKcal, 1500); // male floor
  });
});

describe('surplus goals stay pace-safe', () => {
  it('BUILD_MUSCLE always +200, PERFORMANCE always +100 regardless of pace', () => {
    for (const pace of ['SLOW', 'GRADUAL', 'MODERATE', 'FASTER', 'AGGRESSIVE']) {
      assert.equal(generatePlan({ ...BASE, goalType: 'BUILD_MUSCLE', pace }).dailyKcal - generatePlan({ ...BASE, goalType: 'MAINTAIN_WEIGHT', pace }).dailyKcal, 200);
      assert.equal(generatePlan({ ...BASE, goalType: 'PERFORMANCE', pace }).dailyKcal - generatePlan({ ...BASE, goalType: 'MAINTAIN_WEIGHT', pace }).dailyKcal, 100);
    }
  });
});
