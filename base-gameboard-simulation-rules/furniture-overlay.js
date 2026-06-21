export const FURNITURE_OVERLAY_KEY = "dd3:furniture-layout-overlays";
export const FURNITURE_CELL_SIZE_MM = 1500;

export function normalizeFurnitureOverlayStore(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return { version: 1, items: {} };
    }
  }
  if (!data || typeof data !== "object" || !data.items || typeof data.items !== "object") {
    return { version: 1, items: {} };
  }
  const items = {};
  for (const [key, item] of Object.entries(data.items)) {
    if (!item || typeof item !== "object" || !item.layout || typeof item.layout !== "object") continue;
    const id = item.motifId || key;
    items[key] = {
      ...item,
      motifId: id,
      signature: item.signature || null,
      layout: {
        ...item.layout,
        placements: Array.isArray(item.layout.placements) ? item.layout.placements : []
      }
    };
  }
  return { version: 1, items };
}

export function findFurnitureOverlayForPattern(pattern, store) {
  const normalized = normalizeFurnitureOverlayStore(store);
  if (!pattern) return null;
  if (pattern.id && normalized.items[pattern.id]) return normalized.items[pattern.id];
  if (!pattern.signature) return null;
  return Object.values(normalized.items).find((item) => item.signature === pattern.signature) || null;
}

export function effectivePlacementSizeMm(placement) {
  const width = Number(placement.widthMm ?? placement.footprintMm?.width ?? FURNITURE_CELL_SIZE_MM);
  const depth = Number(placement.depthMm ?? placement.footprintMm?.depth ?? FURNITURE_CELL_SIZE_MM);
  const rotation = Number(placement.rotation || 0);
  if (rotation === 90 || rotation === 270) return { widthMm: depth, depthMm: width };
  return { widthMm: width, depthMm: depth };
}

export function projectFurniturePlacementToBoardRect(placement, match, cellSizePx, gap = 0) {
  const { widthMm, depthMm } = effectivePlacementSizeMm(placement);
  const xCells = Number(match.originX ?? match.x ?? 0) + Number(placement.xMm || 0) / FURNITURE_CELL_SIZE_MM;
  const yCells = Number(match.originY ?? match.y ?? 0) + Number(placement.yMm || 0) / FURNITURE_CELL_SIZE_MM;
  return {
    x: gap + xCells * cellSizePx,
    y: gap + yCells * cellSizePx,
    width: widthMm / FURNITURE_CELL_SIZE_MM * cellSizePx,
    height: depthMm / FURNITURE_CELL_SIZE_MM * cellSizePx
  };
}

export function furnitureCadPathTransform(rect, placement) {
  const originalWidth = Number(placement.widthMm ?? placement.footprintMm?.width ?? FURNITURE_CELL_SIZE_MM);
  const originalDepth = Number(placement.depthMm ?? placement.footprintMm?.depth ?? FURNITURE_CELL_SIZE_MM);
  const rotation = Number(placement.rotation || 0);
  const baseWidthPx = originalWidth / FURNITURE_CELL_SIZE_MM * (rect.width / (effectivePlacementSizeMm(placement).widthMm / FURNITURE_CELL_SIZE_MM));
  const baseDepthPx = originalDepth / FURNITURE_CELL_SIZE_MM * (rect.height / (effectivePlacementSizeMm(placement).depthMm / FURNITURE_CELL_SIZE_MM));
  const mirror = placement.mirrored ? " translate(1,0) scale(-1,1)" : "";
  return `translate(${rect.x},${rect.y}) translate(${rect.width / 2},${rect.height / 2}) rotate(${rotation}) translate(${-baseWidthPx / 2},${-baseDepthPx / 2}) scale(${baseWidthPx},${baseDepthPx}) translate(0,1) scale(1,-1)${mirror}`;
}
