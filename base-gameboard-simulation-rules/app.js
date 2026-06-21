import {
  DEFAULT_RECORDING_SETTINGS,
  buildRecordingInfo,
  chooseRecordingMimeType,
  recordingFilename
} from "./recording.js";
import {
  connectedGroupsAtLeast,
  shouldSkipTerritoryCandidate
} from "./territory.js";

const DEFAULTS = {
  gridCount: DEFAULT_RECORDING_SETTINGS.gridCount,
  cellSize: 1500,
  catwalkWidth: 3000,
  moduleMultiple: DEFAULT_RECORDING_SETTINGS.moduleMultiple,
  moduleFillDirection: "clockwise",
  pivotDepth: 600,
  playerCount: 4,
  simTurns: 30,
  currentTurn: 0,
  playSpeed: 4,
  rookProb: 40,
  bishopProb: 35,
  knightProb: 25,
  attackProb: 45,
  doorHoldTurns: 3,
  player1Cap: 24,
  player2Cap: 24,
  player3Cap: 24,
  player4Cap: 24,
  player5Cap: 24,
  player6Cap: 24,
  player7Cap: 24,
  player8Cap: 24,
  overLimitDiscardProb: 50,
  territorySkipEnabled: true,
  territorySkipStartTurn: 10,
  clusterKeepCount: 4,
  voidTopRows: 0,
  voidRightRows: 0,
  voidBottomRows: 0,
  voidLeftRows: 0,
  showGrid: true,
  showPivot: true,
  showCatwalk: true,
  showModules: true,
  showGuides: true
};

const state = { ...DEFAULTS };
let playbackTimer = null;
let mediaRecorder = null;
let recordingStream = null;
let recordingClockTimer = null;
let recordingStartedAt = 0;
let recordingPaintPending = false;
let recordedVideoBlob = null;
const COLORS = {
  Grid: "#111111",
  Pivot: "#ff6192",
  Void: "#d9d9d9",
  Catwalk: "#f5dff5",
  Module: "#b887b8",
  Player: "#00a9f4"
};

const PLAYER_COLORS = [
  "#00a9f4",
  "#ff6192",
  "#111111",
  "#7d5cff",
  "#00b894",
  "#ff9f1c",
  "#e84393",
  "#6c5ce7"
];

let latest = null;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const RECORDING_SVG_STYLE = `
  svg { background: #ffffff; }
  .gridCell { fill: #ffffff; stroke: #6d6d6d; stroke-width: 24; }
  .voidCell { fill: #d9d9d9; stroke: #777777; stroke-width: 30; }
  .gridFrame { fill: none; stroke: #111111; stroke-width: 64; }
  .pivotDoor { fill: #ffffff; stroke: #111111; stroke-width: 44; }
  .pivotDoor.open { fill: color-mix(in srgb, var(--door-color) 28%, white); stroke: var(--door-color); stroke-width: 54; }
  .pivotHinge { fill: #ffffff; stroke: #111111; stroke-width: 22; }
  .pieceCell { fill: var(--piece-color); stroke: #111111; stroke-width: 34; }
  .ringFill.catwalk { fill: #f5dff5; fill-opacity: .62; }
  .ringFill.module { fill: #f8edf8; fill-opacity: .72; }
  .ringLine { fill: none; stroke-width: 62; }
  .ringLine.catwalk { stroke: #111111; }
  .ringLine.module { stroke: #9d719c; }
  .moduleSplit { stroke: #b887b8; stroke-width: 34; }
  .moduleCell { fill: #f5dff5; fill-opacity: .34; stroke: #b887b8; stroke-width: 28; }
  .proportionLine { stroke: #9b9b9b; stroke-width: 18; stroke-dasharray: 300 240; opacity: .5; }
  .label { fill: #111111; font: 650 700px Arial, sans-serif; paint-order: stroke; stroke: #ffffff; stroke-width: 100px; }
`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fmt(value, unit = "") {
  return `${Math.round(value).toLocaleString("ko-KR")}${unit}`;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function rect(x0, y0, x1, y1, key = "") {
  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const maxX = Math.max(x0, x1);
  const maxY = Math.max(y0, y1);
  return { minX, minY, maxX, maxY, key };
}

function rectPath(r) {
  return `M ${r.minX} ${-r.minY} L ${r.maxX} ${-r.minY} L ${r.maxX} ${-r.maxY} L ${r.minX} ${-r.maxY} Z`;
}

function ringPath(outer, inner) {
  return `${rectPath(outer)} ${rectPath(inner)}`;
}

function linePath(a, b) {
  return `M ${a.x} ${-a.y} L ${b.x} ${-b.y}`;
}

function polyPath(points) {
  if (!points.length) return "";
  return `M ${points.map((p) => `${p.x} ${-p.y}`).join(" L ")} Z`;
}

function svgEl(tag, attrs = {}, parent = $("boardSvg")) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false && value != null) el.setAttribute(key, value);
  }
  parent.appendChild(el);
  return el;
}

