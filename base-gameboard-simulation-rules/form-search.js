export function normalizeMoveWeights(weights) {
  const values = {
    rook: Math.max(0, Number(weights.rook) || 0),
    bishop: Math.max(0, Number(weights.bishop) || 0),
    knight: Math.max(0, Number(weights.knight) || 0)
  };
  const total = values.rook + values.bishop + values.knight;
  if (!total) return { rook: 1 / 3, bishop: 1 / 3, knight: 1 / 3 };
  return {
    rook: values.rook / total,
    bishop: values.bishop / total,
    knight: values.knight / total
  };
}

export function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCandidate(random, ranges = {}) {
  const pick = (name, fallbackMin, fallbackMax) => {
    const [min, max] = ranges[name] || [fallbackMin, fallbackMax];
    return min + random() * (max - min);
  };
  const raw = {
    rook: pick("rook", 0, 100),
    bishop: pick("bishop", 0, 100),
    knight: pick("knight", 0, 100)
  };
  const normalized = normalizeMoveWeights(raw);
  return {
    rook: normalized.rook * 100,
    bishop: normalized.bishop * 100,
    knight: normalized.knight * 100,
    distanceMode: pick("distanceMode", 0, 1),
    cohesion: pick("cohesion", 0, 100),
    attack: pick("attack", 0, 100)
  };
}

export function aggregateRuns(runs) {
  const keys = ["continuity", "interpenetration", "boundary", "balance"];
  const objectives = Object.fromEntries(keys.map((key) => [
    key,
    runs.length ? runs.reduce((sum, run) => sum + run.metrics[key], 0) / runs.length : 0
  ]));
  const counts = new Map();
  for (const run of runs) counts.set(run.pattern, (counts.get(run.pattern) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topPattern = "", topCount = 0] = sorted[0] || [];
  objectives.stability = runs.length ? topCount / runs.length : 0;
  return {
    objectives,
    topPattern,
    topCount,
    reproductionRate: objectives.stability,
    distinctPatterns: counts.size,
    representative: runs.find((run) => run.pattern === topPattern)?.state || null
  };
}

export function dominates(a, b) {
  const keys = ["continuity", "interpenetration", "boundary", "balance", "stability"];
  return keys.every((key) => a[key] >= b[key]) && keys.some((key) => a[key] > b[key]);
}

export function paretoFront(candidates) {
  return candidates.filter((candidate, index) =>
    !candidates.some((other, otherIndex) =>
      otherIndex !== index && dominates(other.objectives, candidate.objectives)
    )
  );
}
