export const CELL = Object.freeze({
  INVALID: "INVALID",
  EMPTY: "EMPTY",
  OCCUPIED: "OCCUPIED"
});

export const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  runsPerGenome: 8,
  enemyWeight: 1,
  survivalMin: 2,
  survivalMaxEnabled: true,
  survivalMax: 5,
  newbornGrace: 2,
  releaseDelay: 2,
  cellCapEnabled: true,
  perTeamCellCap: 25,
  persistenceCap: 20,
  maxTurns: 30,
  variancePenaltyWeight: 0.25,
  recurrenceBonusWeight: 0.5
});

const ROOK_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
const BISHOP_OFFSETS = [[1, 1], [1, -1], [-1, 1], [-1, -1], [2, 2], [2, -2], [-2, 2], [-2, -2]];
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const MOVEMENT_MODES = ["ROOK", "BISHOP", "KNIGHT"];
const TERMINATION_REASONS = ["MAX_TURNS", "FIXED_POINT", "LOOP", "EXTINCTION"];

const cellId = ({ x, y }) => `${x},${y}`;
const parseCellId = (id) => {
  const [x, y] = id.split(",").map(Number);
  return { x, y };
};
const inBounds = (state, point) => point.x >= 0 && point.y >= 0 && point.x < state.size && point.y < state.size;
const index = (state, point) => point.y * state.size + point.x;
const getCell = (state, point) => inBounds(state, point) ? state.cells[index(state, point)] : null;
const isOccupied = (cell) => cell?.kind === CELL.OCCUPIED;
const isInvalid = (cell) => cell?.kind === CELL.INVALID;
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getMovementOffsets(mode) {
  if (mode === "ROOK") return ROOK_OFFSETS.map((item) => item.slice());
  if (mode === "BISHOP") return BISHOP_OFFSETS.map((item) => item.slice());
  if (mode === "KNIGHT") return KNIGHT_OFFSETS.map((item) => item.slice());
  throw new Error(`Unknown movementMode: ${mode}`);
}

function weightedMovementOffsets(genome) {
  if (genome.movementMode) return getMovementOffsets(genome.movementMode).map((offset) => ({ mode: genome.movementMode, offset }));
  return MOVEMENT_MODES.flatMap((mode) => getMovementOffsets(mode).map((offset) => ({ mode, offset })));
}

function movementWeight(genome, mode) {
  if (genome.movementWeights) return Math.max(0, Number(genome.movementWeights[mode.toLowerCase()]) || 0);
  return genome.movementMode === mode ? 1 : 0;
}

export function useGate(state, teamId, target) {
  const cell = getCell(state, target);
  if (!cell) return { pass: false, reason: "outside_board" };
  if (cell.kind === CELL.INVALID) return { pass: false, reason: "invalid" };
  if (cell.kind === CELL.OCCUPIED && cell.ownerId === teamId) return { pass: false, reason: "own_occupied" };
  if (cell.kind === CELL.EMPTY) return { pass: true, reason: "empty" };
  if (cell.kind === CELL.OCCUPIED && cell.ownerId !== teamId) return { pass: true, reason: "enemy_occupied" };
  return { pass: false, reason: "unknown_cell_kind" };
}

export function accessibilityPass(state, teamId, source, target) {
  const selfDistance = manhattan(source, target);
  let enemyDistance = Infinity;
  const targetKey = cellId(target);
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const point = { x, y };
      const cell = getCell(state, point);
      if (!isOccupied(cell) || cell.ownerId === teamId || cellId(point) === targetKey) continue;
      enemyDistance = Math.min(enemyDistance, manhattan(point, target));
    }
  }
  return { pass: selfDistance <= enemyDistance, selfDistance, enemyDistance };
}

function supercoverLine(a, b) {
  const points = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    points.push({ x: Math.round(a.x + dx * t), y: Math.round(a.y + dy * t) });
  }
  return [...new Map(points.map((point) => [cellId(point), point])).values()];
}

export function lineOfSightPass(state, source, target, teamId) {
  for (const point of supercoverLine(source, target)) {
    const cell = getCell(state, point);
    if (!cell) continue;
    if (cell.kind === CELL.INVALID) return { pass: false, blocker: cellId(point), reason: "invalid_blocker" };
    if (cell.kind === CELL.OCCUPIED && cell.ownerId !== teamId) return { pass: false, blocker: cellId(point), reason: "enemy_blocker" };
  }
  return { pass: true };
}