function buildBaseGameboard() {
  const gridCount = Math.max(4, Math.round(state.gridCount));
  const cellSize = Math.max(500, state.cellSize);
  const gridSize = gridCount * cellSize;
  const halfGrid = gridSize / 2;
  const gridFrame = rect(-halfGrid, -halfGrid, halfGrid, halfGrid, "GridFrame");

  const pivotDepth = Math.max(200, state.pivotDepth);
  const pivotOuterHalf = halfGrid + pivotDepth;
  const pivotOuter = rect(-pivotOuterHalf, -pivotOuterHalf, pivotOuterHalf, pivotOuterHalf, "PivotDoorRing");

  const catwalkWidth = Math.max(500, state.catwalkWidth);
  const catwalkOuterHalf = pivotOuterHalf + catwalkWidth;
  const catwalkOuter = rect(-catwalkOuterHalf, -catwalkOuterHalf, catwalkOuterHalf, catwalkOuterHalf, "Catwalk");

  const moduleMultiple = Math.max(2, Math.round(state.moduleMultiple));
  const moduleWidth = cellSize * moduleMultiple;
  const moduleOuterHalf = catwalkOuterHalf + moduleWidth;
  const moduleOuter = rect(-moduleOuterHalf, -moduleOuterHalf, moduleOuterHalf, moduleOuterHalf, "ModuleStructure");

  const gridCells = [];
  const voidCells = [];
  const voidTopRows = clamp(Math.round(state.voidTopRows), 0, gridCount);
  const voidRightRows = clamp(Math.round(state.voidRightRows), 0, gridCount);
  const voidBottomRows = clamp(Math.round(state.voidBottomRows), 0, gridCount);
  const voidLeftRows = clamp(Math.round(state.voidLeftRows), 0, gridCount);
  for (let ix = 0; ix < gridCount; ix += 1) {
    for (let iy = 0; iy < gridCount; iy += 1) {
      const x0 = -halfGrid + ix * cellSize;
      const y0 = -halfGrid + iy * cellSize;
      const cell = rect(x0, y0, x0 + cellSize, y0 + cellSize, `CELL_${ix}_${iy}`);
      cell.ix = ix;
      cell.iy = iy;
      const isVoid =
        iy >= gridCount - voidTopRows ||
        iy < voidBottomRows ||
        ix < voidLeftRows ||
        ix >= gridCount - voidRightRows;

      if (isVoid) {
        cell.key = `VOID_${ix}_${iy}`;
        voidCells.push(cell);
      } else {
        gridCells.push(cell);
      }
    }
  }

  const moduleEveryCells = moduleMultiple;
  const moduleCells = [];
  const moduleSplits = [];
  const sideMin = -catwalkOuterHalf;
  const sideMax = catwalkOuterHalf;
  const sideLength = sideMax - sideMin;
  const modulesPerSide = Math.floor(sideLength / moduleWidth);
  const moduleRemainder = Math.max(0, sideLength - modulesPerSide * moduleWidth);
  const clockwise = state.moduleFillDirection === "clockwise";

  function sideSegments(reverse) {
    if (modulesPerSide <= 0) return [];
    const occupiedStart = reverse ? sideMax - modulesPerSide * moduleWidth : sideMin;
    const segments = [];
    for (let i = 0; i < modulesPerSide; i += 1) {
      const a = occupiedStart + i * moduleWidth;
      segments.push([a, a + moduleWidth, i]);
    }
    return segments;
  }

  const sideDefs = [
    { side: "top", axis: "x", reverse: !clockwise, inner: catwalkOuterHalf, outer: moduleOuterHalf },
    { side: "right", axis: "y", reverse: clockwise, inner: catwalkOuterHalf, outer: moduleOuterHalf },
    { side: "bottom", axis: "x", reverse: clockwise, inner: -catwalkOuterHalf, outer: -moduleOuterHalf },
    { side: "left", axis: "y", reverse: !clockwise, inner: -catwalkOuterHalf, outer: -moduleOuterHalf }
  ];

  for (const def of sideDefs) {
    const segments = sideSegments(def.reverse);
    for (const [a, b, i] of segments) {
      if (def.axis === "x") {
        moduleCells.push(rect(a, def.inner, b, def.outer, `MODULE_${def.side.toUpperCase()}_${i}`));
      } else {
        moduleCells.push(rect(def.inner, a, def.outer, b, `MODULE_${def.side.toUpperCase()}_${i}`));
      }

      if (i > 0) {
        const p = a;
        if (def.axis === "x") {
          moduleSplits.push({ a: { x: p, y: def.inner }, b: { x: p, y: def.outer }, key: `MOD_${def.side.toUpperCase()}_${i}` });
        } else {
          moduleSplits.push({ a: { x: def.inner, y: p }, b: { x: def.outer, y: p }, key: `MOD_${def.side.toUpperCase()}_${i}` });
        }
      }
    }
  }

  const pivotDoors = [];
  const doorInset = Math.min(cellSize * 0.16, pivotDepth * 0.25);
  const doorDepth = Math.max(160, pivotDepth - doorInset * 2);
  for (let i = 0; i < gridCount; i += 1) {
    const a0 = -halfGrid + i * cellSize + cellSize * 0.12;
    const a1 = -halfGrid + (i + 1) * cellSize - cellSize * 0.12;
    for (const side of ["bottom", "top"]) {
      const y0 = side === "top" ? halfGrid + doorInset : -halfGrid - doorInset - doorDepth;
      const y1 = y0 + doorDepth;
      pivotDoors.push({ ...rect(a0, y0, a1, y1, `PIVOT_${side}_${i}`), side, index: i, open: false });
    }
    for (const side of ["left", "right"]) {
      const x0 = side === "left" ? -halfGrid - doorInset - doorDepth : halfGrid + doorInset;
      const x1 = x0 + doorDepth;
      pivotDoors.push({ ...rect(x0, a0, x1, a1, `PIVOT_${side}_${i}`), side, index: i, open: false });
    }
  }

  const simulation = runSimulation(gridCount, gridCells, cellSize, halfGrid);

  for (const door of pivotDoors) {
    const edgeKey = edgeCellKeyForDoor(door, gridCount);
    const hold = doorHoldInfo(edgeKey, simulation.history, simulation.currentTurn);
    door.holdTurns = hold.turns;
    door.openPlayer = hold.player;
    door.open = hold.turns >= Math.max(1, Math.round(state.doorHoldTurns));
  }

  const guides = [
    { a: { x: -halfGrid, y: -moduleOuterHalf }, b: { x: -halfGrid, y: moduleOuterHalf } },
    { a: { x: halfGrid, y: -moduleOuterHalf }, b: { x: halfGrid, y: moduleOuterHalf } },
    { a: { x: -moduleOuterHalf, y: -halfGrid }, b: { x: moduleOuterHalf, y: -halfGrid } },
    { a: { x: -moduleOuterHalf, y: halfGrid }, b: { x: moduleOuterHalf, y: halfGrid } }
  ];

  const logs = [
    "Base GameBoard generated from inner grid.",
    `Grid = ${gridCount} x ${gridCount}`,
    `Grid span = ${fmt(cellSize, " mm")}`,
    `Void cells = ${voidCells.length}`,
    `Players = ${simulation.playerCount}, turn = ${simulation.currentTurn} / ${simulation.turns}`,
    `Occupied cells = ${simulation.occupied.size}`,
    `Captures = ${simulation.captures}`,
    `Pivot hold turns = ${Math.max(1, Math.round(state.doorHoldTurns))}`,
    `Pivot doors = ${pivotDoors.length}, opened = ${pivotDoors.filter((d) => d.open).length}`,
    `Cell caps = ${activePlayerCaps(simulation.playerCount).join(", ")}, discard chance = ${Math.round(state.overLimitDiscardProb)}%`,
    `Territory skip = ${state.territorySkipEnabled ? `on from turn ${Math.round(state.territorySkipStartTurn)}` : "off"}`,
    `Cluster keep = connected ${Math.round(state.clusterKeepCount)}+ cells`,
    `Catwalk width = ${fmt(catwalkWidth, " mm")}`,
    `Module width = grid span * ${moduleEveryCells} = ${fmt(moduleWidth, " mm")}`,
    `Module remainder per side = ${fmt(moduleRemainder, " mm")}`,
    `Module empty direction = ${state.moduleFillDirection}`
  ];

  return {
    gridCount,
    cellSize,
    gridSize,
    gridFrame,
    gridCells,
    voidCells,
    pivotOuter,
    catwalkOuter,
    moduleOuter,
    pivotDoors,
    simulation,
    moduleCells,
    moduleSplits,
    guides,
    moduleEveryCells,
    logs,
    counts: {
      gridCells: gridCells.length,
      voidCells: voidCells.length,
      pivotDoors: pivotDoors.length,
      openDoors: pivotDoors.filter((d) => d.open).length,
      occupiedCells: simulation.occupied.size,
      captures: simulation.captures,
      moduleCells: moduleCells.length,
      moduleSplits: moduleSplits.length,
      modulesPerSide,
      rings: 3
    },
    dimensions: {
      gridSize,
      pivotDepth,
      catwalkWidth,
      moduleWidth,
      moduleRemainder,
      totalSize: moduleOuterHalf * 2
    }
  };
}

