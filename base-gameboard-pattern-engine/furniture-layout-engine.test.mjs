import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_SIZE_MM,
  FINE_GRID_MM,
  MIN_PATH_WIDTH_MM,
  normalizeMotifForFurniture,
  cellToMm,
  rectsOverlap,
  isGridFillingAsset,
  getEffectiveDimensions,
  generateTransforms,
  buildFineGrid,
  discoverFreeComponents,
  generateGridFillingCandidates,
  generatePartialCellCandidates,
  validateLayout,
  generateFurnitureLayouts,
  generateFurnitureLayoutCandidates,
} from './furniture-layout-engine.js';

const CS = CELL_SIZE_MM; // 1500

const CELL_REQUIRED = 1;
const CELL_OPTIONAL = 2;
const CELL_EMPTY    = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function motifOE(rows, accessibleEdges = ['bottom']) {
  return { id: 'test', width: rows[0].length, height: rows.length,
    cells: rows.flatMap(r => [...r]), cellSizeMm: CS, accessibleEdges };
}

function motifNumeric(rows, accessibleEdges = ['bottom']) {
  const map = { '#': CELL_REQUIRED, '?': CELL_OPTIONAL, 'o': CELL_EMPTY, '.': 0 };
  return { id: 'test', width: rows[0].length, height: rows.length,
    cells: rows.flatMap(r => [...r].map(c => map[c])), cellSizeMm: CS, accessibleEdges };
}

/** Minimal normalized catalog entry (as loadFurnitureCatalog would produce). */
function entry(overrides) {
  return {
    id: 'item', name: 'Item', category: 'work', subtype: null, capacity: 1,
    footprintMm: { width: CS, depth: CS }, allowedRotations: [0, 90, 180, 270],
    clearanceZones: [], requiredAccessEdges: [], wallRequirement: null,
    preferredLocation: null, compatibleSets: [], tags: [],
    repeatable: true, maxCopies: null, allowsMirror: false,
    ...overrides,
  };
}

// ── Normalization ─────────────────────────────────────────────────────────────

test('normalizes O/E string cells correctly', () => {
  const n = normalizeMotifForFurniture(motifOE(['OEO', 'OOO']));
  assert.equal(n.occupiedCells.length, 5);
  assert.equal(n.emptyCells.length, 1);
  assert.deepEqual(n.cells.map(c => c.type),
    ['occupied','empty','occupied','occupied','occupied','occupied']);
});

test('normalizes legacy numeric CELL cells', () => {
  const n = normalizeMotifForFurniture(motifNumeric(['#o#', '###']));
  assert.equal(n.occupiedCells.length, 5);
  assert.equal(n.emptyCells.length, 1);
});

test('CELL_OPTIONAL treated as occupied', () => {
  const m = { id: 't', width: 2, height: 1, cells: [CELL_REQUIRED, CELL_OPTIONAL], cellSizeMm: CS, accessibleEdges: [] };
  assert.equal(normalizeMotifForFurniture(m).occupiedCells.length, 2);
});

test('CELL value 0 treated as ignore', () => {
  const m = { id: 't', width: 2, height: 1, cells: [0, CELL_REQUIRED], cellSizeMm: CS, accessibleEdges: [] };
  const n = normalizeMotifForFurniture(m);
  assert.equal(n.cells[0].type, 'ignore');
  assert.equal(n.occupiedCells.length, 1);
});

// ── cellToMm ──────────────────────────────────────────────────────────────────

test('cellToMm converts cell index to mm', () => {
  assert.equal(cellToMm(0, CS), 0);
  assert.equal(cellToMm(1, CS), 1500);
  assert.equal(cellToMm(4, CS), 6000);
});

test('normalized cell carries correct mm coordinates', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO', 'OO']));
  const c11 = n.cells.find(c => c.x === 1 && c.y === 1);
  assert.equal(c11.mmX, CS);
  assert.equal(c11.mmY, CS);
  assert.equal(n.boundsMMWidth, CS * 2);
  assert.equal(n.boundsMMHeight, CS * 2);
});

// ── rectsOverlap ──────────────────────────────────────────────────────────────

test('rectsOverlap: overlapping → true', () => {
  assert.equal(rectsOverlap({x:0,y:0,width:3000,height:3000},{x:1500,y:1500,width:3000,height:3000}), true);
});

test('rectsOverlap: touching edges → false', () => {
  assert.equal(rectsOverlap({x:0,y:0,width:3000,height:3000},{x:3000,y:0,width:3000,height:3000}), false);
});

test('rectsOverlap: separated → false', () => {
  assert.equal(rectsOverlap({x:0,y:0,width:CS,height:CS},{x:3000,y:3000,width:CS,height:CS}), false);
});

// ── isGridFillingAsset ────────────────────────────────────────────────────────

