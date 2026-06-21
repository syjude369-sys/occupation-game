const DEFAULTS = {
  x: 0,
  y: 0,
  side: 48000,
  angle: 15,
  siteWidth: 105000,
  siteHeight: 85000,
  serviceLayer: 6000,
  gridSpan: 1500,
  facadeThickness: 200,
  outerCatwalk: 700,
  moduleWidth: 3000,
  moduleClockwise: true,
  floorHeight: 4000,
  slabThickness: 500,
  gridTileScale: 0.88,
  facadeMinorAxis: 100,
  facadeSpacing: 1500,
  pivotDoorDepth: 600,
  elevFrontDepth: 1500,
  elevFrontBackOverlap: 200,
  elevUpperSlot: 999,
  elevLowerSlot: 0,
  pivotOpenAngle: 90,
  showCells: true,
  showTiles: true,
  showCatwalk: true,
  showStructure: true,
  showLouvers: true,
  showElevators: true,
  showPivotDoors: true,
  showModules: true
};

const COLORS = {
  Site: "#e8eef8",
  Limit: "#ff2b2b",
  Building: "#d8dee8",
  Catwalk: "#f2df21",
  Grid: "#18d8e3",
  Facade: "#ff8a25",
  Elev: "#a6d42b",
  Pivot: "#d81ee8",
  Structure: "#3768ff",
  Louvers: "#ffd176"
};

const state = { ...DEFAULTS };
let latest = null;

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapFloor(value, step) {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

function fmt(n, unit = "") {
  return `${Math.round(n).toLocaleString("ko-KR")}${unit}`;
}

function areaFmt(n) {
  return `${Math.round(n / 1_000_000).toLocaleString("ko-KR")} m2`;
}

function rad(deg) {
  return (deg * Math.PI) / 180;
}

function rotatePoint(p, angleDeg, cx = state.x, cy = state.y) {
  const a = rad(angleDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

function localToWorld(p) {
  return rotatePoint({ x: state.x + p.x, y: state.y + p.y }, state.angle, state.x, state.y);
}

function worldToLocal(p) {
  const q = rotatePoint(p, -state.angle, state.x, state.y);
  return { x: q.x - state.x, y: q.y - state.y };
}

function rectLocal(minX, minY, maxX, maxY) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];
}

function toWorldPoly(localPoly) {
  return localPoly.map(localToWorld);
}

function polygonPath(points) {
  if (!points.length) return "";
  return `M ${points.map((p) => `${p.x.toFixed(3)} ${(-p.y).toFixed(3)}`).join(" L ")} Z`;
}

function linePath(a, b) {
  return `M ${a.x.toFixed(3)} ${(-a.y).toFixed(3)} L ${b.x.toFixed(3)} ${(-b.y).toFixed(3)}`;
}

function ellipsePointPath(center, rx, ry, angleDeg, steps = 28) {
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (Math.PI * 2 * i) / steps;
    const p = { x: center.x + Math.cos(t) * rx, y: center.y + Math.sin(t) * ry };
    points.push(rotatePoint(p, angleDeg, center.x, center.y));
  }
  return polygonPath(points);
}

function bboxLocal(rect) {
  return {
    minX: Math.min(rect[0].x, rect[2].x),
    minY: Math.min(rect[0].y, rect[2].y),
    maxX: Math.max(rect[0].x, rect[2].x),
    maxY: Math.max(rect[0].y, rect[2].y)
  };
}

function bboxOverlapArea(a, b, tol = 1e-6) {
  const x = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const y = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return x > tol && y > tol ? x * y : 0;
}

function rectRecord(minX, minY, maxX, maxY, key = "") {
  return { minX, minY, maxX, maxY, key, poly: rectLocal(minX, minY, maxX, maxY) };
}

function snapFacadeSpacing(raw, minorAxis, gridSpan) {
  const minSpacing = Math.max(minorAxis * 2 + 10, 1);
  const span = Math.max(1, gridSpan || 1500);
  const divisors = [];
  for (let i = 1; i <= span; i += 1) {
    if (span % i === 0) divisors.push(i);
  }
  const candidates = [];
  for (const d of divisors) {
    if (d >= minSpacing) candidates.push(d);
  }
  for (let k = 1; k <= 12; k += 1) {
    const v = span * k;
    if (v >= minSpacing) candidates.push(v);
  }
  return candidates.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), candidates[0] || span);
}

