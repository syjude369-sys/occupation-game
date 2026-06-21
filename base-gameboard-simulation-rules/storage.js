import { defaultPatternSettings, mergeDiscoveredPatterns } from "./pattern-engine.js";

export const STORAGE_KEY = "base-gameboard-pattern-engine-v2";

export function defaultLabState() {
  return {
    version: 2,
    settings: {
      size: 17, players: 4, turns: 30, cellCap: 25,
      generationSize: 12, seeds: 4, masterSeed: 6152026,
      archiveLimit: 120
    },
    patternSettings: defaultPatternSettings(),
    objectives: [
      { id: "continuity", name: "Continuity", enabled: true, direction: "max" },
      { id: "interpenetration", name: "Interpenetration", enabled: true, direction: "max" },
      { id: "boundary", name: "Boundary", enabled: true, direction: "max" },
      { id: "balance", name: "Balance", enabled: true, direction: "max" },
      { id: "stability", name: "Stability", enabled: true, direction: "max" },
      { id: "activePatternFitness", name: "Active motifs", enabled: true, direction: "max" }
    ],
    motifs: [],
    archive: [],
    discovered: [],
    ignoredSignatures: [],
    generation: 0,
    selectedCandidateId: null
  };
}

function normalizeDiscovered(items) {
  return mergeDiscoveredPatterns([], Array.isArray(items) ? items : []);
}

function normalizePatternSettings(input, defaults) {
  const source = input || {};
  return {
    ...defaults,
    ...source,
    discovery: { ...defaults.discovery, ...(source.discovery || {}) },
    recurrenceWeights: { ...defaults.recurrenceWeights, ...(source.recurrenceWeights || {}) },
    distinctivenessWeights: { ...defaults.distinctivenessWeights, ...(source.distinctivenessWeights || {}) },
    scoreWeights: { ...defaults.scoreWeights, ...(source.scoreWeights || {}) },
    windowSizes: Array.isArray(source.windowSizes) ? source.windowSizes : defaults.windowSizes
  };
}

export function normalizeLabState(input) {
  if (!input || ![1, 2].includes(input.version) || !Array.isArray(input.objectives)) {
    return { state: defaultLabState(), recovered: true };
  }
  const defaults = defaultLabState();
  const objectives = input.version === 1
    ? defaults.objectives
    : input.objectives;
  return {
    recovered: false,
    state: {
      ...defaults,
      ...input,
      version: 2,
      settings: { ...defaults.settings, ...(input.settings || {}) },
      patternSettings: normalizePatternSettings(input.patternSettings, defaults.patternSettings),
      motifs: input.version === 1 ? [] : Array.isArray(input.motifs) ? input.motifs : [],
      objectives,
      archive: Array.isArray(input.archive) ? input.archive : [],
      discovered: normalizeDiscovered(input.discovered)
    }
  };
}

export function serializeLabState(state) {
  const limit = Math.max(1, state.settings.archiveLimit || 120);
  const compactPattern = (pattern) => ({
    signature: pattern.signature,
    id: pattern.id,
    name: pattern.name,
    originX: pattern.originX,
    originY: pattern.originY,
    width: pattern.width,
    height: pattern.height,
    cells: pattern.cells,
    representativeBoard: pattern.representativeBoard,
    archiveCandidateId: pattern.archiveCandidateId,
    occupiedCount: pattern.occupiedCount,
    methods: pattern.methods || [],
    archived: pattern.archived !== false,
    fitnessActive: pattern.fitnessActive === true,
    fitnessWeight: Math.max(0, Number(pattern.fitnessWeight ?? 1) || 0),
    excluded: pattern.excluded === true,
    detectionCount: pattern.detectionCount || 0,
    episodeCount: pattern.episodeCount || 0,
    durationSteps: pattern.durationSteps || 0,
    firstSeenTurn: pattern.firstSeenTurn,
    lastSeenTurn: pattern.lastSeenTurn,
    runs: Array.isArray(pattern.runs) ? pattern.runs : [],
    seeds: Array.isArray(pattern.seeds) ? pattern.seeds : [],
    genomes: Array.isArray(pattern.genomes) ? pattern.genomes : [],
    totalMotifScore: pattern.totalMotifScore || 0,
    voidStructure: pattern.voidStructure,
    furniture: pattern.furniture || { status: "not_tested" }
  });
  const compactArchive = (candidate) => {
    const { discoveries, ...rest } = candidate;
    return rest;
  };
  return JSON.stringify({
    ...state,
    archive: state.archive.slice(-limit).map(compactArchive),
    discovered: state.discovered.map(compactPattern),
    motifs: state.motifs.map(compactPattern)
  });
}
