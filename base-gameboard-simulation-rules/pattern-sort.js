export const patternSortOptions = Object.freeze([
  { id: "duration", label: "Duration", value: (pattern) => pattern.durationSteps || 0 },
  { id: "detections", label: "Detections", value: (pattern) => pattern.detectionCount || 0 },
  { id: "episodes", label: "Episodes", value: (pattern) => pattern.episodeCount || 0 },
  { id: "score", label: "Score", value: (pattern) => pattern.totalMotifScore || 0 },
  { id: "occupied", label: "Occupied", value: (pattern) => pattern.occupiedCount || 0 },
  { id: "area", label: "Area", value: (pattern) => (pattern.width || 0) * (pattern.height || 0) },
  { id: "firstTurn", label: "First turn", value: (pattern) => Number.isFinite(pattern.firstSeenTurn) ? -pattern.firstSeenTurn : -Infinity },
  { id: "lastTurn", label: "Last turn", value: (pattern) => pattern.lastSeenTurn || 0 }
]);

function optionFor(id) {
  return patternSortOptions.find((option) => option.id === id) || patternSortOptions[0];
}

function tieKey(pattern) {
  return pattern.signature || pattern.id || pattern.name || "";
}

export function sortPatterns(patterns, sortId) {
  const option = optionFor(sortId);
  return patterns.slice().sort((a, b) => {
    const delta = option.value(b) - option.value(a);
    if (delta) return delta;
    return tieKey(a).localeCompare(tieKey(b));
  });
}