function drawRect(r, className, parent) {
  svgEl("path", { d: rectPath(r), class: className, "data-key": r.key }, parent);
}

function drawLine(line, className, parent) {
  svgEl("path", { d: linePath(line.a, line.b), class: className, "data-key": line.key }, parent);
}

function drawPivotDoor(door, parent) {
  if (!door.open) {
    drawRect(door, "pivotDoor", parent);
    return;
  }

  const length = door.side === "top" || door.side === "bottom"
    ? door.maxX - door.minX
    : door.maxY - door.minY;
  const thickness = Math.max(80, Math.min(door.maxX - door.minX, door.maxY - door.minY));
  const angle = Math.PI * 0.34 * (door.side === "top" || door.side === "right" ? -1 : 1);
  const baseVec = door.side === "top" || door.side === "bottom" ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const hinge = door.side === "top" || door.side === "bottom"
    ? { x: door.minX, y: (door.minY + door.maxY) * 0.5 }
    : { x: (door.minX + door.maxX) * 0.5, y: door.minY };
  const dir = {
    x: baseVec.x * Math.cos(angle) - baseVec.y * Math.sin(angle),
    y: baseVec.x * Math.sin(angle) + baseVec.y * Math.cos(angle)
  };
  const normal = { x: -dir.y, y: dir.x };
  const halfT = thickness * 0.5;
  const end = { x: hinge.x + dir.x * length, y: hinge.y + dir.y * length };
  const points = [
    { x: hinge.x + normal.x * halfT, y: hinge.y + normal.y * halfT },
    { x: end.x + normal.x * halfT, y: end.y + normal.y * halfT },
    { x: end.x - normal.x * halfT, y: end.y - normal.y * halfT },
    { x: hinge.x - normal.x * halfT, y: hinge.y - normal.y * halfT }
  ];
  const color = PLAYER_COLORS[(door.openPlayer || 0) % PLAYER_COLORS.length];
  svgEl("path", { d: polyPath(points), class: "pivotDoor open", style: `--door-color:${color}`, "data-key": door.key }, parent);
  svgEl("circle", { cx: hinge.x, cy: -hinge.y, r: thickness * 0.32, class: "pivotHinge" }, parent);
}