function buildGameBoard() {
  const logs = [];
  const side = snapFloor(state.side, 10);
  const half = side / 2;
  const site = rectLocal(-state.siteWidth / 2, -state.siteHeight / 2, state.siteWidth / 2, state.siteHeight / 2);
  const rect = rectLocal(-half, -half, half, half);
  const siteWorld = site.map((p) => ({ x: p.x, y: p.y }));
  const rectWorld = toWorldPoly(rect);
  const localCornersInSite = rectWorld.map((p) => ({
    x: p.x,
    y: p.y,
    inside: Math.abs(p.x) <= state.siteWidth / 2 && Math.abs(p.y) <= state.siteHeight / 2
  }));
  const valid = localCornersInSite.every((p) => p.inside);
  const violation = valid ? 0 : localCornersInSite.filter((p) => !p.inside).length;

  const serviceLayer = Math.max(0, state.serviceLayer);
  const gridSpan = Math.max(100, state.gridSpan);
  const facadeThickness = Math.max(0, state.facadeThickness);
  const outerCatwalk = Math.max(700, state.outerCatwalk);
  const catHalf = Math.max(0, half - serviceLayer);
  const catwalk = rectRecord(-catHalf, -catHalf, catHalf, catHalf, "CatwalkOutline");

  let boardSize = Math.floor((catHalf * 2) / gridSpan) * gridSpan;
  while (boardSize > 0 && (catHalf * 2 - boardSize) / 2 < 1200) {
    boardSize -= gridSpan;
  }
  boardSize = Math.max(0, boardSize);
  const boardHalf = boardSize / 2;
  const gameBoard = rectRecord(-boardHalf, -boardHalf, boardHalf, boardHalf, "GameBoard");
  const catwalkSpan = (catHalf * 2 - boardSize) / 2;
  const cellCount = boardSize > 0 ? Math.floor(boardSize / gridSpan) : 0;
  const cells = [];
  const tiles = [];
  for (let ix = 0; ix < cellCount; ix += 1) {
    for (let iy = 0; iy < cellCount; iy += 1) {
      const x0 = -boardHalf + ix * gridSpan;
      const y0 = -boardHalf + iy * gridSpan;
      cells.push(rectRecord(x0, y0, x0 + gridSpan, y0 + gridSpan, `CELL_${ix}_${iy}`));
      const inset = (gridSpan * (1 - state.gridTileScale)) / 2;
      tiles.push(rectRecord(x0 + inset, y0 + inset, x0 + gridSpan - inset, y0 + gridSpan - inset, `TILE_${ix}_${iy}`));
    }
  }

  const facadeHalf = Math.max(0, half - facadeThickness);
  const outerHalf = Math.max(0, half - facadeThickness - outerCatwalk);
  const facade = rectRecord(-facadeHalf, -facadeHalf, facadeHalf, facadeHalf, "FacadeLine");
  const outerLine = rectRecord(-outerHalf, -outerHalf, outerHalf, outerHalf, "OuterCatwalkLine");
  const pivotHalf = boardHalf + Math.max(0, state.pivotDoorDepth);
  const pivotClearance = rectRecord(-pivotHalf, -pivotHalf, pivotHalf, pivotHalf, "PivotDoorClearanceLine");

  const modules = buildModules(outerHalf, pivotHalf, state.moduleWidth, gridSpan);
  const louvers = buildLouvers(facadeHalf, facadeThickness, gridSpan);
  const elev = buildElevators(boardHalf, outerHalf, modules);
  const catwalkPieces = buildCatwalkPieces(facadeHalf, outerHalf, catHalf, pivotHalf, gridSpan, elev.frontZones);
  const pivotDoors = buildPivotDoors(pivotHalf, elev.frontZones, gridSpan);
  const hbeams = buildHBeams(facadeHalf, pivotHalf, modules.validModules, gridSpan);

  const siteArea = state.siteWidth * state.siteHeight;
  const area = side * side;
  const centerDist = Math.hypot(state.x, state.y);
  const maxDim = Math.max(state.siteWidth, state.siteHeight);
  const centerScore = maxDim > 0 ? 1 - centerDist / maxDim : 0;
  const areaScore = siteArea > 0 ? area / siteArea : 0;
  const yScore = (state.y + state.siteHeight / 2) / state.siteHeight;
  const fitness = valid ? areaScore * 100000 + centerScore * 30000 : -1e18 - violation * 1000000;

  logs.push(valid ? "Base generation complete." : "Base warning: one or more Rect corners are outside Site.");
  logs.push(`GameBoard size = ${Math.round(boardSize)}`);
  logs.push(`GameCell count = ${cells.length}`);
  logs.push(`CatwalkSpan = ${Math.round(catwalkSpan)}`);
  logs.push(`FacadeSpacing snapped = ${Math.round(louvers.spacing)}`);
  logs.push(`Elev valid slots = ${elev.validSlots.length}`);
  logs.push(`Elev selected = Upper(${elev.upperIndex}), Lower(${elev.lowerIndex})`);
  logs.push(`Pivot opened = ${pivotDoors.opened.length}, closed = ${pivotDoors.closed.length}`);
  logs.push(`Final modules = ${modules.validModules.length}, culled = ${modules.culledModules.length}`);

  return {
    logs,
    valid,
    violation,
    touches: 0,
    fitness,
    area,
    areaScore,
    yScore,
    centerScore,
    side,
    gridSpan,
    boardSize,
    cellCount,
    catwalkSpan,
    site: { poly: siteWorld },
    limitLines: [
      [{ x: -state.siteWidth / 2, y: -state.siteHeight * 0.22 }, { x: state.siteWidth / 2, y: -state.siteHeight * 0.22 }]
    ],
    rect: { poly: rectWorld },
    building: { poly: rectWorld },
    catwalk,
    facade,
    outerLine,
    pivotClearance,
    gameBoard,
    cells,
    tiles,
    modules,
    louvers,
    elev,
    catwalkPieces,
    pivotDoors,
    hbeams
  };
}

