const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const key = (x, y) => `${x},${y}`;
const occupied = (board, x, y) =>
  x >= 0 && y >= 0 && x < board.size && y < board.size && board.cells[y * board.size + x] > 0;
const empty = (board, x, y) =>
  x < 0 || y < 0 || x >= board.size || y >= board.size || !occupied(board, x, y);

export function defaultPatternSettings() {
  return {
    patternSearchIntervalTurns: 5,
    discovery: { slidingWindow: true, regionBased: true },
    windowSizes: [2, 3, 4, 5].map((size) => ({ width: size, height: size })),
    minOccupancyRatio: 0.2,
    maxOccupancyRatio: 0.8,
    maxRegionArea: 36,
    recurrenceWeights: { withinBoard: 0.3, crossSeed: 0.4, crossGenome: 0.3 },
    distinctivenessWeights: { internalCohesion: 0.5, boundaryContrast: 0.3, boundaryClosure: 0.2 },
    scoreWeights: { recurrence: 0.3, distinctiveness: 0.35, symmetry: 0.2, void: 0.15 }
  };
}

function coveredKeys(originX, originY, width, height) {
  const result = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) result.push(key(originX + x, originY + y));
  }
  return result;
}

function exteriorAccess(pattern, board) {
  let accessibleBoundaryInterfaces = 0;
  const covered = new Set(coveredKeys(pattern.originX, pattern.originY, pattern.width, pattern.height));
  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const bx = pattern.originX + x;
      const by = pattern.originY + y;
      for (const [dx, dy] of DIRECTIONS) {
        const nx = bx + dx;
        const ny = by + dy;
        if (!covered.has(key(nx, ny)) && empty(board, nx, ny)) accessibleBoundaryInterfaces += 1;
      }
    }
  }
  return { externallyAccessible: accessibleBoundaryInterfaces > 0, accessibleBoundaryInterfaces };
}

function withIdentity(pattern, board, method) {
  const canonical = canonicalizeBinaryPattern(pattern);
  const access = exteriorAccess(pattern, board);
  return {
    ...pattern,
    method,
    methods: [method],
    signature: canonical.signature,
    canonical,
    ...access,
    coveredKeys: coveredKeys(pattern.originX, pattern.originY, pattern.width, pattern.height),
    placementKey: `${pattern.originX},${pattern.originY}:${pattern.width}x${pattern.height}`,
    furniture: {
      status: "not_tested",
      scenarios: [],
      internalCirculationValid: null,
      plantingZones: [],
      serviceZones: [],
      score: null
    }
  };
}

export function extractSlidingWindows(board, options = {}) {
  const settings = { ...defaultPatternSettings(), ...options };
  const result = [];
  for (const size of settings.windowSizes) {
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    for (let originY = 0; originY <= board.size - height; originY += 1) {
      for (let originX = 0; originX <= board.size - width; originX += 1) {
        const cells = [];
        let occupiedCount = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const isOccupied = occupied(board, originX + x, originY + y);
            cells.push(isOccupied ? "O" : "E");
            if (isOccupied) occupiedCount += 1;
          }
        }
        const ratio = occupiedCount / (width * height);
        if (occupiedCount === 0 || ratio < settings.minOccupancyRatio || ratio > settings.maxOccupancyRatio) continue;
        const candidate = withIdentity({ originX, originY, width, height, cells, occupiedCount }, board, "sliding");
        if (candidate.externallyAccessible) result.push(candidate);
      }
    }
  }
  return result;
}

function floodExteriorEmpties(board, minX, minY, maxX, maxY, componentSet) {
  const width = maxX - minX + 3;
  const height = maxY - minY + 3;
  const offsetX = minX - 1;
  const offsetY = minY - 1;
  const seen = new Set([key(0, 0)]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const boardKey = key(offsetX + nx, offsetY + ny);
      const localKey = key(nx, ny);
      if (seen.has(localKey) || componentSet.has(boardKey)) continue;
      seen.add(localKey);
      queue.push([nx, ny]);
    }
  }
  return { seen, offsetX, offsetY };
}