function render() {
  state.currentTurn = clamp(Math.round(state.currentTurn), 0, Math.max(0, Math.round(state.simTurns)));
  latest = buildBaseGameboard();
  renderSvg(latest);
  renderInspector(latest);
  updatePlaybackButtons();
  updateRecordingControls();
  if (isRecording()) paintRecordingFrame();
}

function renderSvg(data) {
  const svg = $("boardSvg");
  clear(svg);
  const pad = Math.max(1800, data.dimensions.totalSize * 0.06);
  const half = data.dimensions.totalSize / 2 + pad;
  svg.setAttribute("viewBox", `${-half} ${-half} ${half * 2} ${half * 2}`);

  if (state.showGuides) {
    const g = svgEl("g", { id: "guides" });
    for (const guide of data.guides) drawLine(guide, "proportionLine", g);
  }

  if (state.showModules) {
    svgEl("path", {
      d: ringPath(data.moduleOuter, data.catwalkOuter),
      class: "ringFill module",
      "fill-rule": "evenodd"
    });
    drawRect(data.moduleOuter, "ringLine module");
    const cells = svgEl("g", { id: "moduleCells" });
    for (const cell of data.moduleCells) drawRect(cell, "moduleCell", cells);
    const splits = svgEl("g", { id: "moduleSplits" });
    for (const split of data.moduleSplits) drawLine(split, "moduleSplit", splits);
  }

  if (state.showCatwalk) {
    svgEl("path", {
      d: ringPath(data.catwalkOuter, data.pivotOuter),
      class: "ringFill catwalk",
      "fill-rule": "evenodd"
    });
    drawRect(data.catwalkOuter, "ringLine catwalk");
  }

  if (state.showPivot) {
    const g = svgEl("g", { id: "pivotDoors" });
    for (const door of data.pivotDoors) drawPivotDoor(door, g);
  }

  if (state.showGrid) {
    const g = svgEl("g", { id: "grid" });
    for (const cell of data.voidCells) drawRect(cell, "voidCell", g);
    for (const cell of data.gridCells) drawRect(cell, "gridCell", g);
    for (const piece of data.simulation.pieces) {
      svgEl("path", {
        d: rectPath(piece.rect),
        class: "pieceCell",
        style: `--piece-color:${PLAYER_COLORS[piece.player % PLAYER_COLORS.length]}`,
        "data-key": piece.key
      }, g);
    }
    drawRect(data.gridFrame, "gridFrame", g);
  }

  svgEl("text", { x: data.gridFrame.minX, y: -(data.moduleOuter.maxY + 1150), class: "label" }).textContent =
    `Base GameBoard ${data.gridCount}x${data.gridCount} / span ${fmt(data.cellSize)}`;
}

function renderInspector(data) {
  $("subtitle").textContent = `${data.gridCount}x${data.gridCount}, module ${fmt(data.dimensions.moduleWidth, " mm")}`;
  setDl($("dimensionList"), [
    ["Grid size", fmt(data.dimensions.gridSize, " mm")],
    ["Grid span", fmt(data.cellSize, " mm")],
    ["Void rows", `↑${state.voidTopRows} →${state.voidRightRows} ↓${state.voidBottomRows} ←${state.voidLeftRows}`],
    ["Players", data.simulation.playerCount],
    ["Turn", `${data.simulation.currentTurn} / ${data.simulation.turns}`],
    ["Door hold", `${Math.max(1, Math.round(state.doorHoldTurns))} turns`],
    ["Cell caps", activePlayerCaps(data.simulation.playerCount).join(" / ")],
    ["Territory skip", state.territorySkipEnabled ? `from turn ${Math.round(state.territorySkipStartTurn)}` : "off"],
    ["Cluster keep", `${Math.round(state.clusterKeepCount)}+ connected cells`],
    ["Pivot depth", fmt(data.dimensions.pivotDepth, " mm")],
    ["Catwalk width", fmt(data.dimensions.catwalkWidth, " mm")],
    ["Module width", fmt(data.dimensions.moduleWidth, " mm")],
    ["Module remainder", fmt(data.dimensions.moduleRemainder, " mm")],
    ["Empty direction", state.moduleFillDirection],
    ["Total size", fmt(data.dimensions.totalSize, " mm")]
  ]);
  setDl($("countList"), [
    ["Grid cells", data.counts.gridCells],
    ["Void cells", data.counts.voidCells],
    ["Pivot doors", data.counts.pivotDoors],
    ["Open doors", data.counts.openDoors],
    ["Occupied", data.counts.occupiedCells],
    ["Captures", data.counts.captures],
    ["Module cells", data.counts.moduleCells],
    ["Modules / side", data.counts.modulesPerSide],
    ["Module splits", data.counts.moduleSplits],
    ["Module every", `${data.moduleEveryCells} cells`]
  ]);
  $("logOutput").textContent = data.logs.map((line) => `[${new Date().toLocaleTimeString("ko-KR", { hour12: false })}] ${line}`).join("\n");
}

function setDl(node, pairs) {
  clear(node);
  for (const [label, value] of pairs) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    node.append(dt, dd);
  }
}

function makeNote(container, text) {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = text;
  container.appendChild(note);
}

function makeButton(container, id, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = id;
  button.className = "simButton";
  button.textContent = label;
  button.addEventListener("click", onClick);
  container.appendChild(button);
  return button;
}

function makeRange(container, key, label, min, max, step) {
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
    if (key === "simTurns") {
      state.currentTurn = clamp(state.currentTurn, 0, Math.max(0, Math.round(state.simTurns)));
    }
    range.value = state[key];
    num.value = state[key];
    render();
  };
  range.addEventListener("input", () => sync(range.value));
  num.addEventListener("input", () => sync(num.value));
  num.addEventListener("change", () => sync(num.value));
  wrap.append(lab, range, num);
  container.appendChild(wrap);
}

