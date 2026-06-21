export const CELL = Object.freeze({
  IGNORE: 0,
  REQUIRED: 1,
  OPTIONAL: 2,
  EMPTY: 3
});

const index = (width, x, y) => y * width + x;
const occupied = (board, x, y) =>
  x >= 0 && y >= 0 && x < board.size && y < board.size && board.cells[index(board.size, x, y)] > 0;

function transformMotif(motif, transform) {
  const points = [];
  for (let y = 0; y < motif.height; y += 1) {
    for (let x = 0; x < motif.width; x += 1) {
      const [tx, ty] = transform(x, y, motif.width, motif.height);
      points.push({ x: tx, y: ty, value: motif.cells[index(motif.width, x, y)] });
    }
  }
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells = Array(width * height).fill(CELL.IGNORE);
  for (const point of points) cells[index(width, point.x - minX, point.y - minY)] = point.value;
  return { ...motif, width, height, cells };
}

function motifSignature(motif) {
  return `${motif.width}x${motif.height}:${motif.cells.join("")}`;
}

export function uniqueOrientations(motif) {
  const transforms = [];
  const rotate = [
    (x, y) => [x, y],
    (x, y, w, h) => [h - 1 - y, x],
    (x, y, w, h) => [w - 1 - x, h - 1 - y],
    (x, y, w) => [y, w - 1 - x]
  ];
  transforms.push(...rotate);
  transforms.push(
    (x, y, w) => [w - 1 - x, y],
    (x, y, w, h) => [h - 1 - y, w - 1 - x],
    (x, y, w, h) => [x, h - 1 - y],
    (x, y) => [y, x]
  );
  const seen = new Set();
  const result = [];
  for (const transform of transforms) {
    const item = transformMotif(motif, transform);
    const signature = motifSignature(item);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(item);
    }
  }
  return result;
}

export function matchMotifAt(board, motif, originX, originY) {
  let targetCount = 0;
  let matched = 0;
  const occupiedKeys = [];
  for (let y = 0; y < motif.height; y += 1) {
    for (let x = 0; x < motif.width; x += 1) {
      const state = motif.cells[index(motif.width, x, y)];
      const bx = originX + x;
      const by = originY + y;
      const isOccupied = occupied(board, bx, by);
      if (state === CELL.EMPTY && isOccupied) return null;
      if (state === CELL.REQUIRED || state === CELL.OPTIONAL) {
        targetCount += 1;
        if (isOccupied) {
          matched += 1;
          occupiedKeys.push(`${bx},${by}`);
        }
      }
    }
  }
  if (!targetCount) return null;
  const completion = matched / targetCount;
  if (completion < (motif.minCompletion ?? 1)) return null;
  return {
    motifId: motif.id,
    completion,
    targetCount,
    weight: motif.weight || 0,
    occupiedKeys,
    center: [originX + (motif.width - 1) / 2, originY + (motif.height - 1) / 2],
    originX,
    originY
  };
}

export function findMotifMatches(board, motifs) {
  const matches = [];
  for (const motif of motifs.filter((item) => item.enabled !== false)) {
    for (const orientation of uniqueOrientations(motif)) {
      for (let y = 0; y <= board.size - orientation.height; y += 1) {
        for (let x = 0; x <= board.size - orientation.width; x += 1) {
          if (motif.frontage && !hasFrontage(board, x, y)) continue;
          const match = matchMotifAt(board, orientation, x, y);
          if (match) matches.push(match);
        }
      }
    }
  }
  return matches;
}

export function findPatternOccurrences(board, pattern) {
  const motif = {
    id: pattern.signature || pattern.id || "pattern",
    width: pattern.width,
    height: pattern.height,
    cells: pattern.cells.map((value) => {
      if (value === "O" || value === CELL.REQUIRED || value === CELL.OPTIONAL) return CELL.REQUIRED;
      if (value === "E" || value === CELL.EMPTY) return CELL.EMPTY;
      return value ? CELL.REQUIRED : CELL.IGNORE;
    }),
    minCompletion: 1,
    enabled: true,
    weight: 0
  };
  const seen = new Set();
  const matches = [];
  for (const orientation of uniqueOrientations(motif)) {
    for (let y = 0; y <= board.size - orientation.height; y += 1) {
      for (let x = 0; x <= board.size - orientation.width; x += 1) {
        const match = matchMotifAt(board, orientation, x, y);
        if (!match) continue;
        const key = match.occupiedKeys.slice().sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({
          ...match,
          patternWidth: orientation.width,
          patternHeight: orientation.height
        });
      }
    }
  }
  return matches;
}

export function selectedMotifOccurrences(board, motifs) {
  return allocateMatches(findMotifMatches(board, motifs));
}