export function extractRegionMotifs(board, options = {}) {
  const maxRegionArea = Math.max(1, Math.round(options.maxRegionArea ?? defaultPatternSettings().maxRegionArea));
  const visited = new Set();
  const result = [];
  for (let startY = 0; startY < board.size; startY += 1) {
    for (let startX = 0; startX < board.size; startX += 1) {
      const startKey = key(startX, startY);
      if (!occupied(board, startX, startY) || visited.has(startKey)) continue;
      const component = [];
      const queue = [[startX, startY]];
      visited.add(startKey);
      while (queue.length) {
        const [x, y] = queue.pop();
        component.push([x, y]);
        for (const [dx, dy] of DIRECTIONS) {
          const nx = x + dx;
          const ny = y + dy;
          const nextKey = key(nx, ny);
          if (occupied(board, nx, ny) && !visited.has(nextKey)) {
            visited.add(nextKey);
            queue.push([nx, ny]);
          }
        }
      }
      const minX = Math.min(...component.map(([x]) => x));
      const maxX = Math.max(...component.map(([x]) => x));
      const minY = Math.min(...component.map(([, y]) => y));
      const maxY = Math.max(...component.map(([, y]) => y));
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      if (width * height > maxRegionArea) continue;
      const componentSet = new Set(component.map(([x, y]) => key(x, y)));
      const exterior = floodExteriorEmpties(board, minX, minY, maxX, maxY, componentSet);
      const cells = [];
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const localExteriorKey = key(x - exterior.offsetX, y - exterior.offsetY);
          cells.push(componentSet.has(key(x, y)) ? "O" : exterior.seen.has(localExteriorKey) ? null : "E");
        }
      }
      if (cells.some((cell) => cell === null)) continue;
      const candidate = withIdentity({ originX: minX, originY: minY, width, height, cells, occupiedCount: component.length }, board, "region");
      if (candidate.externallyAccessible) result.push(candidate);
    }
  }
  return result;
}

function transform(pattern, fn) {
  const points = [];
  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const [tx, ty] = fn(x, y, pattern.width, pattern.height);
      points.push({ x: tx, y: ty, value: pattern.cells[y * pattern.width + x] });
    }
  }
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells = Array(width * height);
  for (const point of points) cells[(point.y - minY) * width + point.x - minX] = point.value;
  return { width, height, cells };
}

function signature(pattern) {
  return `${pattern.width}x${pattern.height}:${pattern.cells.join("")}`;
}

export function canonicalizeBinaryPattern(pattern) {
  const transforms = [
    (x, y) => [x, y],
    (x, y, w, h) => [h - 1 - y, x],
    (x, y, w, h) => [w - 1 - x, h - 1 - y],
    (x, y, w) => [y, w - 1 - x],
    (x, y, w) => [w - 1 - x, y],
    (x, y, w, h) => [h - 1 - y, w - 1 - x],
    (x, y, w, h) => [x, h - 1 - y],
    (x, y) => [y, x]
  ];
  const variants = transforms.map((fn) => transform(pattern, fn));
  const unique = [...new Map(variants.map((item) => [signature(item), item])).values()];
  unique.sort((a, b) => signature(a).localeCompare(signature(b)));
  const ownSignature = signature(pattern);
  const symmetryCount = unique.filter((item) => signature(item) === ownSignature).length;
  return {
    ...unique[0],
    signature: signature(unique[0]),
    symmetryScore: Math.min(1, symmetryCount / 8),
    symmetryCount
  };
}

export function suppressNestedOccurrences(items) {
  return items.filter((item, index) => {
    const itemKeys = new Set(item.coveredKeys);
    return !items.some((other, otherIndex) => {
      if (index === otherIndex || other.coveredKeys.length <= item.coveredKeys.length) return false;
      if (item.externallyAccessible === true && (item.accessibleBoundaryInterfaces || 0) > 0) return false;
      const otherKeys = new Set(other.coveredKeys);
      return [...itemKeys].every((cell) => otherKeys.has(cell));
    });
  }).sort((a, b) => b.coveredKeys.length - a.coveredKeys.length || a.coveredKeys[0].localeCompare(b.coveredKeys[0]));
}

