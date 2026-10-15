// Plan exercise names (free text) resolve to countable workout ids.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveExerciseName } from "../../src/features/CameraWorkout/constants/workoutGuide.js";

describe("resolveExerciseName", () => {
  it("resolves guide slugs directly", () => {
    assert.equal(resolveExerciseName("push-up"), "push-up");
    assert.equal(resolveExerciseName("dumbbell-bench-press"), "dumbbell-bench-press");
  });
  it("resolves guide display names", () => {
    assert.equal(resolveExerciseName("Dumbbell Bench Press"), "dumbbell-bench-press");
    assert.equal(resolveExerciseName("Bench Press"), "bench-press");
  });
  it("resolves legacy starter names incl. plurals and prefixes", () => {
    assert.equal(resolveExerciseName("Push-Ups"), "pushup");
    assert.equal(resolveExerciseName("Bodyweight Squats"), "squat");
    assert.equal(resolveExerciseName("Jumping Jacks"), "jumpingjack");
    assert.equal(resolveExerciseName("High Knees"), "high-knees");
    assert.equal(resolveExerciseName("Mountain Climbers"), "mountainclimb");
    assert.equal(resolveExerciseName("Plank"), "plank");
    assert.equal(resolveExerciseName("Glute Bridge"), "glute-bridge");
  });
  it("returns null for stretches and unknown names", () => {
    assert.equal(resolveExerciseName("Cat-Cow"), null);
    assert.equal(resolveExerciseName("Deep Breathing"), null);
    assert.equal(resolveExerciseName("Not A Real Move"), null);
    assert.equal(resolveExerciseName(""), null);
    assert.equal(resolveExerciseName(null), null);
  });
});
