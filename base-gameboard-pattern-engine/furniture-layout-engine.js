// furniture-layout-engine.js
// Spec: docs/furniture_engine_ruleset.md
// Cell: O(1/2)=occupied(furniture+plants), E(3)=empty interior(plants only), 0=exterior

// ── Constants ────────────────────────────────────────────────────────────────

export const CELL_SIZE_MM = 1500;
export const FINE_GRID_MM = 100;
export const MIN_PATH_WIDTH_MM = 900;
export const PREFERRED_PATH_WIDTH_MM = 1500;
export const SMALL_PLANT_MIN_WIDTH_MM = 300;

const CELL_REQUIRED = 1;
const CELL_OPTIONAL = 2;
const CELL_EMPTY    = 3;

// Fine-grid cell values
const FG_EXTERIOR  = 0;
const FG_O         = 1;
const FG_E         = 2;
const FG_BLOCKED   = 3;  // hard furniture footprint
const FG_CLEARANCE = 4;  // required clearance zone

// ── Motif normalization ───────────────────────────────────────────────────────

export function normalizeMotifForFurniture(motif, options = {}) {
  const cellSizeMm = motif.cellSizeMm ?? options.cellSizeMm ?? CELL_SIZE_MM;
  const cells = [];

  for (let y = 0; y < motif.height; y++) {
    for (let x = 0; x < motif.width; x++) {
      const raw = motif.cells[y * motif.width + x];
      let type;
      if (raw === 'O' || raw === CELL_REQUIRED || raw === CELL_OPTIONAL) type = 'occupied';
      else if (raw === 'E' || raw === CELL_EMPTY) type = 'empty';
      else type = 'ignore';

      cells.push({ x, y, type, mmX: x * cellSizeMm, mmY: y * cellSizeMm, mmWidth: cellSizeMm, mmHeight: cellSizeMm });
    }
  }

  const occupiedCells = cells.filter(c => c.type === 'occupied');
  const emptyCells    = cells.filter(c => c.type === 'empty');

  return {
    motifId: motif.motifId ?? motif.id ?? null,
    signature: motif.signature ?? null,
    width: motif.width,
    height: motif.height,
    cellSizeMm,
    cells,
    occupiedCells,
    emptyCells,
    boundsMMWidth:  motif.width  * cellSizeMm,
    boundsMMHeight: motif.height * cellSizeMm,
    accessibleEdges: motif.accessibleEdges ?? [],
    source: motif.source ?? null,
  };
}

export function cellToMm(cellCoord, cellSizeMm) {
  return cellCoord * cellSizeMm;
}

// ── Rectangle geometry ────────────────────────────────────────────────────────

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// ── Asset classification ──────────────────────────────────────────────────────

export function isGridFillingAsset(asset, cellSizeMm = CELL_SIZE_MM) {
  const wRatio = asset.footprintMm.width  / cellSizeMm;
  const dRatio = asset.footprintMm.depth  / cellSizeMm;
  return Math.abs(wRatio - Math.round(wRatio)) < 0.01 &&
         Math.abs(dRatio - Math.round(dRatio)) < 0.01;
}

export function getEffectiveDimensions(footprintMm, rotation) {
  const rotated = rotation === 90 || rotation === 270;
  return {
    width: rotated ? footprintMm.depth : footprintMm.width,
    depth: rotated ? footprintMm.width : footprintMm.depth,
  };
}

export function generateTransforms(asset) {
  const rotations = asset.allowedRotations ?? [0, 90, 180, 270];
  const mirrors   = asset.allowsMirror ? [false, true] : [false];
  const transforms = [];
  const seen = new Set();

  for (const rotation of rotations) {
    for (const mirrored of mirrors) {
      const dim = getEffectiveDimensions(asset.footprintMm, rotation);
      const accessKey = (asset.requiredAccessEdges ?? [])
        .map(side => mapAccessSide(side, rotation, mirrored)).sort().join(',');
      const key = `${dim.width}x${dim.depth}|${accessKey}|${mirrored}`;
      if (!seen.has(key)) {
        seen.add(key);
        transforms.push({ rotation, mirrored });
      }
    }
  }
  return transforms;
}