export function trackTemporalEpisodes(occurrences) {
  const sorted = occurrences.slice().sort((a, b) =>
    a.runId.localeCompare(b.runId) ||
    a.signature.localeCompare(b.signature) ||
    a.placementKey.localeCompare(b.placementKey) ||
    a.checkpointIndex - b.checkpointIndex
  );
  const archive = new Map();
  const previous = new Map();
  for (const occurrence of sorted) {
    const groupKey = `${occurrence.runId}|${occurrence.signature}|${occurrence.placementKey}`;
    const signatureEntry = archive.get(occurrence.signature) || {
      signature: occurrence.signature,
      detectionCount: 0,
      episodeCount: 0,
      durationSteps: 0,
      firstSeenTurn: occurrence.turn,
      lastSeenTurn: occurrence.turn,
      runs: new Set(),
      seeds: new Set(),
      genomes: new Set()
    };
    signatureEntry.detectionCount += 1;
    signatureEntry.durationSteps += 1;
    signatureEntry.firstSeenTurn = Math.min(signatureEntry.firstSeenTurn, occurrence.turn);
    signatureEntry.lastSeenTurn = Math.max(signatureEntry.lastSeenTurn, occurrence.turn);
    signatureEntry.runs.add(occurrence.runId);
    if (occurrence.seed != null) signatureEntry.seeds.add(occurrence.seed);
    if (occurrence.genomeId != null) signatureEntry.genomes.add(occurrence.genomeId);
    if ((previous.get(groupKey) ?? -Infinity) !== occurrence.checkpointIndex - 1) signatureEntry.episodeCount += 1;
    previous.set(groupKey, occurrence.checkpointIndex);
    archive.set(occurrence.signature, signatureEntry);
  }
  return [...archive.values()].map((item) => ({
    ...item,
    runs: [...item.runs],
    seeds: [...item.seeds],
    genomes: [...item.genomes]
  }));
}

export function aggregateRecurrence(entries, totals = {}) {
  const grouped = new Map();
  for (const entry of entries) {
    const item = grouped.get(entry.signature) || { episodes: 0, runs: new Set(), seeds: new Set(), genomes: new Set() };
    item.episodes += entry.episodeCount ?? 1;
    if (entry.runId != null) item.runs.add(entry.runId);
    if (entry.seed != null) item.seeds.add(entry.seed);
    if (entry.genomeId != null) item.genomes.add(entry.genomeId);
    grouped.set(entry.signature, item);
  }
  return Object.fromEntries([...grouped].map(([itemKey, item]) => [itemKey, {
    withinBoardScore: Math.min(1, item.episodes / Math.max(1, item.runs.size)),
    crossSeedScore: Math.min(1, item.seeds.size / Math.max(1, totals.totalSeeds ?? item.seeds.size)),
    crossGenomeScore: Math.min(1, item.genomes.size / Math.max(1, totals.totalGenomes ?? item.genomes.size))
  }]));
}

export function classifyVoidStructure(pattern, board) {
  const emptyCells = [];
  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      if (pattern.cells[y * pattern.width + x] === "E") emptyCells.push([x, y]);
    }
  }
  if (!emptyCells.length) {
    return { emptyComponentCount: 0, largestEmptyComponentRatio: 0, connectivityScore: 1, classification: "no internal empty cells" };
  }
  const emptySet = new Set(emptyCells.map(([x, y]) => key(x, y)));
  const visited = new Set();
  const components = [];
  let exteriorContact = false;
  for (const [startX, startY] of emptyCells) {
    const startKey = key(startX, startY);
    if (visited.has(startKey)) continue;
    const cells = [];
    const queue = [[startX, startY]];
    visited.add(startKey);
    while (queue.length) {
      const [x, y] = queue.pop();
      cells.push([x, y]);
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        const nextKey = key(nx, ny);
        if (emptySet.has(nextKey) && !visited.has(nextKey)) {
          visited.add(nextKey);
          queue.push([nx, ny]);
        }
        if ((nx < 0 || ny < 0 || nx >= pattern.width || ny >= pattern.height) &&
          empty(board, pattern.originX + nx, pattern.originY + ny)) {
          exteriorContact = true;
        }
      }
    }
    components.push(cells);
  }
  const largest = Math.max(...components.map((item) => item.length));
  const connected = components.length === 1;
  return {
    emptyComponentCount: components.length,
    largestEmptyComponentRatio: largest / emptyCells.length,
    connectivityScore: largest / emptyCells.length,
    classification: `${connected ? "connected" : "fragmented"} + ${exteriorContact ? "exterior contact" : "no exterior contact"}`
  };
}

function normalizedWeights(weights, defaults) {
  const result = {};
  let total = 0;
  for (const [name, fallback] of Object.entries(defaults)) {
    const value = Math.max(0, Number(weights?.[name] ?? fallback) || 0);
    result[name] = value;
    total += value;
  }
  if (!total) return Object.fromEntries(Object.keys(defaults).map((name) => [name, 1 / Object.keys(defaults).length]));
  return Object.fromEntries(Object.entries(result).map(([name, value]) => [name, value / total]));
}

