import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMoveWeights,
  createSeededRandom,
  generateCandidate,
  aggregateRuns,
  dominates,
  paretoFront
} from "./form-search.js";

test("movement weights normalize to one", () => {
  assert.deepEqual(normalizeMoveWeights({ rook: 2, bishop: 1, knight: 1 }), {
    rook: 0.5,
    bishop: 0.25,
    knight: 0.25
  });
});

test("seeded candidate generation is deterministic", () => {
  assert.deepEqual(generateCandidate(createSeededRandom(42)), generateCandidate(createSeededRandom(42)));
});

test("aggregateRuns averages metrics and reports canonical stability", () => {
  const runs = [
    { metrics: { continuity: 1, interpenetration: 0.5, boundary: 0.4, balance: 1 }, pattern: "A", state: { id: 1 } },
    { metrics: { continuity: 0.8, interpenetration: 0.7, boundary: 0.6, balance: 0.8 }, pattern: "A", state: { id: 2 } },
    { metrics: { continuity: 0.6, interpenetration: 0.9, boundary: 0.8, balance: 0.6 }, pattern: "B", state: { id: 3 } }
  ];
  const result = aggregateRuns(runs);
  assert.ok(Math.abs(result.objectives.continuity - 0.8) < 1e-12);
  assert.equal(result.objectives.stability, 2 / 3);
  assert.equal(result.representative.id, 1);
});

test("dominance requires no worse objectives and one strictly better objective", () => {
  const strong = { continuity: 0.9, interpenetration: 0.7, boundary: 0.6, balance: 0.8, stability: 0.7 };
  const weak = { continuity: 0.8, interpenetration: 0.7, boundary: 0.5, balance: 0.8, stability: 0.6 };
  assert.equal(dominates(strong, weak), true);
  assert.equal(dominates(weak, strong), false);
});

test("paretoFront removes dominated candidates and preserves tradeoffs", () => {
  const candidates = [
    { id: "a", objectives: { continuity: 1, interpenetration: 0.4, boundary: 0.4, balance: 0.8, stability: 0.7 } },
    { id: "b", objectives: { continuity: 0.8, interpenetration: 0.8, boundary: 0.7, balance: 0.8, stability: 0.7 } },
    { id: "c", objectives: { continuity: 0.7, interpenetration: 0.6, boundary: 0.5, balance: 0.7, stability: 0.6 } }
  ];
  assert.deepEqual(paretoFront(candidates).map((item) => item.id).sort(), ["a", "b"]);
});