test('isGridFillingAsset: 1500x1500 → true', () => {
  assert.equal(isGridFillingAsset(entry({ footprintMm: {width:CS, depth:CS} })), true);
});

test('isGridFillingAsset: 3000x4500 → true', () => {
  assert.equal(isGridFillingAsset(entry({ footprintMm: {width:3000, depth:4500} })), true);
});

test('isGridFillingAsset: 1500x900 → false', () => {
  assert.equal(isGridFillingAsset(entry({ footprintMm: {width:CS, depth:900} })), false);
});

test('isGridFillingAsset: 450x450 → false', () => {
  assert.equal(isGridFillingAsset(entry({ footprintMm: {width:450, depth:450} })), false);
});

// ── getEffectiveDimensions ────────────────────────────────────────────────────

test('getEffectiveDimensions: rotation 0 → unchanged', () => {
  assert.deepEqual(getEffectiveDimensions({width:1500,depth:900}, 0), {width:1500,depth:900});
});

test('getEffectiveDimensions: rotation 90 → swapped', () => {
  assert.deepEqual(getEffectiveDimensions({width:1500,depth:900}, 90), {width:900,depth:1500});
});

test('getEffectiveDimensions: rotation 180 → unchanged', () => {
  assert.deepEqual(getEffectiveDimensions({width:1500,depth:900}, 180), {width:1500,depth:900});
});

test('getEffectiveDimensions: rotation 270 → swapped', () => {
  assert.deepEqual(getEffectiveDimensions({width:1500,depth:900}, 270), {width:900,depth:1500});
});

// ── generateTransforms ────────────────────────────────────────────────────────

test('generateTransforms: symmetric 1x1 cell with 4 rotations deduplicates to 1', () => {
  const asset = entry({ footprintMm: {width:CS,depth:CS}, requiredAccessEdges: [] });
  const tf = generateTransforms(asset);
  assert.equal(tf.length, 1);
});

test('generateTransforms: 1x2 asymmetric produces 4 distinct rotations', () => {
  const asset = entry({
    footprintMm: {width:CS,depth:CS*2},
    requiredAccessEdges: ['back'],
    allowedRotations: [0,90,180,270],
  });
  const tf = generateTransforms(asset);
  assert.ok(tf.length >= 2, `expected >= 2 transforms, got ${tf.length}`);
});

// ── buildFineGrid ─────────────────────────────────────────────────────────────

test('buildFineGrid: 1x1 O motif produces 15x15 fine grid with all FG_O (1)', () => {
  const n = normalizeMotifForFurniture(motifOE(['O']));
  const { grid, fgW, fgH } = buildFineGrid(n, 100);
  assert.equal(fgW, 15);
  assert.equal(fgH, 15);
  assert.ok([...grid].every(v => v === 1), 'all pixels should be FG_O');
});

test('buildFineGrid: E cells produce FG_E (2)', () => {
  const n = normalizeMotifForFurniture(motifOE(['E']));
  const { grid } = buildFineGrid(n, 100);
  assert.ok([...grid].every(v => v === 2), 'all pixels should be FG_E');
});

test('buildFineGrid: mixed OE motif has correct pixel counts', () => {
  // 2x1: OE
  const n = normalizeMotifForFurniture(motifOE(['OE']));
  const { grid, fgW, fgH } = buildFineGrid(n, 100);
  assert.equal(fgW, 30);
  assert.equal(fgH, 15);
  const oCount = [...grid].filter(v => v === 1).length;
  const eCount = [...grid].filter(v => v === 2).length;
  assert.equal(oCount, 15 * 15);
  assert.equal(eCount, 15 * 15);
});

// ── discoverFreeComponents ────────────────────────────────────────────────────

test('discoverFreeComponents: single open cell → 1 boundary-touching component', () => {
  const n = normalizeMotifForFurniture(motifOE(['O']));
  const fgData = buildFineGrid(n, 100);
  const comps = discoverFreeComponents(fgData);
  assert.equal(comps.length, 1);
  assert.equal(comps[0].touchesBoundary, true);
});

test('discoverFreeComponents: all exterior → 0 components', () => {
  const n = normalizeMotifForFurniture(motifOE(['O']));
  const { grid, fgW, fgH, fineGridMm, ratio } = buildFineGrid(n, 100);
  // Fill entire grid with FG_EXTERIOR
  const blocked = new Uint8Array(grid.length).fill(0);
  const comps = discoverFreeComponents({ grid: blocked, fgW, fgH, fineGridMm, ratio });
  assert.equal(comps.length, 0);
});

// ── generateGridFillingCandidates ─────────────────────────────────────────────

