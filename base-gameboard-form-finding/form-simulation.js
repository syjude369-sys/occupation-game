import { createSeededRandom, normalizeMoveWeights } from "./form-search.js";

const key = (x, y) => `${x},${y}`;
const parse = (value) => {
  const [x, y] = value.split(",").map(Number);
  return { x, y };
};

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function seeds(size, players) {
  const radius = (size - 1) * 0.25;
  const center = (size - 1) / 2;
  const used = new Set();
  const result = [];
  for (let player = 0; player < players; player += 1) {
    const angle = Math.PI * 2 * player / players;
    let x = Math.round(center + Math.cos(angle) * radius);
    let y = Math.round(center + Math.sin(angle) * radius);
    while (used.has(key(x, y))) x = Math.min(size - 1, x + 1);
    used.add(key(x, y));
    result.push({ x, y });
  }
  return result;
}

function moveCandidates(mode, origin, size) {
  const result = [];
  const directions = {
    rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    knight: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
  };
  if (mode === "knight") {
    for (const [dx, dy] of directions.knight) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) result.push(key(x, y));
    }
    return result;
  }
  for (let step = 1; step < size && result.length < 12; step += 1) {
    for (const [dx, dy] of directions[mode]) {
      const x = origin.x + dx * step;
      const y = origin.y + dy * step;
      if (x >= 0 && y >= 0 && x < size && y < size) result.push(key(x, y));
    }
  }
  return result.slice(0, 12);
}

function selectMode(weights, random) {
  const roll = random();
  if (roll < weights.rook) return "rook";
  if (roll < weights.rook + weights.bishop) return "bishop";
  return "knight";
}

function rookDistance(a, b) {
  if (a.x !== b.x && a.y !== b.y) return Infinity;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function lineVisible(attacker, target, defender, occupied) {
  if (attacker.x !== target.x && attacker.y !== target.y) return false;
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  for (let x = attacker.x + dx, y = attacker.y + dy; x !== target.x || y !== target.y; x += dx, y += dy) {
    if (occupied.get(key(x, y)) === defender) return false;
  }
  return true;
}

function canCapture(targetKey, player, occupied) {
  const defender = occupied.get(targetKey);
  if (defender == null || defender === player) return false;
  const target = parse(targetKey);
  let defenderDistance = Infinity;
  for (const [cell, owner] of occupied) {
    if (owner !== defender || cell === targetKey) continue;
    defenderDistance = Math.min(defenderDistance, rookDistance(parse(cell), target));
  }
  for (const [cell, owner] of occupied) {
    if (owner !== player) continue;
    const attacker = parse(cell);
    const distance = rookDistance(attacker, target);
    if (distance <= defenderDistance && lineVisible(attacker, target, defender, occupied)) return true;
  }
  return false;
}

export function simulateFinalState(settings, seed) {
  const size = Math.max(4, Math.round(settings.size));
  const players = Math.max(2, Math.round(settings.players));
  const turns = Math.max(0, Math.round(settings.turns));
  const cap = Math.max(1, Math.round(settings.cellCap ?? size * size));
  const attack = Math.max(0, Math.min(100, Number(settings.attack) || 0)) / 100;
  const weights = normalizeMoveWeights(settings);
  const random = createSeededRandom(seed);
  const occupied = new Map();
  seeds(size, players).forEach((point, player) => occupied.set(key(point.x, point.y), player));

  for (let turn = 0; turn < turns; turn += 1) {
    for (let player = 0; player < players; player += 1) {
      const origins = shuffle([...occupied].filter(([, owner]) => owner === player).map(([cell]) => cell), random);
      for (const originKey of origins) {
        if (occupied.get(originKey) !== player) continue;
        const origin = parse(originKey);
        const all = [...new Set([
          ...moveCandidates("rook", origin, size),
          ...moveCandidates("bishop", origin, size),
          ...moveCandidates("knight", origin, size)
        ])];
        const targets = all.filter((candidate) => canCapture(candidate, player, occupied));
        if (targets.length && random() < attack) {
          occupied.set(targets[Math.floor(random() * targets.length)], player);
          continue;
        }
        const mode = selectMode(weights, random);
        const empty = moveCandidates(mode, origin, size).filter((candidate) => !occupied.has(candidate));
        if (!empty.length) continue;
        const owned = [...occupied.values()].filter((owner) => owner === player).length;
        if (owned >= cap) continue;
        occupied.set(empty[Math.floor(random() * empty.length)], player);
      }
    }
  }

  const cells = Array(size * size).fill(-1);
  for (const [cell, player] of occupied) {
    const { x, y } = parse(cell);
    cells[y * size + x] = player;
  }
  return { size, cells };
}
