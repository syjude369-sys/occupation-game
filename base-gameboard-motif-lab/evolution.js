import { createSeededRandom, generateCandidate, normalizeMoveWeights } from "./form-search.js";

function enabledObjectives(definitions) {
  return definitions.filter((item) => item.enabled);
}

export function dynamicDominates(a, b, definitions) {
  const active = enabledObjectives(definitions);
  if (!active.length) return false;
  const noWorse = active.every((item) => item.direction === "min" ? a[item.id] <= b[item.id] : a[item.id] >= b[item.id]);
  const better = active.some((item) => item.direction === "min" ? a[item.id] < b[item.id] : a[item.id] > b[item.id]);
  return noWorse && better;
}

export function dynamicParetoFront(candidates, definitions) {
  return candidates.filter((candidate, index) =>
    !candidates.some((other, otherIndex) =>
      index !== otherIndex && dynamicDominates(other.objectives, candidate.objectives, definitions)
    )
  );
}

export function crossover(a, b, random) {
  const t = random();
  const moves = normalizeMoveWeights({
    rook: a.rook * t + b.rook * (1 - t),
    bishop: a.bishop * t + b.bishop * (1 - t),
    knight: a.knight * t + b.knight * (1 - t)
  });
  return {
    rook: moves.rook * 100,
    bishop: moves.bishop * 100,
    knight: moves.knight * 100,
    attack: a.attack * t + b.attack * (1 - t)
  };
}

export function mutate(candidate, random, strength = 12) {
  const delta = () => (random() * 2 - 1) * strength;
  const moves = normalizeMoveWeights({
    rook: Math.max(0, candidate.rook + delta()),
    bishop: Math.max(0, candidate.bishop + delta()),
    knight: Math.max(0, candidate.knight + delta())
  });
  return {
    rook: moves.rook * 100,
    bishop: moves.bishop * 100,
    knight: moves.knight * 100,
    attack: Math.max(0, Math.min(100, candidate.attack + delta()))
  };
}

export function nextGeneration(archive, definitions, options) {
  const random = createSeededRandom(options.seed);
  const eligible = archive.filter((item) => !item.excluded);
  const frontier = dynamicParetoFront(eligible, definitions);
  const parents = [...eligible.filter((item) => item.pinned), ...frontier].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  const pool = parents.length ? parents : eligible;
  const children = [];
  const eliteCount = Math.min(options.eliteCount ?? 1, options.size);
  for (let i = 0; i < eliteCount && i < pool.length; i += 1) {
    children.push({
      id: `g${options.generation}-elite-${i}`,
      generation: options.generation,
      parentIds: [pool[i].id],
      params: { ...pool[i].params },
      elite: true
    });
  }
  while (children.length < options.size) {
    if (!pool.length || random() < (options.freshRate ?? 0.15)) {
      children.push({
        id: `g${options.generation}-fresh-${children.length}`,
        generation: options.generation,
        parentIds: [],
        params: generateCandidate(random),
        elite: false
      });
      continue;
    }
    const a = pool[Math.floor(random() * pool.length)];
    const b = pool[Math.floor(random() * pool.length)];
    children.push({
      id: `g${options.generation}-child-${children.length}`,
      generation: options.generation,
      parentIds: [a.id, b.id],
      params: mutate(crossover(a.params, b.params, random), random, options.mutationStrength ?? 12),
      elite: false
    });
  }
  return children;
}
