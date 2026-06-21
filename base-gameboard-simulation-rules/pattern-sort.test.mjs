import test from "node:test";
import assert from "node:assert/strict";
import { patternSortOptions, sortPatterns } from "./pattern-sort.js";

const patterns = [
  { id: "a", durationSteps: 2, detectionCount: 8, episodeCount: 1, totalMotifScore: 0.4, occupiedCount: 6, width: 3, height: 2, firstSeenTurn: 5, lastSeenTurn: 15 },
  { id: "b", durationSteps: 9, detectionCount: 1, episodeCount: 3, totalMotifScore: 0.9, occupiedCount: 4, width: 2, height: 2, firstSeenTurn: 2, lastSeenTurn: 20 },
  { id: "c", durationSteps: 9, detectionCount: 4, episodeCount: 2, totalMotifScore: 0.2, occupiedCount: 9, width: 3, height: 3, firstSeenTurn: 8, lastSeenTurn: 9 }
];

test("pattern sort options expose duration score and frequency fields", () => {
  assert.ok(patternSortOptions.some((option) => option.id === "duration"));
  assert.ok(patternSortOptions.some((option) => option.id === "score"));
  assert.ok(patternSortOptions.some((option) => option.id === "detections"));
});

test("sortPatterns orders higher selected values first and keeps deterministic tie order", () => {
  assert.deepEqual(sortPatterns(patterns, "duration").map((item) => item.id), ["b", "c", "a"]);
  assert.deepEqual(sortPatterns(patterns, "detections").map((item) => item.id), ["a", "c", "b"]);
  assert.deepEqual(sortPatterns(patterns, "score").map((item) => item.id), ["b", "a", "c"]);
});

test("sortPatterns does not mutate the source list", () => {
  const source = patterns.slice();
  const result = sortPatterns(source, "occupied");

  assert.deepEqual(source.map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(result.map((item) => item.id), ["c", "a", "b"]);
});
