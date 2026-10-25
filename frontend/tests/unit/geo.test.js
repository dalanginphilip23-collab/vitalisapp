// Activity Map GPS logic — pure unit tests (no DOM, no deps, node --test).
// Covers src/features/ActivityMap/utils/geo.js: distance, fix filtering
// (accuracy/duplicate/jump) and honest pace formatting.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMeters,
  evaluateFix,
  formatPace,
  DEFAULT_GATES,
} from "../../src/features/ActivityMap/utils/geo.js";

describe("haversineMeters", () => {
  it("is ~0 for identical points", () => {
    assert.equal(haversineMeters([14.676, 121.043], [14.676, 121.043]), 0);
  });
  it("matches a known ~111m latitude step", () => {
    // 0.001° latitude ≈ 111.2 m on the sphere.
    const d = haversineMeters([0, 0], [0.001, 0]);
    assert.ok(d > 110 && d < 112, `expected ~111m, got ${d}`);
  });
  it("is symmetric", () => {
    const a = [14.67, 121.04];
    const b = [14.68, 121.05];
    assert.ok(
      Math.abs(haversineMeters(a, b) - haversineMeters(b, a)) < 1e-6,
    );
  });
});

describe("evaluateFix", () => {
  const t0 = 1_700_000_000_000;

  it("rejects non-finite coordinates", () => {
    assert.equal(evaluateFix(null, { lat: NaN, lng: 1, accuracy: 5 }, t0).reason, "invalid");
    assert.equal(evaluateFix(null, null, t0).reason, "invalid");
  });

  it("rejects fixes worse than the accuracy gate", () => {
    const r = evaluateFix(null, { lat: 1, lng: 1, accuracy: DEFAULT_GATES.maxAccuracyM + 1 }, t0);
    assert.equal(r.accept, false);
    assert.equal(r.reason, "accuracy");
  });

  it("accepts a first plausible fix", () => {
    const r = evaluateFix(null, { lat: 14.676, lng: 121.043, accuracy: 10 }, t0);
    assert.equal(r.accept, true);
    assert.equal(r.reason, "ok");
  });

  it("rejects duplicate / sub-metre jitter", () => {
    const prev = { lat: 14.676, lng: 121.043, t: t0 };
    const r = evaluateFix(prev, { lat: 14.6760001, lng: 121.043, accuracy: 8 }, t0 + 1000);
    assert.equal(r.accept, false);
    assert.equal(r.reason, "duplicate");
  });

  it("rejects teleport-style jumps", () => {
    const prev = { lat: 14.676, lng: 121.043, t: t0 };
    // ~0.01° lat ≈ 1.1 km in 1s → far above the speed gate.
    const r = evaluateFix(prev, { lat: 14.686, lng: 121.043, accuracy: 8 }, t0 + 1000);
    assert.equal(r.accept, false);
    assert.equal(r.reason, "jump");
  });

  it("accepts a believable running step (~8m in 3s)", () => {
    const prev = { lat: 14.6760, lng: 121.0430, t: t0 };
    const r = evaluateFix(prev, { lat: 14.67607, lng: 121.0430, accuracy: 9 }, t0 + 3000);
    assert.equal(r.accept, true);
  });

  it("honours custom gates", () => {
    const prev = { lat: 0, lng: 0, t: t0 };
    const gates = { maxAccuracyM: 5, minMoveM: 0.1, maxSpeedMps: 100 };
    // ~55 m in 1 s → under the custom speed gate; accuracy 5 is within, 6 is not.
    assert.equal(evaluateFix(prev, { lat: 0.0005, lng: 0, accuracy: 5 }, t0 + 1000, gates).accept, true);
    assert.equal(evaluateFix(prev, { lat: 0.0005, lng: 0, accuracy: 6 }, t0 + 1000, gates).reason, "accuracy");
  });
});

describe("formatPace", () => {
  it("returns – when distance is zero or missing", () => {
    assert.equal(formatPace(120, 0), "–");
    assert.equal(formatPace(120, undefined), "–");
    assert.equal(formatPace(120, NaN), "–");
  });
  it("formats minutes per km as m'ss\"", () => {
    // 1 km in 300s = 5:00 /km
    assert.equal(formatPace(300, 1), "5'00\"");
    // 2 km in 700s = 5:50 /km
    assert.equal(formatPace(700, 2), "5'50\"");
  });
});