function buildModules(outerHalf, pivotHalf, moduleWidth, span) {
  const width = Math.max(1500, snapFloor(moduleWidth, 1500));
  const records = [];
  const min = -outerHalf;
  const max = outerHalf;
  const start = Math.ceil(min / width) * width;
  const bands = [
    ["bottom", -outerHalf, -pivotHalf, "x"],
    ["top", pivotHalf, outerHalf, "x"],
    ["left", -outerHalf, -pivotHalf, "y"],
    ["right", pivotHalf, outerHalf, "y"]
  ];
  for (const [side, a0, a1, axis] of bands) {
    for (let p = start; p + width <= max + 1e-6; p += width) {
      if (axis === "x") records.push(rectRecord(p, a0, p + width, a1, `MOD_${side}_${p}`));
      else records.push(rectRecord(a0, p, a1, p + width, `MOD_${side}_${p}`));
    }
  }
  return { allModules: records, validModules: records.slice(), culledModules: [] };
}

function buildLouvers(facadeHalf, thickness, gridSpan) {
  const minor = clamp(state.facadeMinorAxis || thickness / 2, 10, Math.max(10, thickness * 2 / 3));
  const spacing = snapFacadeSpacing(state.facadeSpacing, minor, gridSpan);
  const louvers = [];
  const inset = Math.max(20, thickness / 2);
  const half = facadeHalf - inset;
  const sides = [
    ["bottom", -half, -half, half, -half, 0],
    ["top", -half, half, half, half, 0],
    ["left", -half, -half, -half, half, 90],
    ["right", half, -half, half, half, 90]
  ];
  for (const [side, x0, y0, x1, y1, angle] of sides) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const count = Math.max(0, Math.floor(len / spacing) - 1);
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      const center = { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
      louvers.push({ center, rx: thickness / 2, ry: minor / 2, angle, side, key: `LOUVER_${side}_${i}` });
    }
  }
  return { items: louvers, spacing, minorAxis: minor };
}

