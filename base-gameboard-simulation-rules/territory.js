function parseKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function shouldSkipTerritoryCandidate(candidateKey, player, occupied, options) {
  if (!options.enabled || options.turn < options.startTurn) return false;

  const candidate = parseKey(candidateKey);
  let ownDistance = Infinity;
  let opponentDistance = Infinity;

  for (const [key, owner] of occupied) {
    const distance = manhattan(candidate, parseKey(key));
    if (owner === player) {
      ownDistance = Math.min(ownDistance, distance);
    } else {
      opponentDistance = Math.min(opponentDistance, distance);
    }
  }

  if (!Number.isFinite(ownDistance) || !Number.isFinite(opponentDistance)) return false;
  return ownDistance < opponentDistance;
}

export function connectedGroupsAtLeast(occupied, threshold) {
  const protectedKeys = new Set();
  const visited = new Set();
  const required = Math.max(1, Math.round(threshold));
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const [startKey, owner] of occupied) {
    if (visited.has(startKey)) continue;
    const group = [];
    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const key = queue.pop();
      group.push(key);
      const point = parseKey(key);
      for (const [dx, dy] of neighbors) {
        const neighborKey = `${point.x + dx},${point.y + dy}`;
        if (!visited.has(neighborKey) && occupied.get(neighborKey) === owner) {
          visited.add(neighborKey);
          queue.push(neighborKey);
        }
      }
    }

    if (group.length >= required) {
      for (const key of group) protectedKeys.add(key);
    }
  }

  return protectedKeys;
}
