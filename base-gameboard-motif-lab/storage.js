import { CELL } from "./motif-engine.js";

export const STORAGE_KEY = "base-gameboard-motif-lab-v1";

function builtInMotifs() {
  return [
    { id: "line4", name: "Four-cell line", description: "Long table or bar", width: 4, height: 1, cells: [1,1,1,1], weight: 40, minCompletion: 0.75, enabled: true, source: "built-in" },
    { id: "cross5", name: "Cross", description: "Shared junction", width: 3, height: 3, cells: [0,1,0,1,1,1,0,1,0], weight: 40, minCompletion: 0.8, enabled: true, source: "built-in" },
    { id: "courtyard9", name: "Courtyard ring", description: "Lounge around a tree or void", width: 3, height: 3, cells: [1,1,1,1,CELL.EMPTY,1,1,1,1], weight: 70, minCompletion: 0.75, enabled: true, source: "built-in" },
    { id: "block4", name: "2x2 frontage block", description: "Compact room with a clear side", width: 2, height: 2, cells: [1,1,1,1], weight: 25, minCompletion: 1, enabled: true, source: "built-in", frontage: true }
  ];
}

export function defaultLabState() {
  return {
    version: 1,
    settings: {
      size: 17, players: 4, turns: 30, cellCap: 25,
      generationSize: 12, seeds: 4, masterSeed: 6152026,
      minPatternSize: 6, maxPatternSize: 36, discoverySamples: 60,
      archiveLimit: 120
    },
    objectives: [
      { id: "continuity", name: "Continuity", enabled: true, direction: "max" },
      { id: "interpenetration", name: "Interpenetration", enabled: true, direction: "max" },
      { id: "boundary", name: "Boundary", enabled: true, direction: "max" },
      { id: "balance", name: "Balance", enabled: true, direction: "max" },
      { id: "stability", name: "Stability", enabled: true, direction: "max" },
      { id: "motifFitness", name: "Motif fitness", enabled: true, direction: "max" }
    ],
    motifs: builtInMotifs(),
    archive: [],
    discovered: [],
    ignoredSignatures: [],
    generation: 0,
    selectedCandidateId: null
  };
}

export function normalizeLabState(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.motifs) || !Array.isArray(input.objectives)) {
    return { state: defaultLabState(), recovered: true };
  }
  const defaults = defaultLabState();
  return {
    recovered: false,
    state: {
      ...defaults,
      ...input,
      settings: { ...defaults.settings, ...(input.settings || {}) },
      motifs: input.motifs,
      objectives: input.objectives,
      archive: Array.isArray(input.archive) ? input.archive : [],
      discovered: Array.isArray(input.discovered) ? input.discovered : []
    }
  };
}

export function serializeLabState(state) {
  const limit = Math.max(1, state.settings.archiveLimit || 120);
  return JSON.stringify({ ...state, archive: state.archive.slice(-limit) });
}
