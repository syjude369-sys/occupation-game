import test from "node:test";
import assert from "node:assert/strict";
import {
  dynamicDominates,
  dynamicParetoFront,
  crossover,
  mutate,
  nextGeneration
} from "./evolution.js";
import { createSeededRandom } from "./form-search.js";

const objectives = [
  { id: "a", enabled: true, direction: "max" },
  { id: "b", enabled: false, direction: "max" }
];

test("dominance only uses enabled objectives", () => {
  assert.equal(dynamicDominates({ a: 1, b: 0 }, { a: 0, b: 1 }, objectives), true);
});

test("dynamic Pareto preserves enabled-axis tradeoffs", () => {
  const result = dynamicParetoFront([
    { id: "x", objectives: { a: 1, b: 0 } },
    { id: "y", objectives: { a: 0.5, b: 1 } }
  ], objectives);
  assert.deepEqual(result.map((x) => x.id), ["x"]);
});

test("crossover stays between parents", () => {
  const child = crossover({ rook: 10, bishop: 20, knight: 70, attack: 20 }, { rook: 50, bishop: 30, knight: 20, attack: 80 }, () => 0.5);
  assert.ok(child.attack >= 20 && child.attack <= 80);
  assert.ok(Math.abs(child.rook + child.bishop + child.knight - 100) < 1e-9);
});

test("mutation remains bounded and normalized", () => {
  const child = mutate({ rook: 40, bishop: 30, knight: 30, attack: 50 }, createSeededRandom(4), 20);
  assert.ok(child.attack >= 0 && child.attack <= 100);
  assert.ok(Math.abs(child.rook + child.bishop + child.knight - 100) < 1e-9);
});

test("next generation retains elite lineage and creates children", () => {
  const archive = [
    { id: "p1", generation: 0, pinned: true, excluded: false, params: { rook: 40, bishop: 30, knight: 30, attack: 50 }, objectives: { a: 1 } },
    { id: "p2", generation: 0, pinned: false, excluded: false, params: { rook: 20, bishop: 50, knight: 30, attack: 20 }, objectives: { a: 0.8 } }
  ];
  const children = nextGeneration(archive, objectives, { generation: 1, size: 5, eliteCount: 1, freshRate: 0.2, seed: 9 });
  assert.equal(children.length, 5);
  assert.ok(children.some((c) => c.parentIds.includes("p1")));
  assert.ok(children.every((c) => c.generation === 1));
});