function buildElevators(boardHalf, outerHalf, modules) {
  const unit = 4000;
  const slotW = Math.ceil(unit / state.gridSpan) * state.gridSpan;
  const candidates = [];
  for (let x = -boardHalf + slotW / 2; x <= boardHalf - slotW / 2 + 1e-6; x += state.gridSpan) {
    candidates.push(x);
  }
  const validSlots = candidates.map((x, i) => ({ x, index: i }));
  const upperIndex = clamp(state.elevUpperSlot >= 900 ? validSlots.length - 1 : state.elevUpperSlot, 0, validSlots.length - 1);
  const lowerIndex = clamp(state.elevLowerSlot, 0, validSlots.length - 1);
  const topY = outerHalf;
  const bottomY = -outerHalf;
  const pairs = [
    ["Upper", validSlots[upperIndex]?.x ?? 0],
    ["Lower", validSlots[lowerIndex]?.x ?? 0]
  ];
  const boxes = [];
  const columns = [];
  const frontZones = [];
  for (const [pair, cx] of pairs) {
    for (const side of ["bottom", "top"]) {
      const yOuter = side === "top" ? topY : bottomY;
      const y0 = side === "top" ? yOuter - unit : yOuter;
      const y1 = side === "top" ? yOuter : yOuter + unit;
      const box = rectRecord(cx - unit / 2, y0, cx + unit / 2, y1, `ELEV_${pair}_${side}`);
      boxes.push(box);
      const z0 = side === "top" ? y0 - state.elevFrontDepth : y1 - state.elevFrontBackOverlap;
      const z1 = side === "top" ? y0 + state.elevFrontBackOverlap : y1 + state.elevFrontDepth;
      frontZones.push(rectRecord(cx - unit / 2, Math.min(z0, z1), cx + unit / 2, Math.max(z0, z1), `ZONE_${pair}_${side}`));
      const pad = 600;
      for (const px of [box.minX + pad, box.maxX - pad]) {
        for (const py of [box.minY + pad, box.maxY - pad]) {
          columns.push({ x: px, y: py, r: 180, key: `COL_${pair}_${side}_${px}_${py}` });
        }
      }
    }
  }
  const culledModules = [];
  const validModules = [];
  for (const m of modules.validModules) {
    const mb = bboxLocal(m.poly);
    const hit = boxes.some((e) => bboxOverlapArea(mb, bboxLocal(e.poly)) > 0);
    (hit ? culledModules : validModules).push(m);
  }
  modules.culledModules = culledModules;
  modules.validModules = validModules;
  return { boxes, columns, frontZones, validSlots, upperIndex, lowerIndex };
}

function buildCatwalkPieces(facadeHalf, outerHalf, catHalf, pivotHalf, span, frontZones) {
  const pieces = [];
  const rails = [];
  const innerBands = [
    ["bottom", -catHalf, -pivotHalf, "x"],
    ["top", pivotHalf, catHalf, "x"],
    ["left", -catHalf, -pivotHalf, "y"],
    ["right", pivotHalf, catHalf, "y"]
  ];
  const outerBands = [
    ["bottom", -facadeHalf, -outerHalf, "x"],
    ["top", outerHalf, facadeHalf, "x"],
    ["left", -facadeHalf, -outerHalf, "y"],
    ["right", outerHalf, facadeHalf, "y"]
  ];
  for (const band of [...outerBands, ...innerBands]) {
    const [side, a0, a1, axis] = band;
    const min = axis === "x" ? -facadeHalf : -facadeHalf;
    const max = axis === "x" ? facadeHalf : facadeHalf;
    for (let p = Math.ceil(min / span) * span; p + span <= max + 1e-6; p += span) {
      const rect = axis === "x"
        ? rectRecord(p, Math.min(a0, a1), p + span, Math.max(a0, a1), `CW_${side}_${p}`)
        : rectRecord(Math.min(a0, a1), p, Math.max(a0, a1), p + span, `CW_${side}_${p}`);
      const rb = bboxLocal(rect.poly);
      const removed = frontZones.some((z) => bboxOverlapArea(rb, bboxLocal(z.poly)) > 0);
      pieces.push({ ...rect, removed });
      if (!removed) {
        if (axis === "x") rails.push({ a: { x: p, y: a1 }, b: { x: p + span, y: a1 }, key: `RAIL_${side}_${p}` });
        else rails.push({ a: { x: a1, y: p }, b: { x: a1, y: p + span }, key: `RAIL_${side}_${p}` });
      }
    }
  }
  return { pieces, rails, removed: pieces.filter((p) => p.removed) };
}

