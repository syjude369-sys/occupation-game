import test from "node:test";
import assert from "node:assert/strict";
import {
  connectedGroupsAtLeast,
  shouldSkipTerritoryCandidate
} from "./territory.js";

test("territory candidate is skipped when it is closer to own cells than opponents", () => {
  const occupied = new Map([
    ["1,1", 0],
    ["5,1", 1]
  ]);

  assert.equal(shouldSkipTerritoryCandidate("2,1", 0, occupied, {
    enabled: true,
    turn: 10,
    startTurn: 10
  }), true);
});

test("territory skipping does not run before the configured start turn", () => {
  const occupied = new Map([
    ["1,1", 0],
    ["5,1", 1]
  ]);

  assert.equal(shouldSkipTerritoryCandidate("2,1", 0, occupied, {
    enabled: true,
    turn: 9,
    startTurn: 10
  }), false);
});

test("territory skipping remains optional and keeps contested candidates", () => {
  const occupied = new Map([
    ["1,1", 0],
    ["3,1", 1]
  ]);

  assert.equal(shouldSkipTerritoryCandidate("2,1", 0, occupied, {
    enabled: false,
    turn: 20,
    startTurn: 10
  }), false);
  assert.equal(shouldSkipTerritoryCandidate("2,1", 0, occupied, {
    enabled: true,
    turn: 20,
    startTurn: 10
  }), false);
});

test("connected groups protect every cell when group size reaches threshold", () => {
  const occupied = new Map([
    ["1,1", 0],
    ["2,1", 0],
    ["2,2", 0],
    ["3,2", 0],
    ["7,7", 0],
    ["8,8", 1]
  ]);

  assert.deepEqual(
    [...connectedGroupsAtLeast(occupied, 4)].sort(),
    ["1,1", "2,1", "2,2", "3,2"]
  );
});

test("connected group threshold is adjustable", () => {
  const occupied = new Map([
    ["1,1", 0],
    ["2,1", 0],
    ["3,1", 0]
  ]);

  assert.equal(connectedGroupsAtLeast(occupied, 4).size, 0);
  assert.equal(connectedGroupsAtLeast(occupied, 3).size, 3);
});
