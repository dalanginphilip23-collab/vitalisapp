// tests/unit/plans-personal.test.js — personal plans (032) guards.
// No DB rows touched: src/config/db is stubbed via require.cache.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-min-32-chars-0123456789ab';

const dbPath = require.resolve('../../src/config/db');
// Queue of scripted execute() responses: each entry is [rows] or { insertId } or Error.
let queue = [];
let executed = [];
const fakeDb = {
  execute: async (sql, _params) => {
    executed.push(String(sql).slice(0, 80));
    const next = queue.shift();
    if (next instanceof Error) throw next;
    if (next && typeof next === 'object' && 'insertId' in next) return [{ insertId: next.insertId }, undefined];
    return [next ?? [], undefined];
  },
  getConnection: async () => {
    const conn = {
      beginTransaction: async () => {},
      query: async () => {},
      release: () => {},
      execute: fakeDb.execute,
    };
    return conn;
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const plans = require('../../src/controllers/plans.controller');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const throwNext = (e) => { throw e; };

beforeEach(() => { queue = []; executed = []; });

describe('personal plan schemas', () => {
  it('accepts a valid create payload with defaults', () => {
    const r = plans.createPersonalSchema.safeParse({ title: 'My Shred' });
    assert.ok(r.success);
    assert.equal(r.data.tag, 'General');
    assert.equal(r.data.durationDays, 7);
  });
  it('rejects empty title and out-of-range days', () => {
    assert.ok(!plans.createPersonalSchema.safeParse({ title: '' }).success);
    assert.ok(!plans.createPersonalSchema.safeParse({ title: 'x', durationDays: 0 }).success);
    assert.ok(!plans.createPersonalSchema.safeParse({ title: 'x', durationDays: 85 }).success);
  });
  it('rejects empty update payload', () => {
    assert.ok(!plans.updatePersonalSchema.safeParse({}).success);
    assert.ok(plans.updatePersonalSchema.safeParse({ title: 'New name' }).success);
  });
});

describe('owner guards', () => {
  it('PATCH 403 when not the owner (template or another user)', async () => {
    queue = [[{ id: 40, owner_user_id: null }]];
    const res = mockRes();
    await plans.patchPlanId({ user: { id: 13 }, params: { planId: '40' }, body: { title: 'Hack' } }, res, throwNext);
    assert.equal(res.statusCode, 403);
  });
  it('PATCH 404 when plan missing', async () => {
    queue = [[]];
    const res = mockRes();
    await plans.patchPlanId({ user: { id: 13 }, params: { planId: '999' }, body: { title: 'x' } }, res, throwNext);
    assert.equal(res.statusCode, 404);
  });
  it('DELETE 403 for template plans', async () => {
    queue = [[{ id: 41, owner_user_id: null }]];
    const res = mockRes();
    await plans.deletePlanId({ user: { id: 13 }, params: { planId: '41' } }, res, throwNext);
    assert.equal(res.statusCode, 403);
  });
});

describe('progress hardening', () => {
  it('404 when plan does not exist', async () => {
    queue = [[]];
    const res = mockRes();
    await plans.postprogressComplete({ user: { id: 13 }, body: { planId: 999, dayNumber: 1 } }, res, throwNext);
    assert.equal(res.statusCode, 404);
  });
  it('409 when not enrolled', async () => {
    queue = [[{ id: 40 }], []];
    const res = mockRes();
    await plans.postprogressComplete({ user: { id: 13 }, body: { planId: 40, dayNumber: 1 } }, res, throwNext);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /Enroll/);
  });
});

describe('personal plan create', () => {
  it('creates plan + skeleton days + starter exercises for workout days', async () => {
    // Order of conn.execute calls: dup-check, INSERT plans, then per-day
    // INSERT plan_contents (+ 4x plan_exercises on workout days), then enroll.
    queue = [[], { insertId: 99 }];
    for (let n = 1; n <= 7; n += 1) {
      queue.push({ insertId: 200 + n });
      if (n % 3 !== 0) queue.push({ insertId: 0 }, { insertId: 0 }, { insertId: 0 }, { insertId: 0 });
    }
    queue.push([]); // INSERT IGNORE user_plans
    const res = mockRes();
    await plans.postCreate(
      { user: { id: 13 }, body: { title: 'My Shred', tag: 'Strength', intensity: 'Moderate', targetFocus: 'Strength', durationDays: 7, description: '' } },
      res,
      throwNext
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.planId, 99);
    const exInserts = executed.filter((s) => s.includes('plan_exercises'));
    // 7-day starter: workout days 1,2,4,5,7 × 4 exercises
    assert.equal(exInserts.length, 20);
  });
  it('409 on duplicate personal title', async () => {
    queue = [[{ id: 77 }]];
    const res = mockRes();
    await plans.postCreate(
      { user: { id: 13 }, body: { title: 'My Shred' } },
      res,
      throwNext
    );
    assert.equal(res.statusCode, 409);
  });
});

describe('goal-status link', () => {
  it('returns goal:null when no active goal', async () => {
    queue = [[]];
    const res = mockRes();
    await plans.getGoalStatusUserId({ user: { id: 13 }, params: { userId: '13' } }, res, throwNext);
    assert.deepEqual(res.body, { goal: null, linkedPlan: null });
  });
  it('returns goal + linked plan when source_plan_id resolves', async () => {
    queue = [
      [{ id: 5, goal_type: 'LOSE_WEIGHT', daily_kcal: 2100, protein_g: 150, carbs_g: 200, fat_g: 60, target_weight_kg: 70, source_plan_id: 99 }],
      [{ id: 99, title: 'My Lose Weight Plan' }],
    ];
    const res = mockRes();
    await plans.getGoalStatusUserId({ user: { id: 13 }, params: { userId: '13' } }, res, throwNext);
    assert.equal(res.body.goal.goalType, 'LOSE_WEIGHT');
    assert.equal(res.body.goal.dailyKcal, 2100);
    assert.deepEqual(res.body.linkedPlan, { id: 99, title: 'My Lose Weight Plan' });
  });
  it('returns goal with linkedPlan:null when the plan was deleted', async () => {
    queue = [
      [{ id: 5, goal_type: 'GAIN_WEIGHT', daily_kcal: 2800, protein_g: 160, carbs_g: 300, fat_g: 70, target_weight_kg: 85, source_plan_id: 404 }],
      [],
    ];
    const res = mockRes();
    await plans.getGoalStatusUserId({ user: { id: 13 }, params: { userId: '13' } }, res, throwNext);
    assert.equal(res.body.goal.goalType, 'GAIN_WEIGHT');
    assert.equal(res.body.linkedPlan, null);
  });
});

describe('auto-from-goal', () => {
  it('404 NO_ACTIVE_GOAL without an active goal', async () => {
    queue = [[]];
    const res = mockRes();
    await plans.postAutoFromGoal({ user: { id: 13 } }, res, throwNext);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.code, 'NO_ACTIVE_GOAL');
  });
  it('maps goal types to human titles and tags', () => {
    assert.equal(plans.humanizeGoal('LOSE_WEIGHT'), 'Lose Weight');
    assert.equal(plans.tagForGoal('LOSE_WEIGHT'), 'Fat Loss');
    assert.equal(plans.tagForGoal('BUILD_MUSCLE'), 'Strength');
  });
  it('accepts goalType + explicit exercises on create', () => {
    const r = plans.createPersonalSchema.safeParse({
      title: 'My Bulk',
      goalType: 'BUILD_MUSCLE',
      exercises: [{ name: 'Dumbbell Bench Press', sets: 4, reps: '8' }],
    });
    assert.ok(r.success);
    assert.equal(r.data.goalType, 'BUILD_MUSCLE');
    assert.equal(r.data.exercises.length, 1);
    assert.equal(r.data.exercises[0].restSeconds, 45);
  });
  it('rejects unknown goalType and oversized exercise lists', () => {
    assert.ok(!plans.createPersonalSchema.safeParse({ title: 'x', goalType: 'NOPE' }).success);
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `Ex ${i}` }));
    assert.ok(!plans.createPersonalSchema.safeParse({ title: 'x', exercises: many }).success);
  });
  it('matches starter exercises to training goal', () => {
    const muscle = plans.starterForGoal('BUILD_MUSCLE').map((e) => e.exercise_name);
    const gain = plans.starterForGoal('GAIN_WEIGHT').map((e) => e.exercise_name);
    const loss = plans.starterForGoal('LOSE_WEIGHT').map((e) => e.exercise_name);
    const cardio = plans.starterForTag('Cardio').map((e) => e.exercise_name);
    assert.ok(muscle.includes('Dumbbell Bench Press'));
    assert.deepEqual(gain, muscle);
    assert.deepEqual(loss, cardio);
    assert.equal(plans.starterForGoal('NOPE'), null);
  });
  it('prefers explicit exercises, then goal, then tag', () => {
    const custom = plans.dayExercisesFor({
      tag: 'Cardio', goalType: 'BUILD_MUSCLE',
      exercises: [{ name: 'Squat', sets: 5, reps: '5', restSeconds: 120 }],
    });
    assert.equal(custom.length, 1);
    assert.equal(custom[0].exercise_name, 'Squat');
    assert.equal(custom[0].sets, 5);
    const goalBased = plans.dayExercisesFor({ tag: 'Cardio', goalType: 'BUILD_MUSCLE' });
    assert.ok(goalBased.some((e) => e.exercise_name === 'Dumbbell Bench Press'));
    const tagBased = plans.dayExercisesFor({ tag: 'Cardio' });
    assert.ok(tagBased.some((e) => e.exercise_name === 'Jumping Jacks'));
  });
  it('creates plan with explicit goal exercises on workout days', async () => {
    queue = [[], { insertId: 100 }];
    for (let n = 1; n <= 7; n += 1) {
      queue.push({ insertId: 300 + n });
      if (n % 3 !== 0) queue.push({ insertId: 0 }, { insertId: 0 });
    }
    queue.push([]);
    const res = mockRes();
    await plans.postCreate(
      { user: { id: 13 }, body: { title: 'My Bulk', tag: 'Strength', intensity: 'High', targetFocus: 'Strength', durationDays: 7, description: '', goalType: 'BUILD_MUSCLE', exercises: [{ name: 'Squat', sets: 5, reps: '5' }, { name: 'Bench', sets: 4, reps: '8' }] } },
      res,
      throwNext
    );
    assert.equal(res.statusCode, 201);
    const exInserts = executed.filter((s) => s.includes('plan_exercises'));
    // 5 workout days × 2 explicit exercises (not the 4 generic starters)
    assert.equal(exInserts.length, 10);
  });
  it('matches starter exercises to plan focus', () => {
    const strength = plans.starterForTag('Strength').map((e) => e.exercise_name);
    const cardio = plans.starterForTag('Cardio').map((e) => e.exercise_name);
    const fatLoss = plans.starterForTag('Fat Loss').map((e) => e.exercise_name);
    const mobility = plans.starterForTag('Mobility').map((e) => e.exercise_name);
    const flexibility = plans.starterForTag('Flexibility').map((e) => e.exercise_name);
    const general = plans.starterForTag('General').map((e) => e.exercise_name);
    assert.ok(strength.includes('Bodyweight Squats'));
    assert.ok(cardio.includes('Jumping Jacks'));
    assert.deepEqual(fatLoss, cardio);
    assert.deepEqual(flexibility, mobility);
    assert.deepEqual(general, strength);
    assert.ok(!cardio.some((n) => strength.includes(n)), 'cardio set differs from strength');
  });
});
