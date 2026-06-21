import { runSimulationTrial } from "./simulation-rules.js";
import { normalizeMoveWeights } from "./form-search.js";

function genomeFromSettings(settings) {
  const movementWeights = normalizeMoveWeights({
    rook: settings.rook ?? (settings.movementMode === "ROOK" ? 1 : 0),
    bishop: settings.bishop ?? (settings.movementMode === "BISHOP" ? 1 : 0),
    knight: settings.knight ?? (settings.movementMode === "KNIGHT" ? 1 : 0)
  });
  return {
    movementWeights,
    distanceMode: Math.max(0, Math.min(1, Number(settings.distanceMode ?? 0))),
    distanceWeight: Math.max(0, Number(settings.distanceWeight ?? 1)),
    cohesionWeight: Math.max(0, Math.min(1, Number(settings.cohesionWeight ?? (Number(settings.cohesion) || 0) / 100))),
    aggressionWeight: Math.max(0, Math.min(1, Number(settings.aggressionWeight ?? (Number(settings.attack) || 0) / 100)))
  };
}

function configFromSettings(settings) {
  return {
    maxTurns: Math.max(0, Math.round(settings.turns ?? settings.maxTurns ?? 30)),
    perTeamCellCap: Math.max(1, Math.round(settings.cellCap ?? settings.perTeamCellCap ?? 25)),
    cellCapEnabled: settings.cellCapEnabled !== false,
    enemyWeight: Number(settings.enemyWeight ?? 1),
    survivalMin: Math.max(0, Math.round(settings.survivalMin ?? 2)),
    survivalMaxEnabled: settings.survivalMaxEnabled !== false,
    survivalMax: Math.max(0, Math.round(settings.survivalMax ?? 5)),
    newbornGrace: Math.max(0, Math.round(settings.newbornGrace ?? 2)),
    releaseDelay: Math.max(1, Math.round(settings.releaseDelay ?? 2)),
    persistenceCap: Math.max(1, Math.round(settings.persistenceCap ?? 20)),
    variancePenaltyWeight: Number(settings.variancePenaltyWeight ?? 0.25),
    recurrenceBonusWeight: Number(settings.recurrenceBonusWeight ?? 0.5)
  };
}

export function simulateTrialResult(settings, seed, options = {}) {
  const size = Math.max(4, Math.round(settings.size));
  const players = Math.max(2, Math.round(settings.players));
  return runSimulationTrial({
    board: { size, players },
    genome: genomeFromSettings(settings),
    seed,
    config: configFromSettings(settings),
    checkpointInterval: Math.max(1, Math.round(options.interval ?? settings.patternSearchIntervalTurns ?? settings.turns ?? 1))
  });
}

export function simulateFinalState(settings, seed) {
  return simulateTrialResult(settings, seed).finalState;
}

export function simulateCheckpoints(settings, seed, options = {}) {
  return simulateTrialResult(settings, seed, options).checkpoints;
}

export function simulateReplayFrames(settings, seed, options = {}) {
  return simulateTrialResult(settings, seed, options).replayFrames;
}
