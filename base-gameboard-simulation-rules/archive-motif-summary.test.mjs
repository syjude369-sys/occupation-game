import test from "node:test";
import assert from "node:assert/strict";
import { CELL, findPatternOccurrences } from "./motif-engine.js";
import { summarizeArchiveMotifHits } from "./archive-motif-summary.js";

const board = { size: 4, cells: [1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0] };
const motifs = [
  { id: "m1", name: "Block", width: 2, height: 2, cells: [CELL.REQUIRED, CELL.REQUIRED, CELL.REQUIRED, CELL.REQUIRED], fitnessActive: true },
  { id: "m2", name: "Line", width: 2, height: 1, cells: [CELL.REQUIRED, CELL.REQUIRED], fitnessActive: false }
];

test("summarizeArchiveMotifHits counts only motif episodes that persist for the minimum turns", () => {
  const shiftedBoard = { size: 4, cells: [0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0] };
  const summary = summarizeArchiveMotifHits([
    { turn: 1, state: board },
    { turn: 3, state: board },
    { turn: 4, state: shiftedBoard }
  ], motifs, findPatternOccurrences, { minTurns: 3 });

  assert.equal(summary.totalHits, 11);
  assert.equal(summary.activeHits, 2);
  assert.equal(summary.uniqueMotifsHit, 2);
  assert.equal(summary.totalMotifs, 2);
  assert.deepEqual(summary.topHits.map((item) => [item.name, item.count, item.active]), [
    ["Line", 9, false],
    ["Block", 2, true]
  ]);
});

test("summarizeArchiveMotifHits handles missing checkpoints or motifs", () => {
  assert.deepEqual(summarizeArchiveMotifHits(null, motifs, findPatternOccurrences), {
    totalHits: 0,
    activeHits: 0,
    uniqueMotifsHit: 0,
    totalMotifs: 2,
    topHits: []
  });
  assert.equal(summarizeArchiveMotifHits([{ turn: 1, state: board }], [], findPatternOccurrences).totalMotifs, 0);
});