export function computePatternScore(pattern, scoreWeights = defaultPatternSettings().scoreWeights) {
  const weights = normalizedWeights(scoreWeights, defaultPatternSettings().scoreWeights);
  const breakdown = {
    recurrence: Math.max(0, Math.min(1, Number(pattern.recurrence?.score ?? pattern.recurrenceScore ?? 0) || 0)),
    distinctiveness: Math.max(0, Math.min(1, Number(pattern.distinctiveness?.score ?? pattern.distinctivenessScore ?? 0) || 0)),
    symmetry: Math.max(0, Math.min(1, Number(pattern.canonical?.symmetryScore ?? pattern.symmetryScore ?? 0) || 0)),
    void: Math.max(0, Math.min(1, Number(pattern.voidStructure?.connectivityScore ?? pattern.voidStructureScore ?? 0) || 0))
  };
  const totalMotifScore = Number(Object.entries(weights)
    .reduce((sum, [name, weight]) => sum + (breakdown[name] || 0) * weight, 0)
    .toFixed(6));
  return { totalMotifScore, scoreBreakdown: breakdown, appliedScoreWeights: weights };
}

export function mergeDiscoveredPatterns(existing, incoming) {
  const archive = new Map(existing.map((item) => [item.signature, { ...item, methods: [...(item.methods || [])] }]));
  const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
  const unique = (...groups) => [...new Set(groups.flatMap(list).filter((value) => value != null))];
  for (const item of incoming) {
    const current = archive.get(item.signature);
    const methods = new Set([...(current?.methods || []), ...(item.methods || [item.method].filter(Boolean))]);
    const runs = unique(current?.runs, item.runs, item.runId);
    const seeds = unique(current?.seeds, item.seeds, item.seed);
    const genomes = unique(current?.genomes, item.genomes, item.genomeId);
    if (current) {
      archive.set(item.signature, {
        ...current,
        ...item,
        methods: [...methods],
        fitnessActive: current.fitnessActive === true,
        detectionCount: (current.detectionCount || 0) + (item.detectionCount || 1),
        episodeCount: (current.episodeCount || 0) + (item.episodeCount || 1),
        durationSteps: (current.durationSteps || 0) + (item.durationSteps || 1),
        firstSeenTurn: Math.min(current.firstSeenTurn ?? item.firstSeenTurn ?? item.turn ?? 0, item.firstSeenTurn ?? item.turn ?? current.firstSeenTurn ?? 0),
        lastSeenTurn: Math.max(current.lastSeenTurn ?? item.lastSeenTurn ?? item.turn ?? 0, item.lastSeenTurn ?? item.turn ?? current.lastSeenTurn ?? 0),
        runs,
        seeds,
        genomes,
        totalMotifScore: Math.max(current.totalMotifScore || 0, item.totalMotifScore || 0)
      });
    } else {
      archive.set(item.signature, {
        archived: true,
        fitnessActive: false,
        excluded: false,
        ...item,
        methods: [...methods],
        detectionCount: item.detectionCount || 1,
        episodeCount: item.episodeCount || 1,
        durationSteps: item.durationSteps || 1,
        firstSeenTurn: item.firstSeenTurn ?? item.turn,
        lastSeenTurn: item.lastSeenTurn ?? item.turn,
        runs,
        seeds,
        genomes,
        totalMotifScore: item.totalMotifScore || 0
      });
    }
  }
  return [...archive.values()].sort((a, b) => (b.totalMotifScore || 0) - (a.totalMotifScore || 0));
}

export function activeMotifFitness(motifs) {
  const active = motifs.filter((motif) => motif.fitnessActive === true && motif.excluded !== true);
  if (!active.length) return 0;
  const weighted = active.reduce((sum, motif) => {
    const weight = Math.max(0, Number(motif.fitnessWeight ?? 1) || 0);
    return {
      score: sum.score + (motif.totalMotifScore || 0) * weight,
      weight: sum.weight + weight
    };
  }, { score: 0, weight: 0 });
  if (!weighted.weight) return 0;
  return Number(Math.max(0, Math.min(1, weighted.score / weighted.weight)).toFixed(6));
}
