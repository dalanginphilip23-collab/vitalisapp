// tests/unit/workout-log-sets.test.js — Module 5 set/feedback validation (no DB).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const svc = require('../../src/services/workoutLogs.service');

describe('cleanWorkoutType (legacy contract kept)', () => {
  it('falls back to general for blank input', () => {
    assert.equal(svc.cleanWorkoutType(''), 'general');
    assert.equal(svc.cleanWorkoutType(undefined), 'general');
  });

  it('returns null (400 upstream) for non-slug text', () => {
    assert.equal(svc.cleanWorkoutType('deadlift!!'), null);
  });
});

describe('validateSets', () => {
  it('returns null when sets omitted (legacy callers unchanged)', () => {
    assert.equal(svc.validateSets(undefined), null);
    assert.equal(svc.validateSets(null), null);
  });

  it('returns [] for an explicit empty array (clear)', () => {
    assert.deepEqual(svc.validateSets([]), []);
  });

  it('normalizes a valid weighted set', () => {
    const out = svc.validateSets([{ exercise_name: ' Barbell Bench Press ', set_number: 1, reps: 8, weight_kg: 62.5 }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].exercise_name, 'Barbell Bench Press');
    assert.equal(out[0].reps, 8);
    assert.equal(out[0].weight, 62.5);
    assert.equal(out[0].duration_seconds, null);
  });

  it('rejects a set with no measurable metric', () => {
    assert.throws(() => svc.validateSets([{ exercise_name: 'Squat' }]), /reps, weight_kg/i);
  });

  it('rejects non-array and oversized arrays', () => {
    assert.throws(() => svc.validateSets('3x8'), /array/i);
    assert.throws(() => svc.validateSets(new Array(101).fill({ exercise_name: 'x', reps: 1 })), /100/);
  });

  it('rejects missing exercise names; long names truncate to 150', () => {
    assert.throws(() => svc.validateSets([{ set_number: 1, reps: 5 }]), /exercise_name/i);
    assert.equal(svc.validateSets([{ exercise_name: 'x'.repeat(151), reps: 5 }])[0].exercise_name.length, 150);
  });

  it('rejects out-of-range values per metric', () => {
    assert.throws(() => svc.validateSets([{ exercise_name: 'Squat', reps: -1 }]), /reps/i);
    assert.throws(() => svc.validateSets([{ exercise_name: 'Squat', reps: 1.5 }]), /reps/i);
    assert.throws(() => svc.validateSets([{ exercise_name: 'Squat', weight_kg: 2000 }]), /weight/i);
    assert.throws(() => svc.validateSets([{ exercise_name: 'Plank', duration_seconds: 90000 }]), /duration/i);
    assert.throws(() => svc.validateSets([{ exercise_name: 'Run', distance_meters: 999999 }]), /distance/i);
    assert.throws(() => svc.validateSets([{ exercise_name: 'Squat', set_number: 0, reps: 5 }]), /set_number/i);
  });

  it('caps distinct exercises per session (30) but allows repeated exercise names', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ exercise_name: `Exercise ${i}`, reps: 10 }));
    assert.throws(() => svc.validateSets(many), /30 distinct/);
    const repeated = [
      { exercise_name: 'Squat', set_number: 1, reps: 10 },
      { exercise_name: 'squat', set_number: 2, reps: 10, weight_kg: 40 },
    ];
    assert.equal(svc.validateSets(repeated).length, 2);
  });
});

describe('cleanExerciseName', () => {
  it('trims to 150 chars and rejects blank', () => {
    assert.equal(svc.cleanExerciseName('  Press  '), 'Press');
    assert.equal(svc.cleanExerciseName('x'.repeat(300)).length, 150);
    assert.equal(svc.cleanExerciseName('   '), null);
  });
});