function buildPivotDoors(pivotHalf, frontZones, span) {
  const doors = [];
  const count = Math.max(2, Math.floor((pivotHalf * 2) / (span * 4)));
  const sides = [
    ["bottom", "x", -pivotHalf],
    ["top", "x", pivotHalf],
    ["left", "y", -pivotHalf],
    ["right", "y", pivotHalf]
  ];
  for (const [side, axis, fixed] of sides) {
    for (let i = 0; i < count; i += 1) {
      const center = -pivotHalf + ((i + 0.5) * (pivotHalf * 2)) / count;
      const halfW = 650;
      const depth = 260;
      const rect = axis === "x"
        ? rectRecord(center - halfW, fixed - depth / 2, center + halfW, fixed + depth / 2, `PIVOT_${side}_${i}`)
        : rectRecord(fixed - depth / 2, center - halfW, fixed + depth / 2, center + halfW, `PIVOT_${side}_${i}`);
      const hit = frontZones.some((z) => bboxOverlapArea(bboxLocal(rect.poly), bboxLocal(z.poly)) > 0);
      doors.push({ ...rect, side, axis, center, fixed, open: hit });
    }
  }
  return { all: doors, opened: doors.filter((d) => d.open), closed: doors.filter((d) => !d.open) };
}

function buildHBeams(facadeHalf, pivotHalf, modules, span) {
  const beams = [];
  const positions = new Set();
  for (const m of modules) {
    const b = bboxLocal(m.poly);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    if (Math.abs(cx) > Math.abs(cy)) {
      positions.add(`y:${Math.round(cy / span) * span}`);
    } else {
      positions.add(`x:${Math.round(cx / span) * span}`);
    }
  }
  for (const item of positions) {
    const [axis, raw] = item.split(":");
    const v = Number(raw);
    if (axis === "x") beams.push({ a: { x: v, y: -facadeHalf }, b: { x: v, y: -pivotHalf }, key: `HB_B_${v}` }, { a: { x: v, y: pivotHalf }, b: { x: v, y: facadeHalf }, key: `HB_T_${v}` });
    else beams.push({ a: { x: -facadeHalf, y: v }, b: { x: -pivotHalf, y: v }, key: `HB_L_${v}` }, { a: { x: pivotHalf, y: v }, b: { x: facadeHalf, y: v }, key: `HB_R_${v}` });
  }
  return beams;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function svgEl(tag, attrs = {}, parent = $("boardSvg")) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false && value != null) el.setAttribute(key, value);
  }
  parent.appendChild(el);
  return el;
}

function drawRect(record, className, parent) {
  svgEl("path", { d: polygonPath(toWorldPoly(record.poly)), class: className, "data-key": record.key }, parent);
}

function drawLine(line, className, parent) {
  svgEl("path", { d: linePath(localToWorld(line.a), localToWorld(line.b)), class: className, "data-key": line.key }, parent);
}

function render() {
  latest = buildGameBoard();
  renderSvg(latest);
  renderInspector(latest);
}

