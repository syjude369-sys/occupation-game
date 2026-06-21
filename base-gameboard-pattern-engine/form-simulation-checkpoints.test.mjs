import test from "node:test";
import assert from "node:assert/strict";
import { simulateCheckpoints, simulateFinalState } from "./form-simulation.js";

const settings = {
  size: 9,
  players: 3,
  turns: 12,
  cellCap: 18,
  rook: 55,
  bishop: 25,
  knight: 20,
  attack: 10
};

test("simulation checkpoints include every interval and the final turn", () => {
  const checkpoints = simulateCheckpoints(settings, 77, { interval: 5 });

  assert.deepEqual(checkpoints.map((item) => item.turn), [5, 10, 12]);
  assert.deepEqual(checkpoints.at(-1).state, simulateFinalState(settings, 77));
});

test("simulation checkpoints are deterministic for the same seed", () => {
  assert.deepEqual(
    simulateCheckpoints(settings, 123, { interval: 4 }),
    simulateCheckpoints(settings, 123, { interval: 4 })
  );
});
