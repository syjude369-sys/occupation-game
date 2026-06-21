import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFurnitureOverlayStore,
  findFurnitureOverlayForPattern,
  furnitureCadPathTransform,
  projectFurniturePlacementToBoardRect
} from "./furniture-overlay.js";

test("invalid furniture overlay store normalizes to an empty versioned store", () => {
  assert.deepEqual(normalizeFurnitureOverlayStore("{bad json"), { version: 1, items: {} });
  assert.deepEqual(normalizeFurnitureOverlayStore(null), { version: 1, items: {} });
});

test("furniture overlay lookup prefers motif id", () => {
  const store = normalizeFurnitureOverlayStore({
    version: 1,
    items: {
      "motif-a": { motifId: "motif-a", signature: "3x3:OOO", layout: { placements: [] } },
      "motif-b": { motifId: "motif-b", signature: "3x3:OOO", layout: { placements: [] } }
    }
  });
  assert.equal(findFurnitureOverlayForPattern({ id: "motif-b", signature: "3x3:OOO" }, store).motifId, "motif-b");
});

test("furniture overlay lookup falls back to signature", () => {
  const store = normalizeFurnitureOverlayStore({
    version: 1,
    items: {
      "motif-a": { motifId: "motif-a", signature: "3x3:OOO", layout: { placements: [] } }
    }
  });
  assert.equal(findFurnitureOverlayForPattern({ id: "other", signature: "3x3:OOO" }, store).motifId, "motif-a");
});

test("furniture placement projects from motif-local millimeters to board pixels", () => {
  assert.deepEqual(
    projectFurniturePlacementToBoardRect(
      { xMm: 1500, yMm: 0, widthMm: 1500, depthMm: 1500, rotation: 0 },
      { originX: 9, originY: 14 },
      20
    ),
    { x: 200, y: 280, width: 20, height: 20 }
  );
});

test("furniture placement projection swaps footprint dimensions for right-angle rotation", () => {
  assert.deepEqual(
    projectFurniturePlacementToBoardRect(
      { xMm: 0, yMm: 1500, widthMm: 3000, depthMm: 1500, rotation: 90 },
      { originX: 2, originY: 3 },
      10
    ),
    { x: 20, y: 40, width: 10, height: 20 }
  );
});

test("CAD outline transform maps normalized paths into the board placement rect", () => {
  assert.equal(
    furnitureCadPathTransform(
      { x: 100, y: 200, width: 40, height: 20 },
      { widthMm: 3000, depthMm: 1500, rotation: 0 }
    ),
    "translate(100,200) translate(20,10) rotate(0) translate(-20,-10) scale(40,20) translate(0,1) scale(1,-1)"
  );
});

test("CAD outline transform keeps original footprint scale before rotation", () => {
  assert.equal(
    furnitureCadPathTransform(
      { x: 100, y: 200, width: 20, height: 40 },
      { widthMm: 3000, depthMm: 1500, rotation: 90 }
    ),
    "translate(100,200) translate(10,20) rotate(90) translate(-20,-10) scale(40,20) translate(0,1) scale(1,-1)"
  );
});
