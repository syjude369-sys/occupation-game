const clamp01 = (value) => Math.max(0, Math.min(1, value));
const indexOf = (size, x, y) => y * size + x;

function playerIds(board) {
  return [...new Set(board.cells.filter((value) => value >= 0))].sort((a, b) => a - b);
}

export function continuityScore(board) {
  const { size, cells } = board;
  const scores = [];
  for (const player of playerIds(board)) {
    const owned = cells.reduce((count, value) => count + (value === player ? 1 : 0), 0);
    if (!owned) continue;
    const seen = new Set();
    let largest = 0;
    for (let i = 0; i < cells.length; i += 1) {
      if (cells[i] !== player || seen.has(i)) continue;
      const queue = [i];
      seen.add(i);
      let count = 0;
      while (queue.length) {
        const current = queue.pop();
        count += 1;
        const x = current % size;
        const y = Math.floor(current / size);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const next = indexOf(size, nx, ny);
          if (cells[next] === player && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      largest = Math.max(largest, count);
    }
    scores.push(largest / owned);
  }
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
}

export function interpenetrationScore(board, scales = [3, 5, 7]) {
  const { size, cells } = board;
  const players = playerIds(board);
  if (players.length < 2) return 0;
  let total = 0;
  let samples = 0;
  for (const scale of scales) {
    const radius = Math.floor(scale / 2);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (cells[indexOf(size, x, y)] < 0) continue;
        const local = new Set();
        for (let ny = Math.max(0, y - radius); ny <= Math.min(size - 1, y + radius); ny += 1) {
          for (let nx = Math.max(0, x - radius); nx <= Math.min(size - 1, x + radius); nx += 1) {
            const value = cells[indexOf(size, nx, ny)];
            if (value >= 0) local.add(value);
          }
        }
        total += (local.size - 1) / (players.length - 1);
        samples += 1;
      }
    }
  }
  return samples ? clamp01(total / samples) : 0;
}

export function sharedBoundaryScore(board) {
  const { size, cells } = board;
  let unlike = 0;
  let occupiedEdges = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = cells[indexOf(size, x, y)];
      if (value < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= size || ny >= size) continue;
        const neighbor = cells[indexOf(size, nx, ny)];
        if (neighbor < 0) continue;
        occupiedEdges += 1;
        if (neighbor !== value) unlike += 1;
      }
    }
  }
  return occupiedEdges ? unlike / occupiedEdges : 0;
}

export function occupancyBalanceScore(board, playerCount) {
  if (playerCount <= 1) return 1;
  const counts = Array(playerCount).fill(0);
  for (const value of board.cells) if (value >= 0 && value < playerCount) counts[value] += 1;
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const mean = total / playerCount;
  const deviation = counts.reduce((sum, value) => sum + Math.abs(value - mean), 0);
  const maxDeviation = 2 * total * (1 - 1 / playerCount);
  return clamp01(1 - deviation / maxDeviation);
}

function transformedCells(board, transform) {
  const { size, cells } = board;
  const result = Array(cells.length).fill(-1);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [tx, ty] = transform(x, y, size);
      result[indexOf(size, tx, ty)] = cells[indexOf(size, x, y)];
    }
  }
  return result;
}

function relabel(cells) {
  const labels = new Map();
  let next = 0;
  return cells.map((value) => {
    if (value < 0) return ".";
    if (!labels.has(value)) labels.set(value, next++);
    return labels.get(value).toString(36);
  }).join("");
}

export function canonicalPattern(board) {
  const transforms = [
    (x, y) => [x, y],
    (x, y, n) => [n - 1 - y, x],
    (x, y, n) => [n - 1 - x, n - 1 - y],
    (x, y, n) => [y, n - 1 - x],
    (x, y, n) => [n - 1 - x, y],
    (x, y, n) => [x, n - 1 - y],
    (x, y) => [y, x],
    (x, y, n) => [n - 1 - y, n - 1 - x]
  ];
  return transforms
    .map((transform) => relabel(transformedCells(board, transform)))
    .sort()[0];
}

export function patternFrequency(boards) {
  const counts = new Map();
  const representatives = new Map();
  for (const board of boards) {
    const pattern = typeof board === "string" ? board : canonicalPattern(board);
    counts.set(pattern, (counts.get(pattern) || 0) + 1);
    if (!representatives.has(pattern)) representatives.set(pattern, board);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topPattern = "", topCount = 0] = sorted[0] || [];
  return {
    topPattern,
    topCount,
    reproductionRate: boards.length ? topCount / boards.length : 0,
    distinctCount: counts.size,
    representative: representatives.get(topPattern)
  };
}

export function evaluateState(board, playerCount) {
  return {
    continuity: continuityScore(board),
    interpenetration: interpenetrationScore(board),
    boundary: sharedBoundaryScore(board),
    balance: occupancyBalanceScore(board, playerCount)
  };
}
