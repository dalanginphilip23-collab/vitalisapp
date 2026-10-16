// Pure GPS math tests for src/features/ActivityMap/lib/runMath.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  haversineDistanceM,
  acceptSegment,
  acceptLegacySegment,
  settleDecision,
  MAX_RUN_SPEED_MPS,
} from "../../src/features/ActivityMap/lib/runMath.js";

describe("haversineDistanceM", () => {
  it("measures ~111.19km per degree of latitude", () => {
    const m = haversineDistanceM([14.6760, 121.0437], [15.6760, 121.0437]);
    assert.ok(Math.abs(m - 111190) < 500, `got ${m}`);
  });
  it("returns 0 for identical points and garbage", () => {
    assert.equal(haversineDistanceM([14.6, 121.0], [14.6, 121.0]), 0);
    assert.equal(haversineDistanceM(null, [14.6, 121.0]), 0);
    assert.equal(haversineDistanceM(["x", 1], [14.6, 121.0]), 0);
  });
  it("accepts { lat, lng } objects like server payloads", () => {
    const m = haversineDistanceM({ lat: 14.6760, lng: 121.0437 }, { lat: 14.6761, lng: 121.0437 });
    assert.ok(m > 5 && m < 20, `got ${m}`);
  });
});

describe("acceptSegment (speed-gated)", () => {
  it("accepts a normal running stride (3m in 1s)", () => {
    assert.deepEqual(acceptSegment({ deltaM: 3, dtSec: 1 }), { ok: true, reason: "ok" });
  });
  it("accepts a slow-but-real leg over a slow fix interval (15m in 5s)", () => {
    assert.deepEqual(acceptSegment({ deltaM: 15, dtSec: 5 }), { ok: true, reason: "ok" });
  });
  it("accepts a legit long leg the old filter dropped (60m in 5s = 12 m/s)", () => {
    assert.deepEqual(acceptSegment({ deltaM: 60, dtSec: 5 }), { ok: true, reason: "ok" });
  });
  it("rejects teleports the old filter counted (3x40m burst in one tick)", () => {
    // 120m in 1s = 432 km/h — old distance-only gate counted every 40m leg.
    assert.deepEqual(acceptSegment({ deltaM: 120, dtSec: 1 }), { ok: false, reason: "teleport" });
  });
  it("rejects GPS jitter under 1m", () => {
    assert.deepEqual(acceptSegment({ deltaM: 0.4, dtSec: 1 }), { ok: false, reason: "jitter" });
  });
  it("rejects stale jumps after signal loss (500m over 60s gap)", () => {
    assert.deepEqual(acceptSegment({ deltaM: 500, dtSec: 60 }), { ok: false, reason: "stale-gap" });
  });
  it("rejects missing/non-positive time", () => {
    assert.deepEqual(acceptSegment({ deltaM: 10, dtSec: 0 }), { ok: false, reason: "no-time" });
    assert.deepEqual(acceptSegment({ deltaM: 10, dtSec: NaN }), { ok: false, reason: "no-time" });
  });
  it(`caps speed at ${MAX_RUN_SPEED_MPS} m/s`, () => {
    assert.equal(acceptSegment({ deltaM: 19, dtSec: 1 }).ok, true);
    assert.equal(acceptSegment({ deltaM: 21, dtSec: 1 }).ok, false);
  });
});

describe("acceptLegacySegment", () => {
  it("preserves the old 1m < d < 50m gate for timestamp-less paths", () => {
    assert.equal(acceptLegacySegment(10), true);
    assert.equal(acceptLegacySegment(0.5), false);
    assert.equal(acceptLegacySegment(60), false);
    assert.equal(acceptLegacySegment(NaN), false);
  });
});

describe("settleDecision", () => {
  it("skips unsettled fixes until accuracy locks, bounded by budget", () => {
    assert.deepEqual(settleDecision(30, 5), { skip: true, budget: 4 });
    assert.deepEqual(settleDecision(null, 5), { skip: true, budget: 4 });
    assert.deepEqual(settleDecision(8, 4), { skip: false, budget: 0 });
  });
  it("stops skipping once budget is exhausted or locked", () => {
    assert.deepEqual(settleDecision(99, 0), { skip: false, budget: 0 });
    assert.deepEqual(settleDecision(99, 1), { skip: true, budget: 0 });
  });
});