function renderSvg(data) {
  const svg = $("boardSvg");
  clear(svg);
  const pad = 13000;
  const minX = -state.siteWidth / 2 - pad;
  const maxX = state.siteWidth / 2 + pad;
  const minY = -state.siteHeight / 2 - pad;
  const maxY = state.siteHeight / 2 + pad;
  svg.setAttribute("viewBox", `${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`);

  const base = svgEl("g", { id: "base" });
  svgEl("path", { d: polygonPath(data.site.poly), class: "svg-site" }, base);
  for (const [a, b] of data.limitLines) svgEl("path", { d: linePath(a, b), class: "svg-limit" }, base);
  svgEl("path", { d: polygonPath(data.rect.poly), class: "svg-rect" }, base);
  svgEl("path", { d: polygonPath(data.building.poly), class: "svg-building" }, base);

  if (state.showCatwalk) {
    const g = svgEl("g", { id: "catwalk" });
    drawRect(data.catwalk, "svg-catwalk-line", g);
    drawRect(data.facade, "svg-building", g);
    drawRect(data.outerLine, "svg-outer-line", g);
    for (const p of data.catwalkPieces.pieces) drawRect(p, p.removed ? "svg-module culled" : "svg-catwalk-fill", g);
    for (const r of data.catwalkPieces.rails) drawLine(r, "svg-rail", g);
  }

  if (state.showCells) {
    const g = svgEl("g", { id: "grid" });
    drawRect(data.gameBoard, "svg-grid", g);
    for (const cell of data.cells) drawRect(cell, "svg-cell", g);
  }

  if (state.showTiles) {
    const g = svgEl("g", { id: "tiles" });
    for (const tile of data.tiles) drawRect(tile, "svg-tile", g);
  }

  if (state.showModules) {
    const g = svgEl("g", { id: "modules" });
    for (const m of data.modules.validModules) drawRect(m, "svg-module", g);
    for (const m of data.modules.culledModules) drawRect(m, "svg-module culled", g);
  }

  if (state.showLouvers) {
    const g = svgEl("g", { id: "louvers" });
    for (const l of data.louvers.items) {
      const world = localToWorld(l.center);
      svgEl("path", {
        d: ellipsePointPath(world, l.rx, l.ry, state.angle + l.angle),
        class: "svg-louver",
        "data-key": l.key
      }, g);
    }
  }

  if (state.showStructure) {
    const g = svgEl("g", { id: "structure" });
    for (const h of data.hbeams) drawLine(h, "svg-hbeam", g);
  }

  if (state.showElevators) {
    const g = svgEl("g", { id: "elevators" });
    for (const z of data.elev.frontZones) drawRect(z, "svg-front-zone", g);
    for (const e of data.elev.boxes) drawRect(e, "svg-elev", g);
    for (const c of data.elev.columns) {
      const p = localToWorld(c);
      svgEl("circle", { cx: p.x, cy: -p.y, r: c.r, class: "svg-column" }, g);
    }
  }

  if (state.showPivotDoors) {
    const g = svgEl("g", { id: "pivot" });
    for (const d of data.pivotDoors.closed) drawRect(d, "svg-pivot", g);
    for (const d of data.pivotDoors.opened) {
      const c = d.axis === "x"
        ? { x: d.minX, y: d.fixed }
        : { x: d.fixed, y: d.minY };
      const length = 1300;
      const dir = d.axis === "x"
        ? { x: Math.cos(rad(state.pivotOpenAngle)) * length, y: Math.sin(rad(state.pivotOpenAngle)) * length * (d.side === "top" ? -1 : 1) }
        : { x: Math.sin(rad(state.pivotOpenAngle)) * length * (d.side === "right" ? -1 : 1), y: Math.cos(rad(state.pivotOpenAngle)) * length };
      drawLine({ a: c, b: { x: c.x + dir.x, y: c.y + dir.y }, key: d.key }, "svg-door-open", g);
    }
  }

  const labelPos = localToWorld({ x: -data.boardSize / 2, y: data.boardSize / 2 + 2100 });
  svgEl("text", { x: labelPos.x, y: -labelPos.y, class: "svg-label" }).textContent = `GameBoard ${fmt(data.boardSize)} / Grid ${fmt(data.gridSpan)}`;
}

