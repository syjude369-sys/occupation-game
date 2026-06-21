import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL,
  DEFAULT_SIMULATION_CONFIG,
  accessibilityPass,
  batchStats,
  candidateScores,
  createInitialState,
  detectTermination,
  fullStateHash,
  getMovementOffsets,
  lineOfSightPass,
  runSimulationTrial,
  resolveCellCapApprovals,
  resolveConflict,
  survivalResult,
  useGate
} from "./simulation-rules.js";

const occupied = (ownerId, extra = {}) => ({
  kind: CELL.OCCUPIED,
  ownerId,
  graceRemaining: 0,
  survivalFailureStreak: 0,
  ...extra
});

const empty = () => ({ kind: CELL.EMPTY });
const invalid = () => ({ kind: CELL.INVALID });

function state(size, entries = []) {
  const cells = Array.from({ length: size * size }, empty);
  for (const [x, y, cell] of entries) cells[y * size + x] = cell;
  return { size, cells };
}

test("movement offsets follow spec: 8 rook, 8 bishop, 8 knight, 24 unique", () => {
  const rook = getMovementOffsets("ROOK");
  const bishop = getMovementOffsets("BISHOP");
  const knight = getMovementOffsets("KNIGHT");
  const union = new Set([...rook, ...bishop, ...knight].map(([x, y]) => `${x},${y}`));

  assert.equal(rook.length, 8);
  assert.equal(bishop.length, 8);
  assert.equal(knight.length, 8);
  assert.equal(union.size, 24);
  assert.ok(rook.some(([x, y]) => x === 2 && y === 0));
  assert.ok(bishop.some(([x, y]) => x === -2 && y === -2));
  assert.ok(knight.some(([x, y]) => x === 2 && y === 1));
});

test("use gate rejects outside invalid own occupied and allows empty enemy occupied", () => {
  const board = state(3, [
    [0, 0, invalid()],
    [1, 1, occupied("A")],
    [2, 2, occupied("B")]
  ]);

  assert.equal(useGate(board, "A", { x: -1, y: 0 }).pass, false);
  assert.equal(useGate(board, "A", { x: 0, y: 0 }).pass, false);
  assert.equal(useGate(board, "A", { x: 1, y: 1 }).pass, false);
  assert.equal(useGate(board, "A", { x: 0, y: 1 }).pass, true);
  assert.equal(useGate(board, "A", { x: 2, y: 2 }).pass, true);
});

test("accessibility uses Manhattan and excludes enemy target from enemy distance", () => {
  const board = state(5, [
    [0, 0, occupied("A")],
    [4, 4, occupied("B")],
    [2, 0, occupied("B")]
  ]);
  const sameDistanceBoard = state(5, [
    [0, 0, occupied("A")],
    [4, 4, occupied("B")]
  ]);

  assert.equal(accessibilityPass(board, "A", { x: 0, y: 0 }, { x: 1, y: 0 }).pass, true);
  assert.equal(accessibilityPass(sameDistanceBoard, "A", { x: 0, y: 0 }, { x: 2, y: 2 }).pass, true);
  assert.equal(accessibilityPass(board, "A", { x: 0, y: 0 }, { x: 3, y: 4 }).pass, false);
  assert.equal(accessibilityPass(board, "A", { x: 0, y: 0 }, { x: 2, y: 0 }).pass, true);
});

test("visibility blocks enemy and invalid cells but not own or target cells", () => {
  assert.equal(lineOfSightPass(state(5), { x: 0, y: 0 }, { x: 4, y: 4 }, "A").pass, true);
  assert.equal(lineOfSightPass(state(5, [[2, 2, occupied("B")]]), { x: 0, y: 0 }, { x: 4, y: 4 }, "A").pass, false);
  assert.equal(lineOfSightPass(state(5, [[2, 2, invalid()]]), { x: 0, y: 0 }, { x: 4, y: 4 }, "A").pass, false);
  assert.equal(lineOfSightPass(state(5, [[2, 2, occupied("A")]]), { x: 0, y: 0 }, { x: 4, y: 4 }, "A").pass, true);
  assert.equal(lineOfSightPass(state(5, [[4, 4, occupied("B")]]), { x: 0, y: 0 }, { x: 4, y: 4 }, "A").pass, true);
});

test("candidate score applies distance cohesion aggression per discrete genome", () => {
  const board = state(5, [
    [1, 1, occupied("A")],
    [3, 2, occupied("A")],
    [2, 1, occupied("B")]
  ]);

  assert.deepEqual(candidateScores(board, {
    teamId: "A",
    movementMode: "ROOK",
    distanceMode: 0,
    cohesionEnabled: 1,
    aggressionEnabled: 1,
    source: { x: 1, y: 1 },
    target: { x: 2, y: 1 }
  }), { movementScore: 1, distanceScore: 1, cohesionScore: 1, aggressionScore: 1, candidateScore: 4 });

  assert.deepEqual(candidateScores(board, {
    teamId: "A",
    movementMode: "KNIGHT",
    distanceMode: 1,
    cohesionEnabled: 0,
    aggressionEnabled: 0,
    source: { x: 1, y: 1 },
    target: { x: 3, y: 2 }
  }), { movementScore: 1, distanceScore: 0, cohesionScore: 0, aggressionScore: 0, candidateScore: 1 });
});