function makeSelect(container, key, label, options) {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const lab = document.createElement("label");
  lab.textContent = label;
  const select = document.createElement("select");
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    option.selected = value === state[key];
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    state[key] = select.value;
    render();
  });
  wrap.append(lab, select);
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
  makeRange($("gridControls"), "gridCount", "N count", 4, 24, 1);
  makeRange($("gridControls"), "cellSize", "Cell size", 750, 3000, 250);

  makeRange($("ringControls"), "pivotDepth", "Pivot depth", 300, 1500, 100);
  makeRange($("ringControls"), "catwalkWidth", "Catwalk", 1000, 12000, 500);
  makeRange($("ringControls"), "moduleMultiple", "Module x", 2, 12, 1);
  makeSelect($("ringControls"), "moduleFillDirection", "Empty side", [
    ["clockwise", "Clockwise remainder"],
    ["counterclockwise", "Counter-clockwise remainder"]
  ]);

  makeNote($("pivotControls"), "Closed by default. Opens only when the adjacent edge grid cell is occupied.");

  makeRange($("simControls"), "playerCount", "Players", 2, 8, 1);
  makeRange($("simControls"), "simTurns", "Turns", 0, 120, 1);
  makeRange($("simControls"), "currentTurn", "Current", 0, 120, 1);
  makeRange($("simControls"), "playSpeed", "Speed", 1, 10, 1);
  const playRow = document.createElement("div");
  playRow.className = "playRow";
  $("simControls").appendChild(playRow);
  makeButton(playRow, "playBtn", "Play", togglePlayback);
  makeButton(playRow, "stepBtn", "Step", stepPlayback);
  makeButton(playRow, "turnResetBtn", "Turn 0", resetPlayback);
  makeRange($("simControls"), "rookProb", "Rook %", 0, 100, 1);
  makeRange($("simControls"), "bishopProb", "Bishop %", 0, 100, 1);
  makeRange($("simControls"), "knightProb", "Knight %", 0, 100, 1);
  makeRange($("simControls"), "attackProb", "Attack %", 0, 100, 1);
  makeRange($("simControls"), "doorHoldTurns", "Door hold", 1, 12, 1);
  makeRange($("simControls"), "overLimitDiscardProb", "Discard %", 0, 100, 1);
  makeToggle($("simControls"), "territorySkipEnabled", "Territory skip");
  makeRange($("simControls"), "territorySkipStartTurn", "Skip from turn", 1, 120, 1);
  makeRange($("simControls"), "clusterKeepCount", "Cluster keep", 2, 40, 1);
  makeNote($("simControls"), "Territory skip ignores safe empty cells after the selected turn. Connected same-player groups at or above Cluster keep are excluded only from cap discards.");
  const capPanel = document.createElement("div");
  capPanel.className = "capPanel";
  $("simControls").appendChild(capPanel);
  for (let i = 1; i <= 8; i += 1) {
    makeRange(capPanel, `player${i}Cap`, `P${i} cap`, 1, 120, 1);
  }

  makeRange($("voidControls"), "voidTopRows", "↑ Top", 0, 24, 1);
  makeRange($("voidControls"), "voidRightRows", "→ Right", 0, 24, 1);
  makeRange($("voidControls"), "voidBottomRows", "↓ Bottom", 0, 24, 1);
  makeRange($("voidControls"), "voidLeftRows", "← Left", 0, 24, 1);

  makeToggle($("displayControls"), "showGrid", "Grid");
  makeToggle($("displayControls"), "showPivot", "Pivot doors");
  makeToggle($("displayControls"), "showCatwalk", "Catwalk");
  makeToggle($("displayControls"), "showModules", "Module structure");
  makeToggle($("displayControls"), "showGuides", "Proportion guides");
}