function renderInspector(data) {
  $("validText").textContent = data.valid ? "VALID" : "INVALID";
  $("validText").classList.toggle("invalid", !data.valid);
  $("fitnessText").textContent = data.fitness > -1e17 ? Math.round(data.fitness).toLocaleString("ko-KR") : "-INF";
  setDl($("metricsList"), [
    ["Area", areaFmt(data.area)],
    ["Touches", data.touches],
    ["Violation", data.violation.toFixed(2)],
    ["Area Score", data.areaScore.toFixed(3)],
    ["Y Score", data.yScore.toFixed(3)],
    ["Center Score", data.centerScore.toFixed(3)],
    ["Side", fmt(data.side, " mm")],
    ["Rotation", `${state.angle} deg`],
    ["Catwalk Span", fmt(data.catwalkSpan, " mm")]
  ]);
  setDl($("countsList"), [
    ["Grid Cells", data.cells.length],
    ["Grid Tiles", data.tiles.length],
    ["Facade Louvers", data.louvers.items.length],
    ["Catwalk Pieces", data.catwalkPieces.pieces.length],
    ["Removed Rails", data.catwalkPieces.removed.length],
    ["Modules", data.modules.validModules.length],
    ["Culled Modules", data.modules.culledModules.length],
    ["Elev Units", data.elev.boxes.length],
    ["Elev Columns", data.elev.columns.length],
    ["Pivot Doors", data.pivotDoors.all.length],
    ["Opened Doors", data.pivotDoors.opened.length],
    ["H-Beams", data.hbeams.length]
  ]);
  $("logOutput").textContent = data.logs.map((line) => `[${new Date().toLocaleTimeString("ko-KR", { hour12: false })}] ${line}`).join("\n");
}

function setDl(node, pairs) {
  clear(node);
  for (const [k, v] of pairs) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    node.append(dt, dd);
  }
}

function makeRange(container, key, label, min, max, step, unit = "") {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const lab = document.createElement("label");
  lab.textContent = label;
  const range = document.createElement("input");
  range.type = "range";
  range.min = min;
  range.max = max;
  range.step = step;
  range.value = state[key];
  const num = document.createElement("input");
  num.type = "number";
  num.min = min;
  num.max = max;
  num.step = step;
  num.value = state[key];
  const sync = (value) => {
    state[key] = Number(value);
    range.value = state[key];
    num.value = state[key];
    render();
  };
  range.addEventListener("input", () => sync(range.value));
  num.addEventListener("change", () => sync(num.value));
  lab.title = unit;
  wrap.append(lab, range, num);
  container.appendChild(wrap);
}

function makeToggle(container, key, label) {
  const wrap = document.createElement("div");
  wrap.className = "control toggle";
  const lab = document.createElement("label");
  lab.textContent = label;
  const sw = document.createElement("label");
  sw.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(state[key]);
  const knob = document.createElement("span");
  input.addEventListener("change", () => {
    state[key] = input.checked;
    render();
  });
  sw.append(input, knob);
  wrap.append(lab, sw);
  container.appendChild(wrap);
}

function buildControls() {
  const base = $("baseControls");
  makeRange(base, "x", "x", -22000, 22000, 500, "mm");
  makeRange(base, "y", "y", -16000, 16000, 500, "mm");
  makeRange(base, "side", "s (side)", 24000, 68000, 500, "mm");
  makeRange(base, "angle", "angle", -45, 45, 1, "deg");
  makeRange(base, "serviceLayer", "Service Layer", 1500, 9000, 500, "mm");
  makeRange(base, "gridSpan", "Grid Span", 1000, 3000, 500, "mm");
  makeRange(base, "facadeThickness", "Facade Thick", 100, 900, 50, "mm");
  makeRange(base, "outerCatwalk", "Outer Catwalk", 700, 4000, 100, "mm");

  const mod = $("moduleControls");
  makeRange(mod, "moduleWidth", "Module Width", 1500, 7500, 1500, "mm");
  makeToggle(mod, "moduleClockwise", "Module Clockwise");
  makeRange(mod, "floorHeight", "Floor Height", 2500, 7000, 250, "mm");
  makeRange(mod, "slabThickness", "Slab Thick", 0, 1200, 50, "mm");

  const facade = $("facadeControls");
  makeRange(facade, "facadeMinorAxis", "Minor Axis", 40, 500, 10, "mm");
  makeRange(facade, "facadeSpacing", "Spacing", 300, 6000, 100, "mm");

  const elev = $("elevControls");
  makeRange(elev, "pivotDoorDepth", "Pivot Depth", 0, 1800, 100, "mm");
  makeRange(elev, "elevFrontDepth", "Front Depth", 0, 4000, 100, "mm");
  makeRange(elev, "elevFrontBackOverlap", "Back Overlap", 0, 800, 50, "mm");
  makeRange(elev, "elevUpperSlot", "Upper Slot", 0, 999, 1, "index");
  makeRange(elev, "elevLowerSlot", "Lower Slot", 0, 20, 1, "index");
  makeRange(elev, "pivotOpenAngle", "Open Angle", 0, 120, 5, "deg");

  const display = $("displayControls");
  makeToggle(display, "showCells", "Show Grid Cells");
  makeToggle(display, "showTiles", "Show Floor Tiles");
  makeToggle(display, "showCatwalk", "Show Catwalk");
  makeToggle(display, "showStructure", "Show Structure");
  makeToggle(display, "showLouvers", "Show Louvers");
  makeToggle(display, "showElevators", "Show Elevators");
  makeToggle(display, "showPivotDoors", "Show Pivot Doors");
  makeToggle(display, "showModules", "Show Modules");
}

