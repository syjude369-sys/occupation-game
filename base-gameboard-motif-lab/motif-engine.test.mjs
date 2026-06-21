import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL,
  uniqueOrientations,
  matchMotifAt,
  allocateMatches,
  motifFitness,
  hasFrontage,
  discoverPatterns,
  findPatternOccurrences,
  selectedMotifOccurrences
} from "./motif-engine.js";

const board = (size, rows) => ({ size, cells: rows.flatMap((row) => [...row].map((v) => v === "#" ? 1 : 0)) });
const motif = (rows, extra = {}) => ({
  id: "m",
  name: "test",
  width: rows[0].length,
  height: rows.length,
  cells: rows.flatMap((row) => [...row].map((v) => ({ ".": CELL.IGNORE, "#": CELL.REQUIRED, "?": CELL.OPTIONAL, "o": CELL.EMPTY }[v]))),
  weight: 50,
  minCompletion: 0.5,
  enabled: true,
  ...extra
});

test("required empty rejects a match", () => {
  const ring = motif(["###", "#o#", "###"]);
  assert.equal(matchMotifAt(board(3, ["###", "###", "###"]), ring, 0, 0), null);
});

test("partial occupied cells produce completion", () => {
  const line = motif(["####"], { minCompletion: 0.5 });
  assert.equal(matchMotifAt(board(4, ["##..", "....", "....", "...."]), line, 0, 0).completion, 0.5);
});

test("rotations and reflections are deduplicated", () => {
  assert.equal(uniqueOrientations(motif(["###", "#.."])).length, 8);
  assert.equal(uniqueOrientations(motif(["##", "##"])).length, 1);
});

test("2x2 frontage requires one clear adjacent side", () => {
  assert.equal(hasFrontage(board(4, ["....", ".##.", ".##.", "...."]), 1, 1), true);
  assert.equal(hasFrontage(board(4, [".##.", "####", "####", ".##."]), 1, 1), false);
});

test("allocation prevents occupied-cell reuse", () => {
  const matches = [
    { motifId: "large", completion: 1, targetCount: 4, weight: 30, occupiedKeys: ["0,0", "1,0", "0,1", "1,1"] },
    { motifId: "small", completion: 1, targetCount: 2, weight: 100, occupiedKeys: ["0,0", "1,0"] }
  ];
  assert.deepEqual(allocateMatches(matches).map((m) => m.motifId), ["large"]);
});

test("motif fitness respects positive and negative weights", () => {
  const result = motifFitness([
    { motifId: "good", completion: 1, center: [1, 1] },
    { motifId: "bad", completion: 1, center: [2, 2] }
  ], [
    { id: "good", weight: 100 },
    { id: "bad", weight: -50 }
  ], 4);
  assert.ok(result > 0);
});

test("discovery obeys minimum size and sample cap", () => {
  const found = discoverPatterns(board(6, ["......", ".####.", ".####.", ".####.", "......", "......"]), {
    minSize: 6,
    maxSize: 10,
    sampleLimit: 3,
    windowSize: 5
  });
  assert.ok(found.length <= 3);
  assert.ok(found.every((item) => item.occupiedCount >= 6));
});

test("discovery retains whole connected components beyond the local maximum", () => {
  const found = discoverPatterns(board(6, ["......", ".####.", ".####.", ".####.", ".####.", "......"]), {
    minSize: 6,
    maxSize: 10,
    sampleLimit: 10,
    windowSize: 3
  });
  assert.ok(found.some((item) => item.occupiedCount === 16 && item.source === "component"));
});

test("finds discovered pattern occurrences on a selected board", () => {
  const found = findPatternOccurrences(
    board(5, [".....", ".##..", "..#..", ".##..", "....."]),
    { width: 2, height: 2, cells: [1, 1, 0, 1] }
  );

  assert.deepEqual(found.map((match) => match.occupiedKeys.sort()), [
    ["1,1", "2,1", "2,2"],
    ["1,3", "2,2", "2,3"]
  ]);
});

test("selects enabled motif occurrences for board overlay", () => {
  const matches = selectedMotifOccurrences(
    board(4, ["####", "....", "....", "...."]),
    [
      motif(["####"], { id: "enabled", enabled: true, minCompletion: 1 }),
      motif(["####"], { id: "disabled", enabled: false, minCompletion: 1 })
    ]
  );

  assert.deepEqual(matches.map((match) => match.motifId), ["enabled"]);
});