// Access side to world direction mapping
// rot=0: front=S, back=N, left=W, right=E
// mirror flips E<->W
const ACCESS_MAP = {
  0:   { front: 'S', back: 'N', left: 'W', right: 'E' },
  90:  { front: 'W', back: 'E', left: 'S', right: 'N' },
  180: { front: 'N', back: 'S', left: 'E', right: 'W' },
  270: { front: 'E', back: 'W', left: 'N', right: 'S' },
};

function mapAccessSide(logicalSide, rotation, mirrored) {
  let dir = ACCESS_MAP[rotation]?.[logicalSide] ?? logicalSide;
  if (mirrored) {
    if (dir === 'E') dir = 'W';
    else if (dir === 'W') dir = 'E';
  }
  return dir;
}

// ── Fine grid ─────────────────────────────────────────────────────────────────

export function buildFineGrid(normalizedMotif, fineGridMm = FINE_GRID_MM) {
  const { width: cellW, height: cellH, cellSizeMm } = normalizedMotif;
  const ratio = cellSizeMm / fineGridMm;
  const fgW = Math.round(cellW * ratio);
  const fgH = Math.round(cellH * ratio);

  const grid = new Uint8Array(fgW * fgH).fill(FG_EXTERIOR);

  for (const cell of normalizedMotif.occupiedCells) {
    const x0 = Math.round(cell.x * ratio);
    const y0 = Math.round(cell.y * ratio);
    for (let dy = 0; dy < ratio; dy++) {
      for (let dx = 0; dx < ratio; dx++) {
        grid[(y0 + dy) * fgW + (x0 + dx)] = FG_O;
      }
    }
  }

  for (const cell of normalizedMotif.emptyCells) {
    const x0 = Math.round(cell.x * ratio);
    const y0 = Math.round(cell.y * ratio);
    for (let dy = 0; dy < ratio; dy++) {
      for (let dx = 0; dx < ratio; dx++) {
        grid[(y0 + dy) * fgW + (x0 + dx)] = FG_E;
      }
    }
  }

  return { grid, fgW, fgH, fineGridMm, ratio };
}

function paintRect(grid, fgW, fgH, rectMm, value, fineGridMm) {
  const x0 = Math.floor(rectMm.x / fineGridMm);
  const y0 = Math.floor(rectMm.y / fineGridMm);
  const x1 = Math.ceil((rectMm.x + rectMm.width)  / fineGridMm);
  const y1 = Math.ceil((rectMm.y + rectMm.height) / fineGridMm);
  for (let fy = Math.max(0, y0); fy < Math.min(fgH, y1); fy++) {
    for (let fx = Math.max(0, x0); fx < Math.min(fgW, x1); fx++) {
      grid[fy * fgW + fx] = value;
    }
  }
}

function applyPlacementsToGrid(fgData, placements) {
  const { grid, fgW, fgH, fineGridMm } = fgData;
  const g = new Uint8Array(grid);

  for (const p of placements) {
    const dim = getEffectiveDimensions(p.footprintMm, p.rotation);
    paintRect(g, fgW, fgH, { x: p.xMm, y: p.yMm, width: dim.width, height: dim.depth }, FG_BLOCKED, fineGridMm);
    for (const zone of (p.clearanceZones ?? [])) {
      const cRect = clearanceRectMm(p, zone.side, zone.distanceMm);
      if (cRect) paintRect(g, fgW, fgH, cRect, FG_CLEARANCE, fineGridMm);
    }
  }
  return { ...fgData, grid: g };
}

function clearanceRectMm(placement, logicalSide, distanceMm) {
  const dir = mapAccessSide(logicalSide, placement.rotation ?? 0, placement.mirrored ?? false);
  const dim = getEffectiveDimensions(placement.footprintMm, placement.rotation ?? 0);
  const x = placement.xMm, y = placement.yMm, w = dim.width, d = dim.depth;
  switch (dir) {
    case 'S': return { x, y: y + d, width: w, height: distanceMm };
    case 'N': return { x, y: y - distanceMm, width: w, height: distanceMm };
    case 'E': return { x: x + w, y, width: distanceMm, height: d };
    case 'W': return { x: x - distanceMm, y, width: distanceMm, height: d };
    default:  return null;
  }
}