function buildLegend() {
  const legend = $("legend");
  for (const [name, color] of Object.entries(COLORS)) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = color;
    const text = document.createElement("span");
    text.textContent = name;
    item.append(dot, text);
    legend.appendChild(item);
  }
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function serializableData() {
  return {
    inputs: { ...state },
    outputs: {
      valid: latest.valid,
      fitness: latest.fitness,
      area: latest.area,
      side: latest.side,
      boardSize: latest.boardSize,
      catwalkSpan: latest.catwalkSpan,
      counts: {
        gameCells: latest.cells.length,
        gridTiles: latest.tiles.length,
        facadeLouvers: latest.louvers.items.length,
        catwalkPieces: latest.catwalkPieces.pieces.length,
        removedCatwalkPieces: latest.catwalkPieces.removed.length,
        modules: latest.modules.validModules.length,
        culledModules: latest.modules.culledModules.length,
        elevUnits: latest.elev.boxes.length,
        pivotDoors: latest.pivotDoors.all.length,
        pivotOpened: latest.pivotDoors.opened.length,
        hBeams: latest.hbeams.length
      },
      geometry: {
        rect: latest.rect.poly,
        gameBoard: latest.gameBoard.poly.map(localToWorld),
        gameCells: latest.cells.map((c) => ({ key: c.key, points: c.poly.map(localToWorld) })),
        modules: latest.modules.validModules.map((m) => ({ key: m.key, points: m.poly.map(localToWorld) })),
        elevBoxes: latest.elev.boxes.map((e) => ({ key: e.key, points: e.poly.map(localToWorld) })),
        pivotDoors: latest.pivotDoors.all.map((d) => ({ key: d.key, open: d.open, points: d.poly.map(localToWorld) }))
      },
      log: latest.logs
    }
  };
}

function setupEvents() {
  $("resetBtn").addEventListener("click", () => {
    Object.assign(state, DEFAULTS);
    document.querySelectorAll(".control-stack").forEach(clear);
    buildControls();
    render();
  });
  $("exportJsonBtn").addEventListener("click", () => {
    download("gameboard-generator-output.json", JSON.stringify(serializableData(), null, 2), "application/json");
  });
  $("exportSvgBtn").addEventListener("click", () => {
    const svg = $("boardSvg").cloneNode(true);
    svg.setAttribute("xmlns", NS);
    download("gameboard-generator-plan.svg", new XMLSerializer().serializeToString(svg), "image/svg+xml");
  });
  $("boardSvg").addEventListener("mousemove", (event) => {
    const svg = $("boardSvg");
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    $("cursorReadout").textContent = `X: ${Math.round(p.x).toLocaleString("ko-KR")} / Y: ${Math.round(-p.y).toLocaleString("ko-KR")} mm`;
  });
}

buildLegend();
buildControls();
setupEvents();
render();