test("candidate score treats movement distance cohesion and aggression as continuous tendencies", () => {
  const board = state(5, [
    [1, 1, occupied("A")],
    [2, 2, occupied("A")],
    [3, 1, occupied("B")]
  ]);

  assert.deepEqual(candidateScores(board, {
    teamId: "A",
    movementMode: "ROOK",
    movementWeights: { rook: 0.7, bishop: 0.2, knight: 0.1 },
    distanceMode: 0.25,
    distanceWeight: 0.8,
    cohesionWeight: 0.5,
    aggressionWeight: 0.9,
    source: { x: 1, y: 1 },
    target: { x: 3, y: 1 }
  }), { movementScore: 0.7, distanceScore: 0.2, cohesionScore: 0.5, aggressionScore: 0.9, candidateScore: 2.3 });

  assert.deepEqual(candidateScores(board, {
    teamId: "A",
    movementMode: "BISHOP",
    movementWeights: { rook: 0.7, bishop: 0.2, knight: 0.1 },
    distanceMode: 0.25,
    distanceWeight: 0.8,
    cohesionWeight: 0.5,
    aggressionWeight: 0.9,
    source: { x: 1, y: 1 },
    target: { x: 2, y: 2 }
  }), { movementScore: 0.2, distanceScore: 0.6, cohesionScore: 0, aggressionScore: 0, candidateScore: 0.8 });
});

test("weighted movement tendencies can choose bishop over rook without hard movement mode switching", () => {
  const result = runSimulationTrial({
    board: { size: 5, players: 2 },
    genome: {
      movementWeights: { rook: 0, bishop: 1, knight: 0 },
      distanceMode: 0,
      distanceWeight: 0,
      cohesionWeight: 0,
      aggressionWeight: 0
    },
    seed: 12,
    config: { maxTurns: 1, perTeamCellCap: 20 },
    checkpointInterval: 1
  });

  assert.equal(result.finalState.cells[1 * 5 + 4], 0);
  assert.equal(result.finalState.cells[3 * 5 + 0], 1);
});

test("survival handles min max enemy pressure grace release delay and recovery", () => {
  const board = state(3, [
    [1, 1, occupied("A", { graceRemaining: 0, survivalFailureStreak: 1 })],
    [0, 0, occupied("A")],
    [2, 2, occupied("B")]
  ]);

  const fail = survivalResult(board, { x: 1, y: 1 }, { ...DEFAULT_SIMULATION_CONFIG, survivalMin: 1, releaseDelay: 2 });
  assert.equal(fail.effectiveSupport, 0);
  assert.equal(fail.scheduledForRelease, true);
  assert.equal(fail.proposedBeforeRelease, true);

  const grace = survivalResult(state(3, [[1, 1, occupied("A", { graceRemaining: 1, survivalFailureStreak: 1 })]]), { x: 1, y: 1 }, DEFAULT_SIMULATION_CONFIG);
  assert.equal(grace.inGrace, true);
  assert.equal(grace.scheduledForRelease, false);

  const pass = survivalResult(state(3, [[1, 1, occupied("A", { survivalFailureStreak: 1 })], [0, 0, occupied("A")], [0, 1, occupied("A")]]), { x: 1, y: 1 }, DEFAULT_SIMULATION_CONFIG);
  assert.equal(pass.failureStreakAfter, 0);
});

test("conflict resolves accessibility before visibility before deterministic random", () => {
  const accessibility = resolveConflict({
    targetCellId: "2,2",
    claims: [
      { teamId: "A", sourceCells: [{ x: 1, y: 2 }], visibleSupportCount: 0 },
      { teamId: "B", sourceCells: [{ x: 0, y: 2 }], visibleSupportCount: 10 }
    ],
    seed: 7,
    stateHash: "s"
  });
  assert.equal(accessibility.winnerTeamId, "A");
  assert.equal(accessibility.resolvedBy, "ACCESSIBILITY");

  const visibility = resolveConflict({
    targetCellId: "2,2",
    claims: [
      { teamId: "A", sourceCells: [{ x: 1, y: 2 }], visibleSupportCount: 1 },
      { teamId: "B", sourceCells: [{ x: 3, y: 2 }], visibleSupportCount: 2 }
    ],
    seed: 7,
    stateHash: "s"
  });
  assert.equal(visibility.winnerTeamId, "B");
  assert.equal(visibility.resolvedBy, "VISIBILITY");
});