function distanceTier(mode, source, target) {
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  if (mode === "ROOK") return dx + dy === 1 ? 0 : 1;
  if (mode === "BISHOP") return dx === 1 && dy === 1 ? 0 : 1;
  return null;
}

export function candidateScores(state, candidate) {
  const targetCell = getCell(state, candidate.target);
  const tier = distanceTier(candidate.movementMode, candidate.source, candidate.target);
  const distancePreference = Math.max(0, Math.min(1, Number(candidate.distanceMode ?? 0)));
  const distanceWeight = Number(candidate.distanceWeight ?? 1);
  const distanceScore = Number((tier == null
    ? 0
    : distanceWeight * (tier === 0 ? 1 - distancePreference : distancePreference)).toFixed(6));
  let hasOtherAlly = false;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const point = { x: candidate.target.x + dx, y: candidate.target.y + dy };
      if (point.x === candidate.source.x && point.y === candidate.source.y) continue;
      const cell = getCell(state, point);
      if (isOccupied(cell) && cell.ownerId === candidate.teamId) hasOtherAlly = true;
    }
  }
  const movementScore = movementWeight(candidate, candidate.movementMode);
  const cohesionScore = (Number(candidate.cohesionWeight ?? candidate.cohesionEnabled ?? 0)) * (hasOtherAlly ? 1 : 0);
  const aggressionScore = (Number(candidate.aggressionWeight ?? candidate.aggressionEnabled ?? 0)) * (isOccupied(targetCell) && targetCell.ownerId !== candidate.teamId ? 1 : 0);
  return {
    movementScore,
    distanceScore,
    cohesionScore,
    aggressionScore,
    candidateScore: Number((movementScore + distanceScore + cohesionScore + aggressionScore).toFixed(6))
  };
}

export function survivalResult(state, point, config = {}) {
  const settings = { ...DEFAULT_SIMULATION_CONFIG, ...config };
  const cell = getCell(state, point);
  if (!isOccupied(cell)) throw new Error("survivalResult requires occupied cell");
  let sameNeighbors = 0;
  let enemyNeighbors = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const neighbor = getCell(state, { x: point.x + dx, y: point.y + dy });
      if (!isOccupied(neighbor)) continue;
      if (neighbor.ownerId === cell.ownerId) sameNeighbors += 1;
      else enemyNeighbors += 1;
    }
  }
  const effectiveSupport = sameNeighbors - settings.enemyWeight * enemyNeighbors;
  const minimumPass = effectiveSupport >= settings.survivalMin;
  const maximumPass = settings.survivalMaxEnabled === false || sameNeighbors <= settings.survivalMax;
  const fullPass = minimumPass && maximumPass;
  const inGrace = cell.graceRemaining > 0;
  const failureStreakBefore = cell.survivalFailureStreak || 0;
  const failureStreakAfter = fullPass ? 0 : failureStreakBefore + 1;
  const scheduledForRelease = !inGrace && !fullPass && failureStreakAfter >= settings.releaseDelay;
  return {
    turn: null,
    teamId: cell.ownerId,
    cellId: cellId(point),
    sameNeighbors,
    enemyNeighbors,
    effectiveSupport,
    minimumPass,
    maximumPass,
    inGrace,
    failureStreakBefore,
    failureStreakAfter,
    scheduledForRelease,
    proposedBeforeRelease: true
  };
}

