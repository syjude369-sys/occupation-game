export function hasActiveMotifFitness(motifs) {
  return Array.isArray(motifs) && motifs.some((motif) => motif.fitnessActive === true && motif.excluded !== true);
}

export function canRunInitialPatternSearch(motifs, running = false) {
  return !running && !hasActiveMotifFitness(motifs);
}

export function canRunGeneration(motifs, running = false) {
  return !running && hasActiveMotifFitness(motifs);
}

export function runModeLabel(motifs) {
  return hasActiveMotifFitness(motifs) ? "Run generation" : "Initial pattern search";
}