test("cell cap approves below-cap overshoot and later-turn replacement slots", () => {
  assert.equal(resolveCellCapApprovals({ startCount: 24, confirmedLosses: 0, acquisitionCount: 4, cellCap: 25, enabled: true }), 4);
  assert.equal(resolveCellCapApprovals({ startCount: 25, confirmedLosses: 1, acquisitionCount: 4, cellCap: 25, enabled: true }), 1);
  assert.equal(resolveCellCapApprovals({ startCount: 28, confirmedLosses: 5, acquisitionCount: 4, cellCap: 25, enabled: true }), 2);
  assert.equal(resolveCellCapApprovals({ startCount: 99, confirmedLosses: 0, acquisitionCount: 4, cellCap: 25, enabled: false }), 4);
});

test("termination detects extinction fixed point loop and max turns", () => {
  const emptyState = state(2);
  assert.equal(detectTermination({ currentState: emptyState, previousHashes: [], turn: 1, maxTurns: 30 }).reason, "EXTINCTION");

  const stable = state(2, [[0, 0, occupied("A")]]);
  const stableHash = fullStateHash(stable, { boardId: "b" });
  assert.equal(detectTermination({ currentState: stable, previousHashes: [stableHash], turn: 2, maxTurns: 30, boardId: "b" }).reason, "FIXED_POINT");
  assert.equal(detectTermination({ currentState: stable, previousHashes: [stableHash, "x"], turn: 3, maxTurns: 30, boardId: "b" }).reason, "LOOP");
  assert.equal(detectTermination({ currentState: stable, previousHashes: [], turn: 30, maxTurns: 30, boardId: "b" }).reason, "MAX_TURNS");
});

test("full state hash includes grace and failure counters", () => {
  const a = state(2, [[0, 0, occupied("A", { graceRemaining: 1, survivalFailureStreak: 0 })]]);
  const b = state(2, [[0, 0, occupied("A", { graceRemaining: 0, survivalFailureStreak: 1 })]]);

  assert.notEqual(fullStateHash(a, { boardId: "same" }), fullStateHash(b, { boardId: "same" }));
});

test("batch stats keep all trials and configured score weights", () => {
  const stats = batchStats({
    genomeId: "g",
    trialSeeds: [1, 2, 3],
    trials: [
      { seed: 1, trialFitness: 0.2, terminationReason: "MAX_TURNS" },
      { seed: 2, trialFitness: 0.6, terminationReason: "MAX_TURNS" },
      { seed: 3, trialFitness: 1.0, terminationReason: "LOOP" }
    ],
    crossTrialMotifRecurrenceScore: 0.5,
    config: { variancePenaltyWeight: 0.25, recurrenceBonusWeight: 0.5 }
  });

  assert.equal(stats.runsPerGenome, 3);
  assert.equal(stats.meanTrialFitness, 0.6);
  assert.equal(stats.medianTrialFitness, 0.6);
  assert.equal(stats.trials.length, 3);
  assert.deepEqual(stats.terminationReasonDistribution, { MAX_TURNS: 2, FIXED_POINT: 0, LOOP: 1, EXTINCTION: 0 });
  assert.equal(stats.batchFitness, Number((0.6 - 0.25 * stats.trialFitnessStandardDeviation + 0.5 * 0.5).toFixed(6)));
});

test("initial state creates occupied cells with runtime counters", () => {
  const initial = createInitialState({ size: 5, players: 2, seed: 11 });
  const occupiedCells = initial.cells.filter((cell) => cell.kind === CELL.OCCUPIED);

  assert.equal(occupiedCells.length, 2);
  assert.ok(occupiedCells.every((cell) => cell.graceRemaining === DEFAULT_SIMULATION_CONFIG.newbornGrace));
  assert.ok(occupiedCells.every((cell) => cell.survivalFailureStreak === 0));
});

test("runSimulationTrial returns numeric snapshots checkpoints and termination metadata", () => {
  const result = runSimulationTrial({
    board: { size: 7, players: 2 },
    genome: { movementMode: "ROOK", distanceMode: 0, cohesionEnabled: 0, aggressionEnabled: 0 },
    seed: 99,
    config: { maxTurns: 6, perTeamCellCap: 8 },
    checkpointInterval: 2
  });

  assert.ok(["MAX_TURNS", "FIXED_POINT", "LOOP", "EXTINCTION"].includes(result.terminationReason));
  assert.ok(result.terminationTurn <= 6);
  assert.equal(result.checkpoints[0].turn, 0);
  assert.ok(result.checkpoints.some((item) => item.turn === result.terminationTurn || item.turn === 6));
  assert.deepEqual(result.replayFrames.map((item) => item.turn), Array.from({ length: result.terminationTurn + 1 }, (_, index) => index));
  assert.equal(result.finalState.size, 7);
  assert.equal(result.finalState.cells.length, 49);
  assert.ok(result.finalState.cells.every((cell) => Number.isInteger(cell) && cell >= -1));
  assert.deepEqual(result, runSimulationTrial({
    board: { size: 7, players: 2 },
    genome: { movementMode: "ROOK", distanceMode: 0, cohesionEnabled: 0, aggressionEnabled: 0 },
    seed: 99,
    config: { maxTurns: 6, perTeamCellCap: 8 },
    checkpointInterval: 2
  }));
});