function buildLegend() {
  const legend = $("legend");
  for (const [label, color] of Object.entries(COLORS)) {
    const item = document.createElement("div");
    item.className = "legendItem";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = color;
    const text = document.createElement("span");
    text.textContent = label;
    item.append(dot, text);
    legend.appendChild(item);
  }
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecording() {
  return Boolean(mediaRecorder && mediaRecorder.state === "recording");
}

function recordingSupported() {
  const canvas = $("recordCanvas");
  return Boolean(
    canvas &&
    typeof canvas.captureStream === "function" &&
    "MediaRecorder" in window
  );
}

function recordingElapsed() {
  if (!recordingStartedAt) return "00:00";
  const total = Math.max(0, Math.floor((performance.now() - recordingStartedAt) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function updateRecordingControls(message = "") {
  const recordButton = $("recordBtn");
  const stopButton = $("recordStopBtn");
  const downloadButton = $("videoDownloadBtn");
  const status = $("recordStatus");
  if (!recordButton || !stopButton || !downloadButton || !status) return;

  const supported = recordingSupported();
  const active = isRecording();
  recordButton.disabled = !supported || active;
  stopButton.disabled = !active;
  downloadButton.disabled = !recordedVideoBlob || active;
  recordButton.classList.toggle("active", active);
  status.textContent = message || (active ? `REC ${recordingElapsed()}` : supported ? "READY" : "UNSUPPORTED");
}

function svgRecordingSource() {
  const svg = $("boardSvg").cloneNode(true);
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("width", "1920");
  svg.setAttribute("height", "984");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const style = document.createElementNS(NS, "style");
  style.textContent = RECORDING_SVG_STYLE;
  svg.insertBefore(style, svg.firstChild);
  return new XMLSerializer().serializeToString(svg);
}

async function paintRecordingFrame() {
  if (recordingPaintPending || !latest) return;
  recordingPaintPending = true;
  const canvas = $("recordCanvas");
  const context = canvas.getContext("2d");
  const footerHeight = 96;
  const boardHeight = canvas.height - footerHeight;
  const svgBlob = new Blob([svgRecordingSource()], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, boardHeight);

    const info = buildRecordingInfo(state);
    context.fillStyle = "#111111";
    context.fillRect(0, boardHeight, canvas.width, footerHeight);
    context.fillStyle = "#ffffff";
    context.font = "600 25px Arial, sans-serif";
    context.fillText(info.primary, 34, boardHeight + 37);
    context.fillStyle = "#cfcfcf";
    context.font = "500 20px Arial, sans-serif";
    context.fillText(info.secondary, 34, boardHeight + 72);
    context.fillStyle = "#ff6192";
    context.fillRect(canvas.width - 170, boardHeight + 24, 10, 48);
    context.fillStyle = "#ffffff";
    context.font = "700 20px Arial, sans-serif";
    context.fillText(`REC ${recordingElapsed()}`, canvas.width - 142, boardHeight + 55);
  } finally {
    URL.revokeObjectURL(url);
    recordingPaintPending = false;
  }
}

async function startRecording() {
  if (!recordingSupported() || isRecording()) return;
  try {
    stopPlayback();
    recordedVideoBlob = null;
    state.currentTurn = 0;
    syncCurrentTurnInputs();
    render();
    await paintRecordingFrame();

    const canvas = $("recordCanvas");
    recordingStream = canvas.captureStream(30);
    const mimeType = chooseRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
    const chunks = [];
    mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType, videoBitsPerSecond: 9000000 } : undefined);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", () => {
      recordedVideoBlob = new Blob(chunks, { type: mimeType || "video/webm" });
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
      mediaRecorder = null;
      recordingStartedAt = 0;
      updateRecordingControls("VIDEO READY");
    }, { once: true });

    recordingStartedAt = performance.now();
    mediaRecorder.start(250);
    recordingClockTimer = window.setInterval(() => {
      updateRecordingControls();
      paintRecordingFrame();
    }, 250);
    updateRecordingControls();
    startPlayback();
  } catch (error) {
    recordingStream?.getTracks().forEach((track) => track.stop());
    recordingStream = null;
    mediaRecorder = null;
    recordingStartedAt = 0;
    updateRecordingControls("RECORD ERROR");
    console.error("Board recording failed:", error);
  }
}

function stopRecording() {
  if (!isRecording()) return;
  stopPlayback();
  if (recordingClockTimer) {
    window.clearInterval(recordingClockTimer);
    recordingClockTimer = null;
  }
  updateRecordingControls("PROCESSING");
  mediaRecorder.stop();
}

function downloadRecording() {
  if (!recordedVideoBlob) return;
  downloadBlob(recordingFilename(), recordedVideoBlob);
}

function exportData() {
  return {
    name: "Base GameBoard",
    inputs: { ...state },
    dimensions: latest.dimensions,
    counts: latest.counts,
    geometry: {
      gridFrame: latest.gridFrame,
      gridCells: latest.gridCells,
      voidCells: latest.voidCells,
      pieces: latest.simulation.pieces,
      pivotDoors: latest.pivotDoors,
      catwalkOuter: latest.catwalkOuter,
      moduleOuter: latest.moduleOuter,
      moduleCells: latest.moduleCells,
      moduleSplits: latest.moduleSplits
    }
  };
}

function setupEvents() {
  $("resetBtn").addEventListener("click", () => {
    stopPlayback();
    Object.assign(state, DEFAULTS);
    for (const id of ["gridControls", "ringControls", "pivotControls", "simControls", "voidControls", "displayControls"]) clear($(id));
    buildControls();
    render();
  });
  $("jsonBtn").addEventListener("click", () => {
    download("base-gameboard.json", JSON.stringify(exportData(), null, 2), "application/json");
  });
  $("svgBtn").addEventListener("click", () => {
    const svg = $("boardSvg").cloneNode(true);
    svg.setAttribute("xmlns", NS);
    download("base-gameboard.svg", new XMLSerializer().serializeToString(svg), "image/svg+xml");
  });
  $("recordBtn").addEventListener("click", startRecording);
  $("recordStopBtn").addEventListener("click", stopRecording);
  $("videoDownloadBtn").addEventListener("click", downloadRecording);
  $("boardSvg").addEventListener("mousemove", (event) => {
    const svg = $("boardSvg");
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = point.matrixTransform(ctm.inverse());
    $("readout").textContent = `X ${fmt(p.x)} / Y ${fmt(-p.y)} mm`;
  });
}

function playbackDelay() {
  return Math.max(70, 1050 - clamp(Number(state.playSpeed) || 1, 1, 10) * 95);
}

function togglePlayback() {
  if (playbackTimer) {
    stopPlayback();
    return;
  }
  startPlayback();
}

function startPlayback() {
  stopPlayback();
  if (state.currentTurn >= state.simTurns) state.currentTurn = 0;
  playbackTimer = window.setInterval(() => {
    if (state.currentTurn >= state.simTurns) {
      stopPlayback();
      if (isRecording()) window.setTimeout(stopRecording, 180);
      return;
    }
    state.currentTurn += 1;
    syncCurrentTurnInputs();
    render();
  }, playbackDelay());
  updatePlaybackButtons();
}

