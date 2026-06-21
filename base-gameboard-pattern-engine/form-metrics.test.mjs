import test from "node:test";
import assert from "node:assert/strict";
import {
  continuityScore,
  interpenetrationScore,
  sharedBoundaryScore,
  occupancyBalanceScore,
  canonicalPattern,
  patternFrequency,
  evaluateState
} from "./form-metrics.js";

const state = (size, rows) => ({
  size,
  cells: rows.flatMap((row) => [...row].map((value) => value === "." ? -1 : Number(value)))
});

test("continuity rewards one connected territory per player", () => {
  const connected = state(4, ["0011", "0011", "0011", "0011"]);
  const fragmented = state(4, ["0101", "1010", "0101", "1010"]);
  assert.equal(continuityScore(connected), 1);
  assert.ok(continuityScore(fragmented) < 0.3);
});

test("interpenetration detects multiple players across local scales", () => {
  const separated = state(5, ["00011", "00011", "00011", "00011", "00011"]);
  const woven = state(5, ["00111", "00101", "01101", "01001", "01111"]);
  assert.ok(interpenetrationScore(woven, [3, 5]) > interpenetrationScore(separated, [3, 5]));
});

test("shared boundary measures unlike orthogonal occupied edges", () => {
  const separated = state(4, ["0011", "0011", "0011", "0011"]);
  const checker = state(4, ["0101", "1010", "0101", "1010"]);
  assert.ok(sharedBoundaryScore(checker) > sharedBoundaryScore(separated));
});

test("occupancy balance is one for equal areas and zero for monopoly", () => {
  assert.equal(occupancyBalanceScore(state(2, ["01", "01"]), 2), 1);
  assert.equal(occupancyBalanceScore(state(2, ["00", "00"]), 2), 0);
});

test("canonical pattern ignores rotation reflection and player labels", () => {
  const original = state(3, ["001", ".11", "..1"]);
  const rotatedRelabeled = state(3, ["..1", ".01", "000"]);
  assert.equal(canonicalPattern(original), canonicalPattern(rotatedRelabeled));
});

test("pattern frequency counts every equivalent occurrence", () => {
  const a = state(2, ["01", "11"]);
  const b = state(2, ["00", "01"]);
  const c = state(2, ["01", "10"]);
  const result = patternFrequency([a, b, c]);
  assert.equal(result.topCount, 2);
  assert.equal(result.distinctCount, 2);
  assert.equal(result.reproductionRate, 2 / 3);
});

test("evaluateState exposes the four spatial objective axes", () => {
  const result = evaluateState(state(4, ["0011", "0011", "0101", "0111"]), 2);
  assert.deepEqual(Object.keys(result), ["continuity", "interpenetration", "boundary", "balance"]);
  for (const value of Object.values(result)) assert.ok(value >= 0 && value <= 1);
});
