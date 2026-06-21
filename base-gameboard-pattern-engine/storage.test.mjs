import test from "node:test";
import assert from "node:assert/strict";
import { defaultLabState, normalizeLabState, serializeLabState } from "./storage.js";

test("default state includes motifs objectives and generation", () => {
  const state = defaultLabState();
  assert.equal(state.version, 2);
  assert.equal(state.settings.cellCap, 25);
  assert.deepEqual(state.motifs, []);
  assert.equal(state.patternSettings.patternSearchIntervalTurns, 5);
  assert.ok(state.objectives.some((o) => o.id === "activePatternFitness"));
});

test("invalid data recovers safe defaults", () => {
  const result = normalizeLabState({ version: 99, motifs: "broken" });
  assert.equal(result.recovered, true);
  assert.equal(result.state.version, 2);
});

test("version 1 motif lab data migrates to pattern-engine defaults", () => {
  const result = normalizeLabState({
    version: 1,
    settings: { size: 11 },
    motifs: [{ id: "old", enabled: true }],
    objectives: [{ id: "motifFitness", enabled: true, direction: "max" }],
    archive: [{ id: "candidate" }],
    discovered: [{ signature: "sig", methods: ["sliding"] }]
  });

  assert.equal(result.recovered, false);
  assert.equal(result.state.version, 2);
  assert.equal(result.state.settings.size, 11);
  assert.deepEqual(result.state.motifs, []);
  assert.equal(result.state.discovered[0].fitnessActive, false);
  assert.ok(result.state.objectives.some((objective) => objective.id === "activePatternFitness"));
});

test("partial pattern settings are backfilled with default weight numbers", () => {
  const result = normalizeLabState({
    version: 2,
    settings: {},
    patternSettings: { scoreWeights: { recurrence: 0.9 } },
    motifs: [],
    objectives: [{ id: "activePatternFitness", enabled: true, direction: "max" }]
  });

  assert.deepEqual(result.state.patternSettings.scoreWeights, {
    recurrence: 0.9,
    distinctiveness: 0.35,
    symmetry: 0.2,
    void: 0.15
  });
});

test("archive retention bounds serialized state", () => {
  const state = defaultLabState();
  state.settings.archiveLimit = 2;
  state.archive = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const parsed = JSON.parse(serializeLabState(state));
  assert.deepEqual(parsed.archive.map((x) => x.id), [2, 3]);
});

test("serialized pattern state drops checkpoint-only discovery payload", () => {
  const state = defaultLabState();
  state.discovered = [{
    signature: "sig",
    originX: 3,
    originY: 4,
    width: 2,
    height: 2,
    cells: ["O", "E", "E", "O"],
    representativeBoard: { size: 2, cells: [0, -1, -1, 1] },
    archiveCandidateId: "candidate",
    coveredKeys: ["0,0", "1,0", "0,1", "1,1"],
    runId: "runtime",
    checkpointIndex: 2,
    methods: ["sliding"],
    durationSteps: 4,
    firstSeenTurn: 5,
    lastSeenTurn: 20,
    runs: ["candidate-seed-0", "candidate-seed-1"],
    seeds: [101, 202],
    genomes: ["candidate"],
    furniture: { status: "not_tested" }
  }];
  state.archive = [{
    id: "candidate",
    representative: { size: 2, cells: [0, -1, -1, 0] },
    discoveries: [{ signature: "sig", coveredKeys: ["0,0"] }]
  }];

  const parsed = JSON.parse(serializeLabState(state));

  assert.equal(parsed.discovered[0].coveredKeys, undefined);
  assert.equal(parsed.discovered[0].runId, undefined);
  assert.deepEqual(parsed.discovered[0].representativeBoard, { size: 2, cells: [0, -1, -1, 1] });
  assert.equal(parsed.discovered[0].originX, 3);
  assert.equal(parsed.discovered[0].archiveCandidateId, "candidate");
  assert.equal(parsed.discovered[0].durationSteps, 4);
  assert.equal(parsed.discovered[0].firstSeenTurn, 5);
  assert.equal(parsed.discovered[0].lastSeenTurn, 20);
  assert.deepEqual(parsed.discovered[0].runs, ["candidate-seed-0", "candidate-seed-1"]);
  assert.deepEqual(parsed.discovered[0].seeds, [101, 202]);
  assert.deepEqual(parsed.discovered[0].genomes, ["candidate"]);
  assert.equal(parsed.archive[0].discoveries, undefined);
});
