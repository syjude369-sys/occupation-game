import test from "node:test";
import assert from "node:assert/strict";
import { simulateFinalState } from "./form-simulation.js";

const settings = {
  size: 11,
  players: 4,
  turns: 20,
  cellCap: 30,
  rook: 40,
  bishop: 35,
  knight: 25,
  attack: 45
};

test("same settings and seed produce the same final state", () => {
  assert.deepEqual(simulateFinalState(settings, 123), simulateFinalState(settings, 123));
});

test("simulation returns a bounded board with valid player labels", () => {
  const result = simulateFinalState(settings, 7);
  assert.equal(result.size, 11);
  assert.equal(result.cells.length, 121);
  assert.ok(result.cells.every((cell) => cell >= -1 && cell < 4));
});

test("different rule weights can produce different final states", () => {
  const rook = simulateFinalState({ ...settings, rook: 100, bishop: 0, knight: 0 }, 9);
  const knight = simulateFinalState({ ...settings, rook: 0, bishop: 0, knight: 100 }, 9);
  assert.notDeepEqual(rook.cells, knight.cells);
});