export function resolveConflict({ targetCellId, claims, seed, stateHash }) {
  const target = parseCellId(targetCellId);
  const teamDistance = {};
  for (const claim of claims) teamDistance[claim.teamId] = Math.min(...claim.sourceCells.map((source) => manhattan(source, target)));
  const minDistance = Math.min(...Object.values(teamDistance));
  const accessibilityWinnerIds = Object.keys(teamDistance).filter((teamId) => teamDistance[teamId] === minDistance).sort();
  if (accessibilityWinnerIds.length === 1) {
    return { targetCellId, competingTeams: claims.map((claim) => claim.teamId).sort(), teamDistance, visibleSupportCount: Object.fromEntries(claims.map((claim) => [claim.teamId, claim.visibleSupportCount || 0])), accessibilityWinnerIds, visibilityWinnerIds: accessibilityWinnerIds, resolvedBy: "ACCESSIBILITY", winnerTeamId: accessibilityWinnerIds[0] };
  }
  const visibleSupportCount = Object.fromEntries(claims.map((claim) => [claim.teamId, claim.visibleSupportCount || 0]));
  const maxVisible = Math.max(...accessibilityWinnerIds.map((teamId) => visibleSupportCount[teamId]));
  const visibilityWinnerIds = accessibilityWinnerIds.filter((teamId) => visibleSupportCount[teamId] === maxVisible).sort();
  if (visibilityWinnerIds.length === 1) {
    return { targetCellId, competingTeams: claims.map((claim) => claim.teamId).sort(), teamDistance, visibleSupportCount, accessibilityWinnerIds, visibilityWinnerIds, resolvedBy: "VISIBILITY", winnerTeamId: visibilityWinnerIds[0] };
  }
  const randomHash = hashString(stableStringify({ seed, stateHash, decisionType: "CONFLICT_TIE", targetCellId, sortedTeamIds: visibilityWinnerIds }));
  const winnerTeamId = visibilityWinnerIds[parseInt(randomHash, 16) % visibilityWinnerIds.length];
  return { targetCellId, competingTeams: claims.map((claim) => claim.teamId).sort(), teamDistance, visibleSupportCount, accessibilityWinnerIds, visibilityWinnerIds, resolvedBy: "RANDOM", winnerTeamId };
}

export function resolveCellCapApprovals({ startCount, confirmedLosses, acquisitionCount, cellCap = DEFAULT_SIMULATION_CONFIG.perTeamCellCap, enabled = true }) {
  if (!enabled) return acquisitionCount;
  if (startCount < cellCap) return acquisitionCount;
  const projectedAfterLoss = startCount - confirmedLosses;
  const availableSlots = Math.max(0, cellCap - projectedAfterLoss);
  return Math.min(acquisitionCount, availableSlots);
}

export function fullStateHash(state, options = {}) {
  return hashString(stableStringify({
    boardId: options.boardId,
    size: state.size,
    cells: state.cells.map((cell) => cell.kind === CELL.OCCUPIED
      ? { kind: cell.kind, ownerId: cell.ownerId, graceRemaining: cell.graceRemaining, survivalFailureStreak: cell.survivalFailureStreak }
      : { kind: cell.kind })
  }));
}

export function detectTermination({ currentState, previousHashes = [], turn, maxTurns = DEFAULT_SIMULATION_CONFIG.maxTurns, boardId }) {
  const hash = fullStateHash(currentState, { boardId });
  if (!currentState.cells.some(isOccupied)) return { reason: "EXTINCTION", turn, fullStateHash: hash };
  const previousIndex = previousHashes.lastIndexOf(hash);
  if (previousIndex >= 0) {
    const loopPeriod = previousHashes.length - previousIndex;
    if (loopPeriod === 1) return { reason: "FIXED_POINT", turn, fullStateHash: hash };
    return { reason: "LOOP", turn, loopStartTurn: previousIndex + 1, loopPeriod, fullStateHash: hash };
  }
  if (turn >= maxTurns) return { reason: "MAX_TURNS", turn, fullStateHash: hash };
  return null;
}

export function batchStats({ genomeId, trialSeeds, trials, crossTrialMotifRecurrenceScore = 0, config = {} }) {
  const settings = { ...DEFAULT_SIMULATION_CONFIG, ...config };
  const values = trials.map((trial) => trial.trialFitness);
  const meanTrialFitness = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const sorted = values.slice().sort((a, b) => a - b);
  const medianTrialFitness = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = values.reduce((sum, value) => sum + (value - meanTrialFitness) ** 2, 0) / Math.max(1, values.length);
  const trialFitnessStandardDeviation = Math.sqrt(variance);
  const terminationReasonDistribution = Object.fromEntries(TERMINATION_REASONS.map((reason) => [reason, 0]));
  for (const trial of trials) terminationReasonDistribution[trial.terminationReason] = (terminationReasonDistribution[trial.terminationReason] || 0) + 1;
  return {
    genomeId,
    runsPerGenome: trials.length,
    trialSeeds,
    meanTrialFitness: Number(meanTrialFitness.toFixed(6)),
    medianTrialFitness: Number(medianTrialFitness.toFixed(6)),
    trialFitnessStandardDeviation: Number(trialFitnessStandardDeviation.toFixed(6)),
    bestTrialFitness: Math.max(...values),
    worstTrialFitness: Math.min(...values),
    successfulTrialRate: trials.filter((trial) => trial.trialFitness > 0).length / Math.max(1, trials.length),
    terminationReasonDistribution,
    crossTrialMotifRecurrenceScore,
    batchFitness: Number((meanTrialFitness - settings.variancePenaltyWeight * trialFitnessStandardDeviation + settings.recurrenceBonusWeight * crossTrialMotifRecurrenceScore).toFixed(6)),
    trials
  };
}

