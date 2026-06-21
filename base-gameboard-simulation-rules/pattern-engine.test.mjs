import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRecurrence,
  activeMotifFitness,
  canonicalizeBinaryPattern,
  classifyVoidStructure,
  computePatternScore,
  defaultPatternSettings,
  extractRegionMotifs,
  extractSlidingWindows,
  mergeDiscoveredPatterns,
  suppressNestedOccurrences,
  trackTemporalEpisodes
} from "./pattern-engine.js";

const board = (rows) => ({
  size: rows.length,
  cells: rows.flatMap((row) => [...row].map((cell) => cell === "#" ? 1 : 0))
});

test("default pattern settings expose interval discovery controls and weights", () => {
  const settings = defaultPatternSettings();

  assert.equal(settings.patternSearchIntervalTurns, 5);
  assert.deepEqual(settings.windowSizes, [{ width: 2, height: 2 }, { width: 3, height: 3 }, { width: 4, height: 4 }, { width: 5, height: 5 }]);
  assert.equal(settings.minOccupiedCount, 3);
  assert.equal(settings.minOccupancyRatio, 1 / 3);
  assert.equal(settings.recurrenceWeights.withinBoard, 0.3);
  assert.equal(settings.discovery.slidingWindow, true);
  assert.equal(settings.discovery.regionBased, true);
});

test("sliding windows preserve occupied and empty cells inside the window", () => {
  const items = extractSlidingWindows(board([
    "#..",
    ".#.",
    "..."
  ]), { windowSizes: [{ width: 2, height: 2 }], minOccupiedCount: 1, minOccupancyRatio: 0.2, maxOccupancyRatio: 0.8 });

  assert.ok(items.some((item) =>
    item.originX === 0 &&
    item.originY === 0 &&
    item.width === 2 &&
    item.height === 2 &&
    item.cells.join("") === "OEEO"
  ));
});

test("sliding windows reject all-empty and overfilled windows", () => {
  const items = extractSlidingWindows(board([
    "##.",
    "##.",
    "..."
  ]), { windowSizes: [{ width: 2, height: 2 }], minOccupancyRatio: 0.2, maxOccupancyRatio: 0.8 });

  assert.equal(items.some((item) => item.cells.every((cell) => cell === "E")), false);
  assert.equal(items.some((item) => item.originX === 0 && item.originY === 0), false);
});

test("sliding windows require at least three occupied cells and one third occupancy", () => {
  const items = extractSlidingWindows(board([
    "#..",
    ".#.",
    "..."
  ]), { windowSizes: [{ width: 3, height: 3 }], minOccupiedCount: 3, minOccupancyRatio: 1 / 3, maxOccupancyRatio: 1 });

  assert.equal(items.length, 0);
});

test("region motifs require at least three occupied cells and one third occupancy", () => {
  const items = extractRegionMotifs(board([
    "....",
    ".#..",
    "..#.",
    "...."
  ]), { minOccupiedCount: 3, minOccupancyRatio: 1 / 3, maxRegionArea: 16 });

  assert.equal(items.length, 0);
});

test("region motifs include enclosed empty cells but not exterior adjacent empties", () => {
  const items = extractRegionMotifs(board([
    ".....",
    ".###.",
    ".#.#.",
    ".###.",
    "....."
  ]), { maxRegionArea: 25, maxOccupancyRatio: 1 });

  assert.equal(items.length, 1);
  assert.equal(items[0].width, 3);
  assert.equal(items[0].height, 3);
  assert.equal(items[0].cells.join(""), "OOO" + "OEO" + "OOO");
});

test("canonical identity treats rotations and reflections as equivalent", () => {
  const a = canonicalizeBinaryPattern({ width: 2, height: 3, cells: ["O", "E", "O", "O", "E", "E"] });
  const b = canonicalizeBinaryPattern({ width: 3, height: 2, cells: ["O", "O", "E", "E", "O", "E"] });

  assert.equal(a.signature, b.signature);
});

test("nested suppression keeps the larger valid occurrence", () => {
  const kept = suppressNestedOccurrences([
    { id: "small", coveredKeys: ["1,1", "2,1"] },
    { id: "large", coveredKeys: ["1,1", "2,1", "1,2", "2,2"] },
    { id: "elsewhere", coveredKeys: ["4,4"] }
  ]);

  assert.deepEqual(kept.map((item) => item.id), ["large", "elsewhere"]);
});

test("nested suppression preserves an inner occurrence when it has orthogonal empty access", () => {
  const kept = suppressNestedOccurrences([
    { id: "inner-accessible", coveredKeys: ["1,1", "2,1"], externallyAccessible: true, accessibleBoundaryInterfaces: 1 },
    { id: "large", coveredKeys: ["1,1", "2,1", "1,2", "2,2"] }
  ]);

  assert.deepEqual(kept.map((item) => item.id), ["large", "inner-accessible"]);
});

test("nested suppression still removes an inner occurrence with no empty access", () => {
  const kept = suppressNestedOccurrences([
    { id: "inner-blocked", coveredKeys: ["1,1", "2,1"], externallyAccessible: false, accessibleBoundaryInterfaces: 0 },
    { id: "large", coveredKeys: ["1,1", "2,1", "1,2", "2,2"] }
  ]);

  assert.deepEqual(kept.map((item) => item.id), ["large"]);
});

