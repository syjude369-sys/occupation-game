// furniture-catalog.js
// Implements: docs/agent-collaboration-boundaries.md — Furniture Owner
// Ref: docs/claude-furniture-layout-engine-handoff.md — Furniture Asset Metadata

const REQUIRED_FIELDS = ['id', 'name', 'category', 'footprintMm'];
const VALID_ROTATIONS = new Set([0, 90, 180, 270]);
const VALID_CLEARANCE_SIDES = new Set(['front', 'back', 'left', 'right']);

/**
 * Validate a raw furniture catalog array.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateFurnitureCatalog(catalog) {
  if (!Array.isArray(catalog)) {
    return { valid: false, errors: ['catalog must be an array'] };
  }

  const errors = [];
  const ids = new Set();

  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const prefix = `[${i}]`;

    for (const field of REQUIRED_FIELDS) {
      if (item[field] == null) {
        errors.push(`${prefix} missing required field "${field}"`);
      }
    }

    if (item.id != null) {
      if (ids.has(item.id)) {
        errors.push(`${prefix} duplicate id "${item.id}"`);
      }
      ids.add(item.id);
    }

    if (item.footprintMm != null) {
      if (typeof item.footprintMm.width !== 'number' || item.footprintMm.width <= 0) {
        errors.push(`${prefix} footprintMm.width must be a positive number`);
      }
      if (typeof item.footprintMm.depth !== 'number' || item.footprintMm.depth <= 0) {
        errors.push(`${prefix} footprintMm.depth must be a positive number`);
      }
    }

    if (item.allowedRotations != null) {
      if (!Array.isArray(item.allowedRotations)) {
        errors.push(`${prefix} allowedRotations must be an array`);
      } else {
        for (const r of item.allowedRotations) {
          if (!VALID_ROTATIONS.has(r)) {
            errors.push(`${prefix} allowedRotations contains invalid value ${r} (must be 0, 90, 180, or 270)`);
          }
        }
      }
    }

    if (item.clearanceZones != null) {
      if (!Array.isArray(item.clearanceZones)) {
        errors.push(`${prefix} clearanceZones must be an array`);
      } else {
        for (let j = 0; j < item.clearanceZones.length; j++) {
          const zone = item.clearanceZones[j];
          const zp = `${prefix}.clearanceZones[${j}]`;
          if (!VALID_CLEARANCE_SIDES.has(zone.side)) {
            errors.push(`${zp} invalid side "${zone.side}" (must be front, back, left, or right)`);
          }
          if (typeof zone.distanceMm !== 'number' || zone.distanceMm < 0) {
            errors.push(`${zp} distanceMm must be a non-negative number`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse and normalize a raw catalog array.
 * Throws if catalog is invalid.
 * Returns a normalized array of furniture catalog entries.
 */
export function loadFurnitureCatalog(rawCatalog) {
  const validation = validateFurnitureCatalog(rawCatalog);
  if (!validation.valid) {
    throw new Error(`Invalid furniture catalog:\n  ${validation.errors.join('\n  ')}`);
  }

  return rawCatalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    subtype: item.subtype ?? null,
    capacity: typeof item.capacity === 'number' ? item.capacity : 0,
    sourceFile: item.sourceFile ?? null,
    sourceBlockName: item.sourceBlockName ?? null,
    footprintMm: { width: item.footprintMm.width, depth: item.footprintMm.depth },
    simplifiedPolygonMm: item.simplifiedPolygonMm ?? null,
    allowedRotations: item.allowedRotations ?? [0, 90, 180, 270],
    clearanceZones: item.clearanceZones ?? [],
    requiredAccessEdges: item.requiredAccessEdges ?? [],
    repeatable: item.repeatable ?? true,
    maxCopies: item.maxCopies ?? null,
    allowsMirror: item.allowsMirror ?? false,
    wallRequirement: item.wallRequirement ?? null,
    preferredLocation: item.preferredLocation ?? null,
    compatibleSets: item.compatibleSets ?? [],
    tags: item.tags ?? [],
    handbookReference: item.handbookReference ?? null,
  }));
}