function seededPoints(size, players) {
  // TODO(spec): board start-position rule not defined. Preserve prior radial seed convention for adapter only.
  const radius = (size - 1) * 0.25;
  const center = (size - 1) / 2;
  const used = new Set();
  const result = [];
  for (let player = 0; player < players; player += 1) {
    const angle = Math.PI * 2 * player / players;
    let x = Math.round(center + Math.cos(angle) * radius);
    let y = Math.round(center + Math.sin(angle) * radius);
    while (used.has(`${x},${y}`)) x = Math.min(size - 1, x + 1);
    used.add(`${x},${y}`);
    result.push({ x, y });
  }
  return result;
}

export function createInitialState({ size, players }) {
  const state = {
    size,
    cells: Array.from({ length: size * size }, () => ({ kind: CELL.EMPTY }))
  };
  seededPoints(size, players).forEach((point, teamIndex) => {
    state.cells[index(state, point)] = {
      kind: CELL.OCCUPIED,
      ownerId: String(teamIndex),
      graceRemaining: DEFAULT_SIMULATION_CONFIG.newbornGrace,
      survivalFailureStreak: 0
    };
  });
  return state;
}

function numericSnapshot(state) {
  return {
    size: state.size,
    cells: state.cells.map((cell) => cell.kind === CELL.OCCUPIED ? Number(cell.ownerId) : -1)
  };
}

function chooseByHash(items, payload) {
  if (!items.length) return null;
  const hash = parseInt(hashString(stableStringify(payload)), 16);
  return items[hash % items.length];
}

function sourcePoints(state) {
  const result = [];
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const point = { x, y };
      const cell = getCell(state, point);
      if (isOccupied(cell)) result.push({ point, cell });
    }
  }
  return result;
}

function cloneState(state) {
  return {
    size: state.size,
    cells: state.cells.map((cell) => ({ ...cell }))
  };
}

function proposalForSource(frozen, source, genome, seed, stateHash, turn) {
  const offsets = weightedMovementOffsets(genome);
  const candidates = [];
  for (const { mode, offset } of offsets) {
    const [dx, dy] = offset;
    const target = { x: source.point.x + dx, y: source.point.y + dy };
    const use = useGate(frozen, source.cell.ownerId, target);
    if (!use.pass) continue;
    const access = accessibilityPass(frozen, source.cell.ownerId, source.point, target);
    if (!access.pass) continue;
    const visible = lineOfSightPass(frozen, source.point, target, source.cell.ownerId);
    if (!visible.pass) continue;
    const scores = candidateScores(frozen, {
      teamId: source.cell.ownerId,
      movementMode: mode,
      movementWeights: genome.movementWeights,
      distanceMode: genome.distanceMode,
      distanceWeight: genome.distanceWeight,
      cohesionWeight: genome.cohesionWeight ?? genome.cohesionEnabled,
      aggressionWeight: genome.aggressionWeight ?? genome.aggressionEnabled,
      source: source.point,
      target
    });
    candidates.push({ target, ...scores });
  }
  if (!candidates.length) return null;
  const maxScore = Math.max(...candidates.map((candidate) => candidate.candidateScore));
  const top = candidates.filter((candidate) => candidate.candidateScore === maxScore);
  const selected = chooseByHash(top, {
    seed,
    preDecisionFullStateHash: stateHash,
    decisionType: "CANDIDATE_TIE",
    turn,
    teamId: source.cell.ownerId,
    sourceCellId: cellId(source.point),
    sortedCandidateIds: top.map((candidate) => cellId(candidate.target)).sort()
  });
  return {
    teamId: source.cell.ownerId,
    source: source.point,
    target: selected.target,
    candidateScore: selected.candidateScore
  };
}