// ── Free space discovery ──────────────────────────────────────────────────────

export function discoverFreeComponents(fgData) {
  const { grid, fgW, fgH } = fgData;
  const visited  = new Uint8Array(fgW * fgH);
  const components = [];

  for (let i = 0; i < fgW * fgH; i++) {
    if (visited[i] || grid[i] === FG_BLOCKED || grid[i] === FG_EXTERIOR) continue;

    const pixels = [];
    let touchesBoundary = false;
    const queue = [i];
    visited[i] = 1;

    while (queue.length) {
      const cur = queue.pop();
      pixels.push(cur);
      const fy = Math.floor(cur / fgW);
      const fx = cur % fgW;
      if (fx === 0 || fx === fgW - 1 || fy === 0 || fy === fgH - 1) touchesBoundary = true;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = fx + dx, ny = fy + dy;
        if (nx < 0 || ny < 0 || nx >= fgW || ny >= fgH) continue;
        const ni = ny * fgW + nx;
        if (visited[ni] || grid[ni] === FG_BLOCKED || grid[ni] === FG_EXTERIOR) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }

    components.push({ pixels, touchesBoundary, size: pixels.length });
  }

  return components;
}

// ── Candidate generation ──────────────────────────────────────────────────────

export function generateGridFillingCandidates(asset, normalizedMotif) {
  const { cellSizeMm, occupiedCells, width, height } = normalizedMotif;
  const occupiedSet = new Set(occupiedCells.map(c => `${c.x},${c.y}`));
  const transforms = generateTransforms(asset);
  const candidates = [];

  for (const tf of transforms) {
    const dim = getEffectiveDimensions(asset.footprintMm, tf.rotation);
    const cellsW = Math.round(dim.width  / cellSizeMm);
    const cellsH = Math.round(dim.depth  / cellSizeMm);

    for (let cy = 0; cy <= height - cellsH; cy++) {
      for (let cx = 0; cx <= width - cellsW; cx++) {
        let allOccupied = true;
        for (let dy = 0; dy < cellsH && allOccupied; dy++) {
          for (let dx = 0; dx < cellsW && allOccupied; dx++) {
            if (!occupiedSet.has(`${cx + dx},${cy + dy}`)) allOccupied = false;
          }
        }
        if (allOccupied) {
          candidates.push({
            assetId: asset.id,
            xMm: cx * cellSizeMm,
            yMm: cy * cellSizeMm,
            rotation: tf.rotation,
            mirrored: tf.mirrored,
            footprintMm: asset.footprintMm,
            clearanceZones: asset.clearanceZones ?? [],
            requiredAccessEdges: asset.requiredAccessEdges ?? [],
            category: asset.category,
            capacity: asset.capacity ?? 0,
            planningAreaCells: cellsW * cellsH,
          });
        }
      }
    }
  }
  return candidates;
}

