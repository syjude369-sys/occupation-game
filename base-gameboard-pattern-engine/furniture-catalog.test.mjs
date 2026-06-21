import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFurnitureCatalog, loadFurnitureCatalog } from './furniture-catalog.js';

const VALID_DESK = {
  id: 'desk',
  name: 'Office Desk',
  category: 'work',
  capacity: 1,
  footprintMm: { width: 1200, depth: 600 },
  allowedRotations: [0, 90, 180, 270],
  clearanceZones: [{ side: 'front', distanceMm: 600 }],
  tags: ['office', 'work-surface'],
  handbookReference: 'Metric Handbook 5.3',
};

// ── validateFurnitureCatalog ─────────────────────────────────────────────────

test('valid catalog passes validation', () => {
  const result = validateFurnitureCatalog([VALID_DESK]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('non-array catalog fails validation', () => {
  const result = validateFurnitureCatalog({ id: 'not-array' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('array')));
});

test('missing required field id fails validation', () => {
  const { id: _id, ...noId } = VALID_DESK;
  const result = validateFurnitureCatalog([noId]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"id"')));
});

test('missing required field name fails validation', () => {
  const { name: _name, ...noName } = VALID_DESK;
  const result = validateFurnitureCatalog([noName]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"name"')));
});

test('missing required field category fails validation', () => {
  const { category: _cat, ...noCat } = VALID_DESK;
  const result = validateFurnitureCatalog([noCat]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"category"')));
});

test('missing required field footprintMm fails validation', () => {
  const { footprintMm: _fp, ...noFp } = VALID_DESK;
  const result = validateFurnitureCatalog([noFp]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"footprintMm"')));
});

test('non-positive footprintMm.width fails validation', () => {
  const result = validateFurnitureCatalog([{ ...VALID_DESK, footprintMm: { width: 0, depth: 600 } }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('footprintMm.width')));
});

test('negative footprintMm.depth fails validation', () => {
  const result = validateFurnitureCatalog([{ ...VALID_DESK, footprintMm: { width: 1200, depth: -100 } }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('footprintMm.depth')));
});

test('invalid rotation value 45 fails validation', () => {
  const result = validateFurnitureCatalog([{ ...VALID_DESK, allowedRotations: [0, 45] }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('45')));
});

test('non-array allowedRotations fails validation', () => {
  const result = validateFurnitureCatalog([{ ...VALID_DESK, allowedRotations: 0 }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('allowedRotations')));
});

test('invalid clearance side fails validation', () => {
  const result = validateFurnitureCatalog([{
    ...VALID_DESK,
    clearanceZones: [{ side: 'diagonal', distanceMm: 600 }],
  }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('diagonal')));
});

test('negative clearance distanceMm fails validation', () => {
  const result = validateFurnitureCatalog([{
    ...VALID_DESK,
    clearanceZones: [{ side: 'front', distanceMm: -100 }],
  }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('distanceMm')));
});

test('non-array clearanceZones fails validation', () => {
  const result = validateFurnitureCatalog([{
    ...VALID_DESK,
    clearanceZones: { side: 'front', distanceMm: 600 },
  }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('clearanceZones')));
});

test('duplicate ids fail validation', () => {
  const result = validateFurnitureCatalog([VALID_DESK, { ...VALID_DESK }]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('duplicate')));
});

test('multiple errors reported together', () => {
  const result = validateFurnitureCatalog([
    { id: 'a', name: 'A', category: 'work', footprintMm: { width: -1, depth: -1 } },
    { id: 'a', name: 'B', category: 'work', footprintMm: { width: 1200, depth: 600 } },
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3); // duplicate id + 2 bad footprint fields
});

// ── loadFurnitureCatalog ─────────────────────────────────────────────────────

test('loadFurnitureCatalog returns normalized entries', () => {
  const loaded = loadFurnitureCatalog([VALID_DESK]);
  assert.equal(loaded.length, 1);
  const entry = loaded[0];
  assert.equal(entry.id, 'desk');
  assert.equal(entry.name, 'Office Desk');
  assert.equal(entry.category, 'work');
  assert.equal(entry.capacity, 1);
  assert.deepEqual(entry.footprintMm, { width: 1200, depth: 600 });
  assert.deepEqual(entry.allowedRotations, [0, 90, 180, 270]);
  assert.deepEqual(entry.clearanceZones, [{ side: 'front', distanceMm: 600 }]);
});

test('loadFurnitureCatalog normalizes optional fields to defaults', () => {
  const minimal = {
    id: 'chair',
    name: 'Chair',
    category: 'seating',
    footprintMm: { width: 500, depth: 500 },
  };
  const loaded = loadFurnitureCatalog([minimal]);
  const entry = loaded[0];
  assert.equal(entry.capacity, 0);
  assert.deepEqual(entry.allowedRotations, [0, 90, 180, 270]);
  assert.deepEqual(entry.clearanceZones, []);
  assert.deepEqual(entry.tags, []);
  assert.deepEqual(entry.compatibleSets, []);
  assert.deepEqual(entry.requiredAccessEdges, []);
  assert.equal(entry.subtype, null);
  assert.equal(entry.sourceFile, null);
  assert.equal(entry.sourceBlockName, null);
  assert.equal(entry.wallRequirement, null);
  assert.equal(entry.preferredLocation, null);
  assert.equal(entry.handbookReference, null);
  assert.equal(entry.simplifiedPolygonMm, null);
});

test('loadFurnitureCatalog throws on invalid catalog', () => {
  assert.throws(
    () => loadFurnitureCatalog([{ id: 'bad' }]),
    /Invalid furniture catalog/,
  );
});

test('loadFurnitureCatalog preserves all valid rotation values', () => {
  const loaded = loadFurnitureCatalog([{ ...VALID_DESK, allowedRotations: [0, 180] }]);
  assert.deepEqual(loaded[0].allowedRotations, [0, 180]);
});

test('loadFurnitureCatalog handles catalog with multiple items', () => {
  const chair = { id: 'chair', name: 'Chair', category: 'seating', footprintMm: { width: 500, depth: 500 } };
  const loaded = loadFurnitureCatalog([VALID_DESK, chair]);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, 'desk');
  assert.equal(loaded[1].id, 'chair');
});