export function runSimulationTrial({ board, genome, seed, config = {}, checkpointInterval = 1 }) {
  const settings = { ...DEFAULT_SIMULATION_CONFIG, ...config };
  let state = createInitialState({ size: board.size, players: board.players });
  const checkpoints = [{ turn: 0, state: numericSnapshot(state) }];
  const replayFrames = [{ turn: 0, state: numericSnapshot(state) }];
  const previousHashes = [];
  let termination = null;
  for (let turn = 1; turn <= settings.maxTurns; turn += 1) {
    const frozen = cloneState(state);
    const stateHash = fullStateHash(frozen, { boardId: `${board.size}:${board.players}` });
    const survivals = sourcePoints(frozen).map((source) => ({
      source,
      result: survivalResult(frozen, source.point, settings)
    }));
    const proposals = sourcePoints(frozen)
      .map((source) => proposalForSource(frozen, source, genome, seed, stateHash, turn))
      .filter(Boolean);
    const claims = new Map();
    for (const proposal of proposals) {
      const targetKey = cellId(proposal.target);
      const byTarget = claims.get(targetKey) || new Map();
      const teamClaims = byTarget.get(proposal.teamId) || [];
      teamClaims.push(proposal);
      byTarget.set(proposal.teamId, teamClaims);
      claims.set(targetKey, byTarget);
    }
    const winners = [];
    for (const [targetKey, byTeam] of claims) {
      const teamClaims = [...byTeam].map(([teamId, teamProposals]) => ({
        teamId,
        sourceCells: teamProposals.map((proposal) => proposal.source),
        visibleSupportCount: 0
      }));
      const winner = teamClaims.length === 1
        ? { winnerTeamId: teamClaims[0].teamId }
        : resolveConflict({ targetCellId: targetKey, claims: teamClaims, seed, stateHash });
      winners.push({ target: parseCellId(targetKey), teamId: winner.winnerTeamId });
    }
    const next = cloneState(frozen);
    const losses = new Map();
    for (const { source, result } of survivals) {
      const current = next.cells[index(next, source.point)];
      if (!isOccupied(current)) continue;
      current.graceRemaining = Math.max(0, (current.graceRemaining || 0) - 1);
      current.survivalFailureStreak = result.failureStreakAfter;
      if (result.scheduledForRelease) {
        losses.set(current.ownerId, (losses.get(current.ownerId) || 0) + 1);
        next.cells[index(next, source.point)] = { kind: CELL.EMPTY };
      }
    }
    const startCounts = new Map();
    for (const { cell } of sourcePoints(frozen)) startCounts.set(cell.ownerId, (startCounts.get(cell.ownerId) || 0) + 1);
    const byTeamAcquisitions = new Map();
    for (const winner of winners) {
      const items = byTeamAcquisitions.get(winner.teamId) || [];
      items.push(winner);
      byTeamAcquisitions.set(winner.teamId, items);
    }
    for (const [teamId, acquisitions] of byTeamAcquisitions) {
      const approved = resolveCellCapApprovals({
        startCount: startCounts.get(teamId) || 0,
        confirmedLosses: losses.get(teamId) || 0,
        acquisitionCount: acquisitions.length,
        cellCap: settings.perTeamCellCap,
        enabled: settings.cellCapEnabled
      });
      for (const acquisition of acquisitions.slice(0, approved)) {
        next.cells[index(next, acquisition.target)] = {
          kind: CELL.OCCUPIED,
          ownerId: acquisition.teamId,
          graceRemaining: settings.newbornGrace,
          survivalFailureStreak: 0
        };
      }
    }
    state = next;
    replayFrames.push({ turn, state: numericSnapshot(state) });
    if (turn % checkpointInterval === 0 || turn === settings.maxTurns) checkpoints.push({ turn, state: numericSnapshot(state) });
    termination = detectTermination({ currentState: state, previousHashes, turn, maxTurns: settings.maxTurns, boardId: `${board.size}:${board.players}` });
    previousHashes.push(fullStateHash(state, { boardId: `${board.size}:${board.players}` }));
    if (termination) {
      if (!checkpoints.some((checkpoint) => checkpoint.turn === turn)) checkpoints.push({ turn, state: numericSnapshot(state) });
      break;
    }
  }
  return {
    seed,
    finalState: numericSnapshot(state),
    checkpoints,
    replayFrames,
    terminationReason: termination?.reason || "MAX_TURNS",
    terminationTurn: termination?.turn || settings.maxTurns,
    loopStartTurn: termination?.loopStartTurn,
    loopPeriod: termination?.loopPeriod,
    motifPersistence: [], // TODO(spec): persistence hook belongs to pattern engine adapter; implement after contract final.
    discoveredMotifs: [], // TODO(spec): simulation must not run motif discovery directly.
    occupancyMetrics: null, // TODO(spec): metric shape not defined here.
    conflictMetrics: null // TODO(spec): aggregate metric shape not defined here.
  };
}