function stopPlayback() {
  if (playbackTimer) {
    window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
  updatePlaybackButtons();
}

function stepPlayback() {
  stopPlayback();
  state.currentTurn = clamp(state.currentTurn + 1, 0, Math.max(0, Math.round(state.simTurns)));
  syncCurrentTurnInputs();
  render();
}

function resetPlayback() {
  stopPlayback();
  state.currentTurn = 0;
  syncCurrentTurnInputs();
  render();
}

function syncCurrentTurnInputs() {
  for (const input of document.querySelectorAll("#simControls input")) {
    const parentLabel = input.parentNode?.querySelector?.("label")?.textContent;
    if (parentLabel === "Current") input.value = state.currentTurn;
  }
}

function updatePlaybackButtons() {
  const play = $("playBtn");
  if (!play) return;
  play.textContent = playbackTimer ? "Pause" : "Play";
  play.classList.toggle("active", Boolean(playbackTimer));
}

buildLegend();
buildControls();
setupEvents();
render();

function cellKey(ix, iy) {
  return `${ix},${iy}`;
}

function parseCellKey(key) {
  const [ix, iy] = key.split(",").map(Number);
  return { ix, iy };
}

function makeRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedMove(rng) {
  const weights = [
    ["rook", Math.max(0, state.rookProb)],
    ["bishop", Math.max(0, state.bishopProb)],
    ["knight", Math.max(0, state.knightProb)]
  ];
  const total = weights.reduce((sum, item) => sum + item[1], 0) || 1;
  let r = rng() * total;
  for (const [name, weight] of weights) {
    r -= weight;
    if (r <= 0) return name;
  }
  return "rook";
}

function activePlayerCaps(playerCount) {
  const result = [];
  for (let i = 1; i <= playerCount; i += 1) {
    result.push(Math.round(state[`player${i}Cap`]));
  }
  return result;
}

function playerKeys(player, occupied) {
  return Array.from(occupied.entries())
    .filter((entry) => entry[1] === player)
    .map((entry) => entry[0]);
}

function claimCell(player, target, occupied, rng, maxCells, originKey, protectedKeys) {
  if (occupied.get(target) === player) return false;
  const owned = playerKeys(player, occupied);
  const alreadyOwned = occupied.get(target) === player;

  if (!alreadyOwned && owned.length >= maxCells) {
    if (rng() >= clamp(state.overLimitDiscardProb, 0, 100) / 100) {
      return false;
    }
    const discardPool = owned.filter((key) => key !== originKey && !protectedKeys.has(key));
    if (discardPool.length === 0) return false;
    const discard = discardPool.length > 0
      ? discardPool[Math.floor(rng() * discardPool.length)]
      : null;
    if (discard == null) return false;
    occupied.delete(discard);
  }

  occupied.set(target, player);
  return true;
}

function runSimulation(gridCount, playableCells, cellSize, halfGrid) {
  const playable = new Map(playableCells.map((cell) => [cellKey(cell.ix, cell.iy), cell]));
  const occupied = new Map();
  const playerCount = clamp(Math.round(state.playerCount), 2, Math.min(8, Math.max(2, playable.size)));
  const turns = Math.max(0, Math.round(state.simTurns));
  const maxCellsForPlayer = (player) => clamp(Math.round(state[`player${player + 1}Cap`]), 1, Math.max(1, playable.size));
  const rng = makeRng(
    gridCount * 73856093 ^
    Math.round(cellSize) * 19349663 ^
    playerCount * 83492791 ^
    turns * 2654435761
  );

  const seeds = chooseSeedCells(playerCount, playableCells, halfGrid, rng);
  seeds.forEach((cell, player) => {
    occupied.set(cellKey(cell.ix, cell.iy), player);
  });

  let captures = 0;
  const history = [{ occupied: new Map(occupied), captures }];

  for (let turn = 0; turn < turns; turn += 1) {
    const protectedKeys = protectedCellKeys(occupied, history, turn);
    for (let player = 0; player < playerCount; player += 1) {
      const origins = shuffle(
        Array.from(occupied.entries())
          .filter((entry) => entry[1] === player)
          .map((entry) => entry[0]),
        rng
      );

      for (const originKey of origins) {
        if (occupied.get(originKey) !== player) continue;
        const origin = parseCellKey(originKey);
        const allCandidates = [
          ...moveCandidates("rook", origin, gridCount, playable),
          ...moveCandidates("bishop", origin, gridCount, playable),
          ...moveCandidates("knight", origin, gridCount, playable)
        ];
        const opponentTargets = uniqueKeys(allCandidates)
          .filter((key) => canCaptureTarget(key, player, occupied, gridCount));

        if (opponentTargets.length > 0 && rng() < state.attackProb / 100) {
          const target = opponentTargets[Math.floor(rng() * opponentTargets.length)];
          if (claimCell(player, target, occupied, rng, maxCellsForPlayer(player), originKey, protectedKeys)) {
            captures += 1;
          }
          continue;
        }

        const mode = weightedMove(rng);
        const candidates = moveCandidates(mode, origin, gridCount, playable)
          .filter((key) => !occupied.has(key))
          .filter((key) => !shouldSkipTerritoryCandidate(key, player, occupied, {
            enabled: state.territorySkipEnabled,
            turn: turn + 1,
            startTurn: Math.max(1, Math.round(state.territorySkipStartTurn))
          }));
        if (candidates.length === 0) continue;
        const target = candidates[Math.floor(rng() * candidates.length)];
        claimCell(player, target, occupied, rng, maxCellsForPlayer(player), originKey, protectedKeys);
      }
    }
    history.push({ occupied: new Map(occupied), captures });
  }

  const currentTurn = clamp(Math.round(state.currentTurn), 0, turns);
  const snapshot = history[currentTurn] || history[history.length - 1];
  const currentOccupied = new Map(snapshot.occupied);
  const pieces = Array.from(currentOccupied.entries()).map(([key, player]) => {
    const cell = playable.get(key);
    return { key: `PLAYER_${player}_${key}`, player, rect: cell };
  });

  return {
    playerCount,
    turns,
    currentTurn,
    occupied: currentOccupied,
    pieces,
    captures: snapshot.captures,
    totalCaptures: captures,
    seeds,
    history
  };
}

function chooseSeedCells(playerCount, playableCells, halfGrid, rng) {
  const seeds = [];
  const targetRadius = halfGrid * 0.5;
  for (let player = 0; player < playerCount; player += 1) {
    const angle = (Math.PI * 2 * player) / playerCount;
    const target = { x: Math.cos(angle) * targetRadius, y: Math.sin(angle) * targetRadius };
    const sorted = playableCells
      .filter((cell) => !seeds.includes(cell))
      .map((cell) => {
        const cx = (cell.minX + cell.maxX) * 0.5;
        const cy = (cell.minY + cell.maxY) * 0.5;
        return { cell, d: Math.hypot(cx - target.x, cy - target.y) + rng() * 0.001 };
      })
      .sort((a, b) => a.d - b.d);
    if (sorted.length > 0) seeds.push(sorted[0].cell);
  }
  return seeds;
}

function moveCandidates(mode, origin, gridCount, playable) {
  const candidates = [];
  const dirs = {
    rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    knight: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
  };

  if (mode === "knight") {
    for (const [dx, dy] of dirs.knight) {
      const key = cellKey(origin.ix + dx, origin.iy + dy);
      if (playable.has(key)) candidates.push(key);
    }
    return candidates.slice(0, 8);
  }

  for (let step = 1; step < gridCount; step += 1) {
    for (const [dx, dy] of dirs[mode]) {
      const key = cellKey(origin.ix + dx * step, origin.iy + dy * step);
      if (playable.has(key)) candidates.push(key);
    }
    if (candidates.length >= 8) break;
  }
  return candidates.slice(0, mode === "rook" || mode === "bishop" ? 12 : 8);
}

function uniqueKeys(items) {
  return Array.from(new Set(items));
}

function rookDistance(a, b) {
  if (a.ix !== b.ix && a.iy !== b.iy) return Infinity;
  return Math.abs(a.ix - b.ix) + Math.abs(a.iy - b.iy);
}

function hasLineOfSight(attacker, target, targetOwner, occupied) {
  if (attacker.ix !== target.ix && attacker.iy !== target.iy) return false;
  const dx = Math.sign(target.ix - attacker.ix);
  const dy = Math.sign(target.iy - attacker.iy);
  let ix = attacker.ix + dx;
  let iy = attacker.iy + dy;
  while (ix !== target.ix || iy !== target.iy) {
    const key = cellKey(ix, iy);
    if (occupied.get(key) === targetOwner) return false;
    ix += dx;
    iy += dy;
  }
  return true;
}

function nearestOwnerRookDistance(target, owner, occupied, excludeKey = null) {
  let best = Infinity;
  for (const [key, player] of occupied.entries()) {
    if (player !== owner || key === excludeKey) continue;
    const d = rookDistance(parseCellKey(key), target);
    if (d < best) best = d;
  }
  return best;
}

function canCaptureTarget(targetKey, attackerPlayer, occupied) {
  const targetOwner = occupied.get(targetKey);
  if (targetOwner == null || targetOwner === attackerPlayer) return false;
  const target = parseCellKey(targetKey);
  const defenderDistance = nearestOwnerRookDistance(target, targetOwner, occupied, targetKey);
  const defenderLimit = Number.isFinite(defenderDistance) ? defenderDistance : Infinity;

  for (const key of playerKeys(attackerPlayer, occupied)) {
    const attacker = parseCellKey(key);
    const distance = rookDistance(attacker, target);
    if (!Number.isFinite(distance)) continue;
    if (distance > defenderLimit) continue;
    if (!hasLineOfSight(attacker, target, targetOwner, occupied)) continue;
    return true;
  }

  return false;
}

function protectedCellKeys(occupied, history, currentTurn) {
  const protectedKeys = new Set();
  const requiredHold = Math.max(1, Math.round(state.doorHoldTurns));

  for (const key of occupied.keys()) {
    if (doorHoldInfo(key, history, currentTurn).turns >= requiredHold) {
      protectedKeys.add(key);
    }
  }

  const clusterKeys = connectedGroupsAtLeast(occupied, state.clusterKeepCount);
  for (const key of clusterKeys) protectedKeys.add(key);

  return protectedKeys;
}

function doorHoldInfo(edgeKey, history, currentTurn) {
  let turns = 0;
  let player = null;
  for (let t = currentTurn; t >= 0; t -= 1) {
    const owner = history[t]?.occupied.get(edgeKey);
    if (owner == null) break;
    if (player == null) player = owner;
    if (owner !== player) break;
    turns += 1;
  }
  return { turns, player };
}

function edgeCellKeyForDoor(door, gridCount) {
  if (door.side === "top") return cellKey(door.index, gridCount - 1);
  if (door.side === "bottom") return cellKey(door.index, 0);
  if (door.side === "left") return cellKey(0, door.index);
  return cellKey(gridCount - 1, door.index);
}