export function allocateMatches(matches) {
  const sorted = matches.slice().sort((a, b) =>
    b.completion - a.completion ||
    b.targetCount - a.targetCount ||
    Math.abs(b.weight) - Math.abs(a.weight) ||
    a.originY - b.originY ||
    a.originX - b.originX
  );
  const used = new Set();
  const selected = [];
  for (const match of sorted) {
    if (match.occupiedKeys.some((key) => used.has(key))) continue;
    selected.push(match);
    for (const key of match.occupiedKeys) used.add(key);
  }
  return selected;
}

export function hasFrontage(board, x, y) {
  if (![occupied(board, x, y), occupied(board, x + 1, y), occupied(board, x, y + 1), occupied(board, x + 1, y + 1)].every(Boolean)) return false;
  const sides = [
    [[x, y - 1], [x + 1, y - 1]],
    [[x + 2, y], [x + 2, y + 1]],
    [[x, y + 2], [x + 1, y + 2]],
    [[x - 1, y], [x - 1, y + 1]]
  ];
  return sides.some((side) => side.every(([sx, sy]) => !occupied(board, sx, sy)));
}

export function motifFitness(matches, motifs, boardSize) {
  const motifMap = new Map(motifs.map((motif) => [motif.id, motif]));
  const groups = new Map();
  for (const match of matches) {
    if (!groups.has(match.motifId)) groups.set(match.motifId, []);
    groups.get(match.motifId).push(match);
  }
  let total = 0;
  for (const [motifId, group] of groups) {
    const motif = motifMap.get(motifId);
    if (!motif || !group.length) continue;
    const meanCompletion = group.reduce((sum, item) => sum + item.completion, 0) / group.length;
    const xs = group.map((item) => item.center[0]);
    const ys = group.map((item) => item.center[1]);
    const spread = group.length === 1 ? 0.5 : Math.min(1, (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) / (2 * Math.max(1, boardSize - 1)));
    total += (motif.weight || 0) * meanCompletion * Math.sqrt(group.length) * (0.5 + spread * 0.5);
  }
  return Math.tanh(total / 200);
}

function cropBinary(points) {
  const minX = Math.min(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells = Array(width * height).fill(0);
  for (const [x, y] of points) cells[index(width, x - minX, y - minY)] = 1;
  return { width, height, cells, occupiedCount: points.length };
}

function canonicalBinary(pattern) {
  const motif = { ...pattern, cells: pattern.cells.map((value) => value ? CELL.REQUIRED : CELL.IGNORE) };
  return uniqueOrientations(motif).map(motifSignature).sort()[0];
}

export function discoverPatterns(board, options = {}) {
  const minSize = Math.max(1, options.minSize ?? 6);
  const maxSize = Math.max(minSize, options.maxSize ?? 36);
  const sampleLimit = Math.max(1, options.sampleLimit ?? 100);
  const windowSize = Math.max(3, options.windowSize ?? 7);
  const radius = Math.floor(windowSize / 2);
  const found = new Map();
  const seenCells = new Set();

  for (let startY = 0; startY < board.size && found.size < sampleLimit; startY += 1) {
    for (let startX = 0; startX < board.size && found.size < sampleLimit; startX += 1) {
      const startKey = `${startX},${startY}`;
      if (!occupied(board, startX, startY) || seenCells.has(startKey)) continue;
      const queue = [[startX, startY]];
      const component = [];
      seenCells.add(startKey);
      while (queue.length) {
        const [x, y] = queue.pop();
        component.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const nextKey = `${nx},${ny}`;
          if (occupied(board, nx, ny) && !seenCells.has(nextKey)) {
            seenCells.add(nextKey);
            queue.push([nx, ny]);
          }
        }
      }
      if (component.length >= minSize) {
        const pattern = cropBinary(component);
        const signature = canonicalBinary(pattern);
        found.set(signature, { signature, ...pattern, occurrences: 1, source: "component" });
      }
    }
  }

  for (let y = 0; y < board.size && found.size < sampleLimit; y += 1) {
    for (let x = 0; x < board.size && found.size < sampleLimit; x += 1) {
      if (!occupied(board, x, y)) continue;
      const points = [];
      for (let wy = Math.max(0, y - radius); wy <= Math.min(board.size - 1, y + radius); wy += 1) {
        for (let wx = Math.max(0, x - radius); wx <= Math.min(board.size - 1, x + radius); wx += 1) {
          if (occupied(board, wx, wy)) points.push([wx, wy]);
        }
      }
      if (points.length < minSize || points.length > maxSize) continue;
      const pattern = cropBinary(points);
      const signature = canonicalBinary(pattern);
      if (!found.has(signature)) found.set(signature, { signature, ...pattern, occurrences: 1, source: "local" });
      else found.get(signature).occurrences += 1;
    }
  }
  return [...found.values()].slice(0, sampleLimit);
}