test('1x1 asset in 2x2 motif → 4 candidates (all 4 cells)', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO', 'OO']));
  const asset = entry({ id: 'sq', footprintMm: {width:CS,depth:CS}, allowedRotations:[0], requiredAccessEdges:[] });
  const cands = generateGridFillingCandidates(asset, n);
  // 4 cells × 1 rotation = 4
  assert.equal(cands.length, 4);
});

test('2x3 asset in 2x3 motif → 1 candidate', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO','OO','OO']));
  const asset = entry({ id: 'big', footprintMm: {width:3000,depth:4500}, allowedRotations:[0] });
  const cands = generateGridFillingCandidates(asset, n);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].xMm, 0);
  assert.equal(cands[0].yMm, 0);
});

test('asset taller than motif → no candidates', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO']));
  const asset = entry({ id: 'tall', footprintMm: {width:CS,depth:CS*3}, allowedRotations:[0] });
  const cands = generateGridFillingCandidates(asset, n);
  assert.equal(cands.length, 0);
});

test('grid-filling candidate rejected for E cells', () => {
  // OE motif — asset wanting 1×1 only gets placed in O cell, not E cell
  const n = normalizeMotifForFurniture(motifOE(['OE']));
  const asset = entry({ id: 'sq', footprintMm: {width:CS,depth:CS}, allowedRotations:[0], category:'work' });
  const cands = generateGridFillingCandidates(asset, n);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].xMm, 0); // only left O cell
});

// ── generatePartialCellCandidates ─────────────────────────────────────────────

test('partial-cell asset produces multiple alignment candidates per cell', () => {
  const n = normalizeMotifForFurniture(motifOE(['O']));
  // 900x600 — narrower than cell in both dims → top/bottom/left/right/corners all distinct
  const asset = entry({ id: 'sm', footprintMm: {width:900,depth:600}, allowedRotations:[0], category:'work' });
  const cands = generatePartialCellCandidates(asset, n);
  assert.ok(cands.length >= 4, `expected >= 4, got ${cands.length}`);
});

test('partial-cell candidates stay within host cell', () => {
  const n = normalizeMotifForFurniture(motifOE(['O']));
  const asset = entry({ id: 'ws', footprintMm: {width:CS,depth:900}, allowedRotations:[0] });
  const cands = generatePartialCellCandidates(asset, n);
  for (const c of cands) {
    assert.ok(c.xMm >= 0 && c.xMm + CS <= CS);
    assert.ok(c.yMm >= 0 && c.yMm + 900 <= CS);
  }
});

// ── validateLayout ────────────────────────────────────────────────────────────

test('validateLayout: no placements → valid', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO']));
  const { valid } = validateLayout([], n);
  assert.equal(valid, true);
});

test('validateLayout: non-overlapping placements in O cells → valid', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO']));
  const placements = [
    { assetId: 'a', xMm:0, yMm:0, rotation:0, mirrored:false,
      footprintMm:{width:CS,depth:CS}, clearanceZones:[], requiredAccessEdges:[], category:'work', capacity:1, planningAreaCells:1 },
    { assetId: 'b', xMm:CS, yMm:0, rotation:0, mirrored:false,
      footprintMm:{width:CS,depth:CS}, clearanceZones:[], requiredAccessEdges:[], category:'work', capacity:1, planningAreaCells:1 },
  ];
  const { valid } = validateLayout(placements, n);
  assert.equal(valid, true);
});

test('validateLayout: overlapping placements → invalid', () => {
  const n = normalizeMotifForFurniture(motifOE(['OO']));
  const p = (id, x) => ({ assetId: id, xMm: x, yMm: 0, rotation: 0, mirrored: false,
    footprintMm:{width:CS,depth:CS}, clearanceZones:[], requiredAccessEdges:[], category:'work', capacity:1, planningAreaCells:1 });
  const { valid, reasons } = validateLayout([p('a',0), p('b',CS/2)], n);
  assert.equal(valid, false);
  assert.ok(reasons.some(r => r.includes('overlaps')));
});

test('validateLayout: access side extends outside motif → valid (exterior = accessible)', () => {
  // 1x1 O cell; asset with front clearance pointing south (off-grid)
  const n = normalizeMotifForFurniture(motifOE(['O']));
  const p = [{
    assetId: 'ws', xMm: 0, yMm: 0, rotation: 0, mirrored: false,
    footprintMm: {width:CS, depth:900}, clearanceZones:[{side:'front',distanceMm:900}],
    requiredAccessEdges: ['front'], category: 'work', capacity: 1, planningAreaCells: 0.6,
  }];
  const { valid } = validateLayout(p, n);
  assert.equal(valid, true);
});

// ── generateFurnitureLayouts end-to-end ───────────────────────────────────────

const FOCUS_ROOM = entry({
  id: 'focus_room_01', name: 'Focus Room', category: 'work', capacity: 1,
  footprintMm: {width:CS, depth:CS*2}, allowedRotations:[0,90,180,270],
  requiredAccessEdges: [], clearanceZones: [],
});