export function generatePartialCellCandidates(asset, normalizedMotif) {
  const { cellSizeMm, occupiedCells } = normalizedMotif;
  const transforms = generateTransforms(asset);
  const candidates = [];
  const SNAP = FINE_GRID_MM;

  const alignments = [
    (cx, cy, ew, ed) => ({ x: cx,                    y: cy }),
    (cx, cy, ew, ed) => ({ x: cx + cellSizeMm - ew,  y: cy }),
    (cx, cy, ew, ed) => ({ x: cx,                    y: cy + cellSizeMm - ed }),
    (cx, cy, ew, ed) => ({ x: cx + cellSizeMm - ew,  y: cy + cellSizeMm - ed }),
    (cx, cy, ew, ed) => ({ x: cx,                    y: cy + Math.round((cellSizeMm - ed) / 2 / SNAP) * SNAP }),
    (cx, cy, ew, ed) => ({ x: cx + cellSizeMm - ew,  y: cy + Math.round((cellSizeMm - ed) / 2 / SNAP) * SNAP }),
    (cx, cy, ew, ed) => ({ x: cx + Math.round((cellSizeMm - ew) / 2 / SNAP) * SNAP, y: cy }),
    (cx, cy, ew, ed) => ({ x: cx + Math.round((cellSizeMm - ew) / 2 / SNAP) * SNAP, y: cy + cellSizeMm - ed }),
  ];

  for (const cell of occupiedCells) {
    const cxMm = cell.mmX, cyMm = cell.mmY;
    for (const tf of transforms) {
      const dim = getEffectiveDimensions(asset.footprintMm, tf.rotation);
      if (dim.width > cellSizeMm || dim.depth > cellSizeMm) continue;

      for (const align of alignments) {
        const pos = align(cxMm, cyMm, dim.width, dim.depth);
        const xMm = Math.round(pos.x / SNAP) * SNAP;
        const yMm = Math.round(pos.y / SNAP) * SNAP;

        if (xMm < cxMm || yMm < cyMm ||
            xMm + dim.width > cxMm + cellSizeMm ||
            yMm + dim.depth > cyMm + cellSizeMm) continue;

        const planningAreaCells = (asset.footprintMm.width * asset.footprintMm.depth) /
                                  (cellSizeMm * cellSizeMm);
        candidates.push({
          assetId: asset.id,
          xMm, yMm,
          rotation: tf.rotation,
          mirrored: tf.mirrored,
          footprintMm: asset.footprintMm,
          clearanceZones: asset.clearanceZones ?? [],
          requiredAccessEdges: asset.requiredAccessEdges ?? [],
          category: asset.category,
          capacity: asset.capacity ?? 0,
          planningAreaCells,
        });
      }
    }
  }

  const seen = new Set();
  return candidates.filter(c => {
    const k = `${c.xMm},${c.yMm},${c.rotation},${c.mirrored}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ── Layout validation ─────────────────────────────────────────────────────────

export function validateLayout(placements, normalizedMotif, fineGridMm = FINE_GRID_MM) {
  const base = buildFineGrid(normalizedMotif, fineGridMm);
  const { occupiedCells, cellSizeMm } = normalizedMotif;
  const occupiedSet = new Set(occupiedCells.map(c => `${c.x},${c.y}`));
  const reasons = [];

  for (const p of placements) {
    if (p.category === 'landscape') continue;
    const dim = getEffectiveDimensions(p.footprintMm, p.rotation);
    const x0c = Math.floor(p.xMm / cellSizeMm);
    const y0c = Math.floor(p.yMm / cellSizeMm);
    const x1c = Math.ceil((p.xMm + dim.width)  / cellSizeMm);
    const y1c = Math.ceil((p.yMm + dim.depth) / cellSizeMm);
    for (let cy = y0c; cy < y1c; cy++) {
      for (let cx = x0c; cx < x1c; cx++) {
        if (!occupiedSet.has(`${cx},${cy}`)) {
          reasons.push(`${p.assetId} footprint outside O-cells`);
        }
      }
    }
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j];
      const da = getEffectiveDimensions(a.footprintMm, a.rotation);
      const db = getEffectiveDimensions(b.footprintMm, b.rotation);
      if (rectsOverlap(
        { x: a.xMm, y: a.yMm, width: da.width, height: da.depth },
        { x: b.xMm, y: b.yMm, width: db.width, height: db.depth }
      )) {
        reasons.push(`${a.assetId} overlaps ${b.assetId}`);
      }
    }
  }

  const fgAfter = applyPlacementsToGrid(base, placements);
  const components = discoverFreeComponents(fgAfter);
  const boundaryPixelSet = new Set(
    components.filter(c => c.touchesBoundary).flatMap(c => c.pixels)
  );
  const { fgW, fgH, grid } = fgAfter;

  for (const p of placements) {
    const accessEdges = p.requiredAccessEdges ?? [];
    if (accessEdges.length === 0) continue;

    for (const logicalSide of accessEdges) {
      const cRect = clearanceRectMm(p, logicalSide, MIN_PATH_WIDTH_MM);
      if (!cRect) continue;
      const x0 = Math.floor(cRect.x / fineGridMm);
      const y0 = Math.floor(cRect.y / fineGridMm);
      const x1 = Math.ceil((cRect.x + cRect.width)  / fineGridMm);
      const y1 = Math.ceil((cRect.y + cRect.height) / fineGridMm);

      let accessible = false;
      outer: for (let fy = y0; fy < y1 && !accessible; fy++) {
        for (let fx = x0; fx < x1 && !accessible; fx++) {
          if (fx < 0 || fy < 0 || fx >= fgW || fy >= fgH) continue;
          const pi = fy * fgW + fx;
          if (grid[pi] === FG_EXTERIOR || boundaryPixelSet.has(pi)) accessible = true;
        }
      }
      if (!accessible) reasons.push(`${p.assetId} access ${logicalSide} not boundary-connected`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

// ── Residual space classification ─────────────────────────────────────────────

function classifyResidual(fgData) {
  const components = discoverFreeComponents(fgData);
  const paths = [], largePlanting = [], smallPlanting = [], buffer = [], unused = [];

  for (const comp of components) {
    const approxWidth = Math.sqrt(comp.pixels.length) * fgData.fineGridMm;
    if (comp.touchesBoundary && approxWidth >= MIN_PATH_WIDTH_MM) {
      paths.push(comp);
    } else if (approxWidth >= SMALL_PLANT_MIN_WIDTH_MM) {
      if (comp.touchesBoundary) smallPlanting.push(comp);
      else largePlanting.push(comp);
    } else if (comp.touchesBoundary) {
      buffer.push(comp);
    } else {
      unused.push(comp);
    }
  }

  const toZone = cs => cs.map(c => ({ pixels: c.pixels.length, touchesBoundary: c.touchesBoundary }));
  return {
    paths:             toZone(paths),
    largePlantingZones: toZone(largePlanting),
    smallPlantingZones: toZone(smallPlanting),
    bufferZones:       toZone(buffer),
    unusedZones:       toZone(unused),
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScores(placements, normalizedMotif, fgData) {
  const { occupiedCells, cellSizeMm } = normalizedMotif;
  const totalOccupiedArea = occupiedCells.length * cellSizeMm * cellSizeMm;

  const areas = placements
    .filter(p => p.category !== 'landscape')
    .map(p => p.planningAreaCells)
    .sort((a, b) => b - a);

  const diversityScore = new Set(placements.map(p => p.category)).size;
  const capacity = placements.reduce((s, p) => s + (p.capacity ?? 0), 0);

  const placedArea = placements.reduce((s, p) => {
    const dim = getEffectiveDimensions(p.footprintMm, p.rotation);
    return s + dim.width * dim.depth;
  }, 0);
  const occupiedAreaRatio = totalOccupiedArea > 0 ? Math.min(1, placedArea / totalOccupiedArea) : 0;

  const components = discoverFreeComponents(fgData);
  const totalFreePixels = components.reduce((s, c) => s + c.pixels.length, 0);
  const boundaryFreePixels = components.filter(c => c.touchesBoundary).reduce((s, c) => s + c.pixels.length, 0);
  const openingSpaceScore = totalFreePixels > 0 ? boundaryFreePixels / totalFreePixels : 0;

  const prefFg = PREFERRED_PATH_WIDTH_MM / fgData.fineGridMm;
  const prefPixels = components
    .filter(c => c.touchesBoundary && Math.sqrt(c.pixels.length) >= prefFg)
    .reduce((s, c) => s + c.pixels.length, 0);
  const pathQualityScore = boundaryFreePixels > 0 ? prefPixels / boundaryFreePixels : 0;

  const nonBoundaryFreePixels = components
    .filter(c => !c.touchesBoundary)
    .reduce((s, c) => s + c.pixels.length, 0);
  const residualQualityScore = totalFreePixels > 0 ? nonBoundaryFreePixels / totalFreePixels : 0;

  return { primarySizeSequence: areas, diversityScore, capacity, openingSpaceScore, occupiedAreaRatio, pathQualityScore, residualQualityScore };
}

// ── Ranking comparator ────────────────────────────────────────────────────────

function compareLayouts(a, b) {
  if (a.valid !== b.valid) return b.valid ? 1 : -1;
  const as = a.primarySizeSequence ?? [], bs = b.primarySizeSequence ?? [];
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const diff = (bs[i] ?? 0) - (as[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (b.diversityScore !== a.diversityScore) return b.diversityScore - a.diversityScore;
  if (b.capacity !== a.capacity) return b.capacity - a.capacity;
  if (b.openingSpaceScore !== a.openingSpaceScore) return b.openingSpaceScore - a.openingSpaceScore;
  if (b.occupiedAreaRatio !== a.occupiedAreaRatio) return b.occupiedAreaRatio - a.occupiedAreaRatio;
  if (b.pathQualityScore !== a.pathQualityScore) return b.pathQualityScore - a.pathQualityScore;
  return b.residualQualityScore - a.residualQualityScore;
}

// ── Duplicate removal ─────────────────────────────────────────────────────────

function layoutSimilarity(a, b) {
  const aKeys = new Set(a.placements.map(p => `${p.assetId}:${Math.round(p.xMm/100)}:${Math.round(p.yMm/100)}`));
  const bKeys = new Set(b.placements.map(p => `${p.assetId}:${Math.round(p.xMm/100)}:${Math.round(p.yMm/100)}`));
  let matches = 0;
  for (const k of aKeys) if (bKeys.has(k)) matches++;
  const denom = Math.max(aKeys.size, bKeys.size);
  return denom > 0 ? matches / denom : 1;
}

function removeDuplicates(layouts, threshold) {
  const kept = [];
  for (const layout of layouts) {
    if (!kept.some(k => layoutSimilarity(k, layout) >= threshold)) kept.push(layout);
  }
  return kept;
}

// ── Beam search ───────────────────────────────────────────────────────────────

const LAYOUT_LABELS = [
  'Best Overall',
  'Spatial Alternative 01',
  'Spatial Alternative 02',
  'More Diverse',
  'Higher Capacity',
];

export function generateFurnitureLayouts(motif, catalog, options = {}) {
  const beamWidth          = options.beamWidth          ?? 50;
  const maxReturnedLayouts = options.maxReturnedLayouts  ?? 5;
  const duplicateThreshold = options.duplicateThreshold  ?? 0.75;
  const fineGridMm         = options.fineGridMm          ?? FINE_GRID_MM;

  const normalizedMotif = normalizeMotifForFurniture(motif, options);
  const baseFgData = buildFineGrid(normalizedMotif, fineGridMm);

  // All candidates sorted by descending planning area (large-furniture-first)
  const allCandidates = [];
  for (const asset of catalog) {
    const isGrid = isGridFillingAsset(asset, normalizedMotif.cellSizeMm);
    const cands = isGrid
      ? generateGridFillingCandidates(asset, normalizedMotif)
      : generatePartialCellCandidates(asset, normalizedMotif);
    allCandidates.push(...cands);
  }
  allCandidates.sort((a, b) => b.planningAreaCells - a.planningAreaCells);

  if (allCandidates.length === 0) {
    return { motifId: normalizedMotif.motifId, status: 'failure', layouts: [], failureReasons: ['NO_CANDIDATES_GENERATED'] };
  }

  const catalogMap = new Map(catalog.map(a => [a.id, a]));

  function assetCount(placements, assetId) {
    let n = 0; for (const p of placements) if (p.assetId === assetId) n++; return n;
  }

  function checkAccessValid(placements, fgAfter) {
    const { fgW, fgH, grid } = fgAfter;
    const components = discoverFreeComponents(fgAfter);
    const bpSet = new Set(components.filter(c => c.touchesBoundary).flatMap(c => c.pixels));

    for (const p of placements) {
      for (const logicalSide of (p.requiredAccessEdges ?? [])) {
        const cRect = clearanceRectMm(p, logicalSide, MIN_PATH_WIDTH_MM);
        if (!cRect) continue;
        const x0 = Math.floor(cRect.x / fineGridMm);
        const y0 = Math.floor(cRect.y / fineGridMm);
        const x1 = Math.ceil((cRect.x + cRect.width)  / fineGridMm);
        const y1 = Math.ceil((cRect.y + cRect.height) / fineGridMm);
        let ok = false;
        outer: for (let fy = y0; fy < y1; fy++) {
          for (let fx = x0; fx < x1; fx++) {
            if (fx < 0 || fy < 0 || fx >= fgW || fy >= fgH) continue;
            const pi = fy * fgW + fx;
            if (grid[pi] === FG_EXTERIOR || bpSet.has(pi)) { ok = true; break outer; }
          }
        }
        if (!ok) return false;
      }
    }
    return true;
  }

  // Beam: array of { placements: [] }
  let beam = [{ placements: [] }];

  for (const cand of allCandidates) {
    const entry = catalogMap.get(cand.assetId);
    const maxCopies  = entry?.maxCopies  ?? null;
    const repeatable = entry?.repeatable ?? true;
    const nextBeam   = [];

    for (const state of beam) {
      // Always keep skip branch
      nextBeam.push(state);

      // Check copy limit
      const count = assetCount(state.placements, cand.assetId);
      if (!repeatable && count > 0) continue;
      if (maxCopies !== null && count >= maxCopies) continue;

      // Collision check
      const cDim = getEffectiveDimensions(cand.footprintMm, cand.rotation);
      const cR = { x: cand.xMm, y: cand.yMm, width: cDim.width, height: cDim.depth };
      let collides = false;
      for (const placed of state.placements) {
        const pDim = getEffectiveDimensions(placed.footprintMm, placed.rotation);
        if (rectsOverlap(cR, { x: placed.xMm, y: placed.yMm, width: pDim.width, height: pDim.depth })) {
          collides = true; break;
        }
      }
      if (collides) continue;

      const newPlacements = [...state.placements, cand];
      const fgAfter = applyPlacementsToGrid(baseFgData, newPlacements);

      // Prune inaccessible states early
      if (!checkAccessValid(newPlacements, fgAfter)) continue;

      nextBeam.push({ placements: newPlacements });
    }

    // Rank and trim
    const scored = nextBeam.map(state => {
      if (state.placements.length === 0) return { state, key: { valid: true, primarySizeSequence: [], diversityScore: 0, capacity: 0, openingSpaceScore: 0, occupiedAreaRatio: 0, pathQualityScore: 0, residualQualityScore: 0 } };
      const fgd = applyPlacementsToGrid(baseFgData, state.placements);
      return { state, key: { valid: true, ...computeScores(state.placements, normalizedMotif, fgd) } };
    });
    scored.sort((a, b) => compareLayouts(a.key, b.key));
    beam = scored.slice(0, beamWidth).map(s => s.state);
  }

  // Collect results
  const results = beam
    .filter(s => s.placements.length > 0)
    .map(state => {
      const fgd = applyPlacementsToGrid(baseFgData, state.placements);
      const scores = computeScores(state.placements, normalizedMotif, fgd);
      const validation = validateLayout(state.placements, normalizedMotif, fineGridMm);
      const residual = classifyResidual(fgd);
      return {
        placements: state.placements.map(p => ({
          assetId: p.assetId, xMm: p.xMm, yMm: p.yMm, rotation: p.rotation, mirrored: p.mirrored,
        })),
        valid: validation.valid,
        failureReasons: validation.reasons,
        ...scores,
        ...residual,
      };
    });

  results.sort(compareLayouts);
  const deduped = removeDuplicates(results, duplicateThreshold);
  const top = deduped.slice(0, maxReturnedLayouts);

  if (top.length === 0) {
    return { motifId: normalizedMotif.motifId, status: 'failure', layouts: [], failureReasons: ['NO_ACCESSIBLE_PRIMARY_LAYOUT'] };
  }

  return {
    motifId: normalizedMotif.motifId,
    status: top.some(l => l.valid) ? 'success' : 'failure',
    layouts: top.map((layout, i) => ({
      layoutId: `layout_${String(i + 1).padStart(3, '0')}`,
      label: LAYOUT_LABELS[i] ?? `Alternative ${i + 1}`,
      ...layout,
    })),
    failureReasons: [],
  };
}

// Alias for old callers
export { generateFurnitureLayouts as generateFurnitureLayoutCandidates };
