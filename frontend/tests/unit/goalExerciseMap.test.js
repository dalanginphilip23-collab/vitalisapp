// Bucket rules: muscle goals see only weighted strength work,
// fat-loss only conditioning, maintain/performance a balanced mix.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoFillForGoal,
  exercisesForGoal,
  goalMatchesExercise,
  goalTypeToTag,
  guideBySlug,
  planExerciseFromGuide,
} from "../../src/features/Plan/utils/goalExerciseMap.js";

const bySlug = (list) => list.map((e) => e.slug);

describe("goalMatchesExercise", () => {
  it("muscle goals accept weighted compounds, reject cardio", () => {
    const bench = guideBySlug("bench-press");
    const running = guideBySlug("running");
    assert.ok(bench, "bench-press exists in catalog");
    assert.equal(goalMatchesExercise("BUILD_MUSCLE", bench), true);
    assert.equal(goalMatchesExercise("GAIN_WEIGHT", bench), true);
    assert.equal(goalMatchesExercise("BUILD_MUSCLE", running), false);
  });
  it("fat-loss accepts conditioning, rejects weighted lifts", () => {
    const burpee = guideBySlug("burpee");
    const bench = guideBySlug("bench-press");
    assert.ok(burpee, "burpee exists in catalog");
    assert.equal(goalMatchesExercise("LOSE_WEIGHT", burpee), true);
    assert.equal(goalMatchesExercise("LOSE_WEIGHT", guideBySlug("running")), true);
    assert.equal(goalMatchesExercise("LOSE_WEIGHT", bench), false);
  });
  it("never offers static stretches for any goal", () => {
    for (const goal of ["BUILD_MUSCLE", "GAIN_WEIGHT", "LOSE_WEIGHT", "MAINTAIN_WEIGHT", "PERFORMANCE"]) {
      assert.equal(exercisesForGoal(goal).some((e) => e.isStretch), false, goal);
    }
  });
});

describe("exercisesForGoal", () => {
  it("muscle bucket is all weighted strength work", () => {
    const list = exercisesForGoal("BUILD_MUSCLE");
    assert.ok(list.length > 50, `expected a deep muscle pool, got ${list.length}`);
    assert.ok(list.every((e) => e.exerciseType === "weight_reps" || e.exerciseType === "assisted_bodyweight"));
  });
  it("fat-loss bucket is conditioning only", () => {
    const slugs = bySlug(exercisesForGoal("LOSE_WEIGHT"));
    assert.ok(slugs.length >= 10, `expected a usable conditioning pool, got ${slugs.length}`);
    assert.ok(slugs.includes("burpee"));
    assert.ok(!slugs.includes("bench-press"));
  });
  it("search narrows within the goal bucket", () => {
    const hits = bySlug(exercisesForGoal("BUILD_MUSCLE", "curl"));
    assert.ok(hits.length > 0);
    assert.ok(hits.every((s) => s.includes("curl")));
  });
});

describe("autoFillForGoal", () => {
  it("returns 6 distinct slugs spread across muscles", () => {
    const picks = autoFillForGoal("BUILD_MUSCLE", 6);
    assert.equal(picks.length, 6);
    assert.equal(new Set(picks).size, 6);
    const muscles = picks.map((s) => guideBySlug(s).primaryMuscle);
    assert.ok(new Set(muscles).size >= 3, `expected muscle spread, got ${muscles.join(",")}`);
  });
  it("fat-loss auto-fill is conditioning only", () => {
    const picks = autoFillForGoal("LOSE_WEIGHT", 6);
    assert.equal(picks.length, 6);
    assert.ok(picks.every((s) => goalMatchesExercise("LOSE_WEIGHT", guideBySlug(s))));
  });
});

describe("planExerciseFromGuide + goalTypeToTag", () => {
  it("maps hold vs rep exercises to plan rows", () => {
    const hold = planExerciseFromGuide(guideBySlug("plank"));
    assert.equal(hold.durationSeconds, 45);
    assert.equal(hold.reps, null);
    const rep = planExerciseFromGuide(guideBySlug("push-up"));
    assert.equal(rep.reps, "10");
    assert.equal(rep.sets, 3);
  });
  it("mirrors the backend goal->tag mapping", () => {
    assert.equal(goalTypeToTag("LOSE_WEIGHT"), "Fat Loss");
    assert.equal(goalTypeToTag("BUILD_MUSCLE"), "Strength");
    assert.equal(goalTypeToTag("GAIN_WEIGHT"), "Strength");
    assert.equal(goalTypeToTag("PERFORMANCE"), "Performance");
    assert.equal(goalTypeToTag("MAINTAIN_WEIGHT"), "General");
  });
});