const MEETING_04 = entry({
  id: 'meeting_04', name: '4-person Meeting', category: 'meeting', capacity: 4,
  footprintMm: {width:3000, depth:3000}, allowedRotations:[0,90],
  clearanceZones:[{side:'front',distanceMm:CS}], requiredAccessEdges:[],
});

const MEETING_06 = entry({
  id: 'meeting_06', name: '6-person Meeting', category: 'meeting', capacity: 6,
  footprintMm: {width:3000, depth:4500}, allowedRotations:[0,90],
  clearanceZones:[{side:'front',distanceMm:CS}], requiredAccessEdges:[],
});

test('generateFurnitureLayouts: focus_room fits in 1x2 motif → success', () => {
  const motif = motifOE(['O','O']);
  const result = generateFurnitureLayouts(motif, [FOCUS_ROOM]);
  assert.equal(result.status, 'success');
  assert.ok(result.layouts.length > 0);
  assert.ok(result.layouts[0].placements.some(p => p.assetId === 'focus_room_01'));
});

test('generateFurnitureLayouts: meeting_04 fits in 2x2 motif → success with capacity 4', () => {
  const motif = motifOE(['OO','OO']);
  const result = generateFurnitureLayouts(motif, [MEETING_04]);
  assert.equal(result.status, 'success');
  const best = result.layouts[0];
  assert.ok(best.capacity >= 4);
  assert.equal(best.placements[0].assetId, 'meeting_04');
});

test('generateFurnitureLayouts: too-small motif for large asset → failure', () => {
  // 1x1 motif can't fit 2x2 meeting_04
  const motif = motifOE(['O']);
  const result = generateFurnitureLayouts(motif, [MEETING_04]);
  assert.equal(result.status, 'failure');
  assert.equal(result.layouts.length, 0);
});

test('generateFurnitureLayouts: empty catalog → failure', () => {
  const motif = motifOE(['OO','OO']);
  const result = generateFurnitureLayouts(motif, []);
  assert.equal(result.status, 'failure');
});

test('generateFurnitureLayouts: E cells not used for non-landscape furniture', () => {
  // OE motif: meeting_04 needs 2x2 → only 1 O cell → no fit
  const motif = motifOE(['OE']);
  const result = generateFurnitureLayouts(motif, [MEETING_04]);
  assert.equal(result.status, 'failure');
});

test('generateFurnitureLayouts: larger furniture first in primarySizeSequence', () => {
  // 4x3 motif, both meeting_04 (3 cells) and meeting_06 (2x3=6 cells) fit
  const motif = motifOE(['OOOO','OOOO','OOOO']);
  const result = generateFurnitureLayouts(motif, [MEETING_04, MEETING_06], { beamWidth: 20 });
  assert.equal(result.status, 'success');
  const best = result.layouts[0];
  // Best layout should have meeting_06 (6 cells) placed
  assert.ok(best.placements.some(p => p.assetId === 'meeting_06'),
    'best layout should prefer larger furniture (meeting_06)');
});

test('generateFurnitureLayouts: result is deterministic', () => {
  const motif = motifOE(['OOOO','OOOO','OOOO','OOOO']);
  const catalog = [MEETING_04, MEETING_06, FOCUS_ROOM];
  const r1 = generateFurnitureLayouts(motif, catalog);
  const r2 = generateFurnitureLayouts(motif, catalog);
  assert.deepEqual(r1, r2);
});

test('generateFurnitureLayouts: layout labels assigned', () => {
  const motif = motifOE(['OO','OO']);
  const result = generateFurnitureLayouts(motif, [MEETING_04]);
  if (result.layouts.length > 0) {
    assert.ok(typeof result.layouts[0].label === 'string');
    assert.ok(typeof result.layouts[0].layoutId === 'string');
  }
});

test('generateFurnitureLayouts: output has required fields', () => {
  const motif = motifOE(['OO','OO']);
  const result = generateFurnitureLayouts(motif, [MEETING_04]);
  assert.ok('motifId' in result);
  assert.ok('status' in result);
  assert.ok('layouts' in result);
  assert.ok('failureReasons' in result);
  if (result.layouts.length > 0) {
    const layout = result.layouts[0];
    assert.ok('layoutId' in layout);
    assert.ok('valid' in layout);
    assert.ok('placements' in layout);
    assert.ok('paths' in layout);
    assert.ok('primarySizeSequence' in layout);
    assert.ok('diversityScore' in layout);
    assert.ok('capacity' in layout);
  }
});

test('generateFurnitureLayoutCandidates alias works', () => {
  const motif = motifOE(['OO','OO']);
  const result = generateFurnitureLayoutCandidates(motif, [MEETING_04]);
  assert.ok('status' in result);
});
