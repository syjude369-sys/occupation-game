const MOTIF_OBJECTIVE_ID = "activePatternFitness";

export function hasActiveMotifs(motifs) {
  return Array.isArray(motifs) && motifs.some((motif) => motif.fitnessActive === true && motif.excluded !== true);
}

export function effectiveObjectives(objectives, motifs) {
  const motifOptimization = hasActiveMotifs(motifs);
  return objectives.filter((objective) =>
    objective.enabled === true &&
    (objective.id !== MOTIF_OBJECTIVE_ID || motifOptimization)
  );
}

export function optimizationModeLabel(motifs) {
  return hasActiveMotifs(motifs) ? "Motif optimization" : "Simulation only";
}