test("pattern score uses adjustable reading-criteria weights", () => {
  const score = computePatternScore({
    recurrence: { score: 0.2 },
    distinctiveness: { score: 0.8 },
    canonical: { symmetryScore: 0.5 },
    voidStructure: { connectivityScore: 0.4 }
  }, {
    recurrence: 0,
    distinctiveness: 1,
    symmetry: 0,
    void: 0
  });

  assert.equal(score.totalMotifScore, 0.8);
  assert.equal(score.scoreBreakdown.distinctiveness, 0.8);
});

test("temporal tracking merges consecutive checkpoint detections into one episode", () => {
  const archive = trackTemporalEpisodes([
    { runId: "a", turn: 5, checkpointIndex: 0, signature: "sig", placementKey: "1,1", coveredKeys: ["1,1"] },
    { runId: "a", turn: 10, checkpointIndex: 1, signature: "sig", placementKey: "1,1", coveredKeys: ["1,1"] },
    { runId: "a", turn: 20, checkpointIndex: 3, signature: "sig", placementKey: "1,1", coveredKeys: ["1,1"] }
  ]);

  assert.equal(archive[0].detectionCount, 3);
  assert.equal(archive[0].episodeCount, 2);
  assert.equal(archive[0].durationSteps, 3);
  assert.equal(archive[0].firstSeenTurn, 5);
  assert.equal(archive[0].lastSeenTurn, 20);
});

test("recurrence aggregation keeps within-board cross-seed and cross-genome scores separate", () => {
  const recurrence = aggregateRecurrence([
    { signature: "sig", runId: "g1-s1", seed: 1, genomeId: "g1", episodeCount: 2 },
    { signature: "sig", runId: "g1-s2", seed: 2, genomeId: "g1", episodeCount: 1 },
    { signature: "sig", runId: "g2-s1", seed: 1, genomeId: "g2", episodeCount: 1 }
  ], { totalRuns: 4, totalSeeds: 2, totalGenomes: 2 });

  assert.equal(recurrence.sig.withinBoardScore, 1);
  assert.equal(recurrence.sig.crossSeedScore, 1);
  assert.equal(recurrence.sig.crossGenomeScore, 1);
});

test("void classification distinguishes connected enclosed voids", () => {
  const result = classifyVoidStructure({
    width: 3,
    height: 3,
    cells: ["O", "O", "O", "O", "E", "O", "O", "O", "O"],
    originX: 1,
    originY: 1
  }, board([
    ".....",
    ".###.",
    ".#.#.",
    ".###.",
    "....."
  ]));

  assert.equal(result.emptyComponentCount, 1);
  assert.equal(result.classification, "connected + no exterior contact");
  assert.ok(result.connectivityScore >= 0 && result.connectivityScore <= 1);
});

test("archive merge combines methods and keeps fitness inactive by default", () => {
  const [sliding] = extractSlidingWindows(board([
    "#..",
    ".#.",
    "..."
  ]), { windowSizes: [{ width: 2, height: 2 }], minOccupancyRatio: 0.2, maxOccupancyRatio: 0.8 });
  const archive = mergeDiscoveredPatterns([], [
    { ...sliding, methods: ["sliding"], totalMotifScore: 0.4 },
    { ...sliding, methods: ["region"], totalMotifScore: 0.6 }
  ]);

  assert.equal(archive.length, 1);
  assert.deepEqual(archive[0].methods.sort(), ["region", "sliding"]);
  assert.equal(archive[0].fitnessActive, false);
  assert.equal(archive[0].totalMotifScore, 0.6);
});

test("archive merge preserves continuity counts across tests and turns", () => {
  const archive = mergeDiscoveredPatterns([
    {
      signature: "sig",
      methods: ["sliding"],
      detectionCount: 2,
      episodeCount: 1,
      durationSteps: 2,
      firstSeenTurn: 5,
      lastSeenTurn: 10,
      runs: ["g1-seed-0"],
      seeds: [101],
      genomes: ["g1"]
    }
  ], [
    {
      signature: "sig",
      methods: ["region"],
      detectionCount: 3,
      episodeCount: 2,
      durationSteps: 3,
      firstSeenTurn: 15,
      lastSeenTurn: 25,
      runs: ["g1-seed-1"],
      seeds: [202],
      genomes: ["g1"]
    }
  ]);

  assert.equal(archive[0].detectionCount, 5);
  assert.equal(archive[0].episodeCount, 3);
  assert.equal(archive[0].durationSteps, 5);
  assert.equal(archive[0].firstSeenTurn, 5);
  assert.equal(archive[0].lastSeenTurn, 25);
  assert.deepEqual(archive[0].runs.sort(), ["g1-seed-0", "g1-seed-1"]);
  assert.deepEqual(archive[0].seeds.sort((a, b) => a - b), [101, 202]);
  assert.deepEqual(archive[0].genomes, ["g1"]);
});

test("active motif fitness ignores archived motifs until Fitness Active is enabled", () => {
  const motifs = [
    { signature: "off", fitnessActive: false, totalMotifScore: 1, episodeCount: 10 },
    { signature: "on", fitnessActive: true, totalMotifScore: 0.5, episodeCount: 2 }
  ];

  assert.equal(activeMotifFitness(motifs), 0.5);
});

test("active motif fitness applies per-motif fitness weights", () => {
  const motifs = [
    { signature: "light", fitnessActive: true, totalMotifScore: 0.2, fitnessWeight: 1 },
    { signature: "heavy", fitnessActive: true, totalMotifScore: 0.8, fitnessWeight: 3 }
  ];

  assert.equal(activeMotifFitness(motifs), 0.65);
});
