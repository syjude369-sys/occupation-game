import { canonicalPattern, evaluateState } from "./form-metrics.js";
import { aggregateRuns, createSeededRandom, generateCandidate } from "./form-search.js";
import { simulateCheckpoints } from "./form-simulation.js";
import { CELL, findMotifMatches, findPatternOccurrences } from "./motif-engine.js";
import {
  activeMotifFitness,
  classifyVoidStructure,
  computePatternScore,
  extractRegionMotifs,
  extractSlidingWindows,
  mergeDiscoveredPatterns,
  suppressNestedOccurrences,
  trackTemporalEpisodes
} from "./pattern-engine.js";
import { dynamicParetoFront, nextGeneration } from "./evolution.js";
import { STORAGE_KEY, defaultLabState, normalizeLabState, serializeLabState } from "./storage.js";

const COLORS = ["#00a9f4", "#ff6192", "#111111", "#7d5cff", "#00b894", "#ff9f1c", "#e84393", "#6c5ce7"];
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
let lab = loadState();
let stopped = false;
let motifOverlayEnabled = true;
let patternOverlayEnabled = true;
let selectedPatternSignature = null;
let selectedPatternBoard = null;
let selectedPatternSource = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLabState();
    const normalized = normalizeLabState(JSON.parse(raw));
    if (normalized.recovered) setTimeout(() => alert("Saved data could not be loaded. Safe defaults are active."), 0);
    return normalized.state;
  } catch {
    return defaultLabState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, serializeLabState(lab));
  $("saveStatus").textContent = `Saved ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`;
}

function inputNumber(id, min, max) {
  return Math.max(min, Math.min(max, Number($(id).value) || min));
}

function syncInputsFromState() {
  const map = {
    sizeInput: "size", playersInput: "players", turnsInput: "turns", capInput: "cellCap",
    generationSizeInput: "generationSize", seedsInput: "seeds", masterSeedInput: "masterSeed"
  };
  for (const [id, key] of Object.entries(map)) $(id).value = lab.settings[key];
  $("patternIntervalInput").value = lab.patternSettings.patternSearchIntervalTurns;
  $("minOccupancyInput").value = lab.patternSettings.minOccupancyRatio;
  $("maxOccupancyInput").value = lab.patternSettings.maxOccupancyRatio;
  $("maxRegionAreaInput").value = lab.patternSettings.maxRegionArea;
  $("slidingDiscoveryInput").checked = lab.patternSettings.discovery.slidingWindow;
  $("regionDiscoveryInput").checked = lab.patternSettings.discovery.regionBased;
  $("recurrenceWeightInput").value = lab.patternSettings.scoreWeights.recurrence;
  $("distinctivenessWeightInput").value = lab.patternSettings.scoreWeights.distinctiveness;
  $("symmetryWeightInput").value = lab.patternSettings.scoreWeights.symmetry;
  $("voidWeightInput").value = lab.patternSettings.scoreWeights.void;
  renderObjectives();
  updateOccupancyWarning();
}

function readSettings() {
  Object.assign(lab.settings, {
    size: Math.round(inputNumber("sizeInput", 4, 31)),
    players: Math.round(inputNumber("playersInput", 2, 8)),
    turns: Math.round(inputNumber("turnsInput", 1, 200)),
    cellCap: Math.round(inputNumber("capInput", 1, 400)),
    generationSize: Math.round(inputNumber("generationSizeInput", 2, 100)),
    seeds: Math.round(inputNumber("seedsInput", 2, 30)),
    masterSeed: Math.round(inputNumber("masterSeedInput", 1, 99999999))
  });
  Object.assign(lab.patternSettings, {
    patternSearchIntervalTurns: Math.round(inputNumber("patternIntervalInput", 1, 50)),
    minOccupancyRatio: inputNumber("minOccupancyInput", 0, 1),
    maxOccupancyRatio: inputNumber("maxOccupancyInput", 0, 1),
    maxRegionArea: Math.round(inputNumber("maxRegionAreaInput", 4, 400)),
    discovery: {
      slidingWindow: $("slidingDiscoveryInput").checked,
      regionBased: $("regionDiscoveryInput").checked
    },
    scoreWeights: {
      recurrence: inputNumber("recurrenceWeightInput", 0, 5),
      distinctiveness: inputNumber("distinctivenessWeightInput", 0, 5),
      symmetry: inputNumber("symmetryWeightInput", 0, 5),
      void: inputNumber("voidWeightInput", 0, 5)
    }
  });
  if (lab.patternSettings.maxOccupancyRatio < lab.patternSettings.minOccupancyRatio) {
    lab.patternSettings.maxOccupancyRatio = lab.patternSettings.minOccupancyRatio;
  }
  updateOccupancyWarning();
  saveState();
}

function updateOccupancyWarning() {
  const full = lab.settings.players * lab.settings.cellCap;
  const total = lab.settings.size ** 2;
  $("occupancyWarning").hidden = full < total;
  $("occupancyWarning").textContent = `Maximum occupancy ${full}/${total}: no guaranteed empty space.`;
}

function renderObjectives() {
  const node = $("objectiveControls");
  node.replaceChildren();
  for (const objective of lab.objectives) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = objective.enabled;
    input.addEventListener("change", () => {
      objective.enabled = input.checked;
      saveState();
      renderArchive();
    });
    label.append(input, objective.name);
    node.appendChild(label);
  }
}

function occupancyBoard(state) {
  return { size: state.size, cells: state.cells.map((value) => value >= 0 ? 1 : 0) };
}

function isPatternOccupiedCell(value) {
  return value === "O" || value === CELL.REQUIRED || value === CELL.OPTIONAL;
}

function isPatternEmptyCell(value) {
  return value === "E" || value === CELL.EMPTY;
}

function usesLegacyMotifCells(pattern) {
  return pattern.cells?.some((cell) => typeof cell === "number");
}

function patternKey(pattern) {
  return pattern?.signature || pattern?.id || null;
}

function displayPatternOccurrences(board, pattern) {
  if (usesLegacyMotifCells(pattern)) {
    return findMotifMatches(board, [{ ...pattern, enabled: true }]).map((match) => ({
      ...match,
      patternWidth: pattern.width,
      patternHeight: pattern.height
    }));
  }
  return findPatternOccurrences(board, pattern);
}

function discoverCheckpointPatterns(binary, sourceState, meta) {
  const settings = lab.patternSettings;
  const candidates = [];
  if (settings.discovery.slidingWindow) {
    candidates.push(...extractSlidingWindows(binary, {
      windowSizes: settings.windowSizes,
      minOccupancyRatio: settings.minOccupancyRatio,
      maxOccupancyRatio: settings.maxOccupancyRatio
    }));
  }
  if (settings.discovery.regionBased) {
    candidates.push(...extractRegionMotifs(binary, { maxRegionArea: settings.maxRegionArea }));
  }
  return suppressNestedOccurrences(candidates).map((pattern) => {
    const enriched = {
      ...pattern,
      ...meta,
      representativeBoard: structuredClone(sourceState),
      voidStructure: classifyVoidStructure(pattern, binary),
      recurrence: { score: 0 },
      distinctiveness: { score: pattern.externallyAccessible ? 0.5 : 0 }
    };
    return { ...enriched, ...computePatternScore(enriched, settings.scoreWeights) };
  });
}

function evaluateCandidate(params, id, parentIds, generation) {
  const runs = [];
  let discoveries = [];
  for (let seedIndex = 0; seedIndex < lab.settings.seeds; seedIndex += 1) {
    const seed = (lab.settings.masterSeed + generation * 1000003 + seedIndex * 9176 + id.length * 101) >>> 0;
    const checkpoints = simulateCheckpoints({ ...lab.settings, ...params }, seed, {
      interval: lab.patternSettings.patternSearchIntervalTurns
    });
    const state = checkpoints.at(-1).state;
    const spatial = evaluateState(state, lab.settings.players);
    const runId = `${id}-seed-${seedIndex}`;
    const checkpointPatterns = checkpoints.flatMap((checkpoint, checkpointIndex) =>
      discoverCheckpointPatterns(occupancyBoard(checkpoint.state), checkpoint.state, {
        runId,
        seed,
        seedIndex,
        genomeId: id,
        turn: checkpoint.turn,
        checkpointIndex
      })
    ).filter((pattern) => !lab.ignoredSignatures.includes(pattern.signature));
    const episodes = trackTemporalEpisodes(checkpointPatterns);
    discoveries = mergeDiscoveredPatterns(discoveries, checkpointPatterns.map((pattern) => ({
      ...pattern,
      ...(episodes.find((item) => item.signature === pattern.signature) || {})
    })));
    runs.push({
      state,
      pattern: canonicalPattern(state),
      metrics: { ...spatial, activePatternFitness: activeMotifFitness(lab.motifs) }
    });
  }
  const aggregate = aggregateRuns(runs);
  aggregate.objectives.activePatternFitness = runs.reduce((sum, run) => sum + run.metrics.activePatternFitness, 0) / runs.length;
  return {
    id,
    generation,
    parentIds,
    params,
    seedCount: lab.settings.seeds,
    pinned: false,
    excluded: false,
    discoveries,
    ...aggregate
  };
}

async function runGeneration() {
  readSettings();
  stopped = false;
  setRunning(true);
  const generation = lab.generation;
  const runId = Date.now().toString(36);
  const random = createSeededRandom(lab.settings.masterSeed + generation * 997);
  const genomes = generation === 0 || !lab.archive.length
    ? Array.from({ length: lab.settings.generationSize }, (_, index) => ({
        id: `g${generation}-random-${index}`,
        generation,
        parentIds: [],
        params: generateCandidate(random)
      }))
    : nextGeneration(lab.archive, lab.objectives, {
        generation,
        size: lab.settings.generationSize,
        eliteCount: 2,
        freshRate: 0.15,
        mutationStrength: 12,
        seed: lab.settings.masterSeed + generation
      });

  $("progress").max = genomes.length;
  $("progress").value = 0;
  for (let index = 0; index < genomes.length; index += 1) {
    if (stopped) break;
    const genome = genomes[index];
    const candidate = evaluateCandidate(genome.params, `${genome.id}-${runId}-${index}`, genome.parentIds, generation);
    candidate.discoveries = candidate.discoveries.map((pattern) => ({ ...pattern, archiveCandidateId: candidate.id }));
    lab.archive.push(candidate);
    mergeDiscoveries(candidate.discoveries);
    $("progress").value = index + 1;
    $("progressLabel").textContent = `${index + 1}/${genomes.length}`;
    renderAll();
    saveState();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!stopped) lab.generation += 1;
  setRunning(false);
  $("progressLabel").textContent = stopped ? "STOPPED" : "COMPLETE";
  saveState();
  renderAll();
}

function mergeDiscoveries(items) {
  lab.discovered = mergeDiscoveredPatterns(lab.discovered, items);
  lab.discovered = lab.discovered.slice(0, 300);
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${tabName}View`));
}

function patternWithSource(pattern) {
  const discovered = lab.discovered.find((item) =>
    pattern.signature && item.signature === pattern.signature && (item.archiveCandidateId || item.representativeBoard)
  );
  const archiveHasPattern = (candidate) =>
    candidate?.representative && displayPatternOccurrences(occupancyBoard(candidate.representative), pattern).length;
  const storedArchiveId = pattern.archiveCandidateId || discovered?.archiveCandidateId;
  const storedArchive = lab.archive.find((candidate) => candidate.id === storedArchiveId);
  const visibleArchive = archiveHasPattern(storedArchive)
    ? storedArchive
    : lab.archive.find(archiveHasPattern);
  return {
    ...pattern,
    archiveCandidateId: visibleArchive?.id || storedArchiveId,
    representativeBoard: pattern.representativeBoard || discovered?.representativeBoard,
    originX: Number.isFinite(pattern.originX) ? pattern.originX : discovered?.originX,
    originY: Number.isFinite(pattern.originY) ? pattern.originY : discovered?.originY
  };
}

function showPatternSource(pattern) {
  const source = patternWithSource(pattern);
  Object.assign(pattern, source);
  selectedPatternSignature = patternKey(source);
  selectedPatternSource = source;
  if (source.archiveCandidateId) lab.selectedCandidateId = source.archiveCandidateId;
  const archive = source.archiveCandidateId ? lab.archive.find((candidate) => candidate.id === source.archiveCandidateId) : null;
  const archiveHasPattern = archive?.representative &&
    displayPatternOccurrences(occupancyBoard(archive.representative), source).length > 0;
  selectedPatternBoard = archiveHasPattern ? null : source.representativeBoard || null;
  if (motifOverlayEnabled) {
    patternOverlayEnabled = true;
    $("patternOverlayInput").checked = true;
  } else {
    patternOverlayEnabled = false;
    $("patternOverlayInput").checked = false;
  }
  setActiveTab("archive");
  saveState();
  renderAll();
}

function setRunning(value) {
  $("runGenerationBtn").disabled = value;
  $("stopBtn").disabled = !value;
}

function svgEl(tag, attrs, parent) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  parent.appendChild(element);
  return element;
}

function renderBoard(candidate) {
  const svg = $("boardSvg");
  svg.replaceChildren();
  if (!candidate?.representative) {
    $("emptyBoard").hidden = false;
    return;
  }
  $("emptyBoard").hidden = true;
  const board = candidate.representative;
  const gap = 40;
  const size = 920 / board.size;
  svgEl("rect", { x: gap, y: gap, width: 920, height: 920, fill: "#fff", stroke: "#111", "stroke-width": 2 }, svg);
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size; x += 1) {
      const owner = board.cells[y * board.size + x];
      svgEl("rect", {
        x: gap + x * size, y: gap + y * size, width: size, height: size,
        fill: owner < 0 ? "#fff" : COLORS[owner % COLORS.length], class: "boardCell"
      }, svg);
    }
  }
  renderMotifOverlay(svg, board, gap, size);
  renderPatternOverlay(svg, board, gap, size);
}

function renderMotifOverlay(svg, board, gap, cellSize) {
  if (!motifOverlayEnabled) return;
  const activePatterns = lab.motifs.filter((motif) => motif.fitnessActive);
  const matches = activePatterns.flatMap((motif) => displayPatternOccurrences(occupancyBoard(board), motif));
  matches.forEach((match, matchIndex) => {
    for (const key of match.occupiedKeys) {
      const [x, y] = key.split(",").map(Number);
      svgEl("rect", {
        x: gap + x * cellSize + 6,
        y: gap + y * cellSize + 6,
        width: Math.max(1, cellSize - 12),
        height: Math.max(1, cellSize - 12),
        class: "motifOverlayCell",
        "data-match": matchIndex,
        "data-motif": match.motifId
      }, svg);
    }
  });
}

function renderPatternOverlay(svg, board, gap, cellSize) {
  if (!patternOverlayEnabled || !selectedPatternSignature) return;
  const pattern = patternKey(selectedPatternSource) === selectedPatternSignature
    ? selectedPatternSource
    : [...lab.motifs, ...lab.discovered].find((item) => patternKey(item) === selectedPatternSignature);
  if (!pattern) return;
  const placements = selectedPatternBoard && pattern.representativeBoard && Number.isFinite(pattern.originX) && Number.isFinite(pattern.originY)
    ? [{
        originX: pattern.originX,
        originY: pattern.originY,
        patternWidth: pattern.width,
        patternHeight: pattern.height,
        occupiedKeys: pattern.cells.flatMap((cell, index) => isPatternOccupiedCell(cell)
          ? [`${pattern.originX + index % pattern.width},${pattern.originY + Math.floor(index / pattern.width)}`]
          : [])
      }]
    : displayPatternOccurrences(occupancyBoard(board), pattern);
  placements.forEach((match, matchIndex) => {
    svgEl("rect", {
      x: gap + match.originX * cellSize + 2,
      y: gap + match.originY * cellSize + 2,
      width: match.patternWidth * cellSize - 4,
      height: match.patternHeight * cellSize - 4,
      fill: "none",
      stroke: "#ff6192",
      "stroke-width": 3,
      "stroke-dasharray": "8 5"
    }, svg);
    for (let py = 0; py < pattern.height; py += 1) {
      for (let px = 0; px < pattern.width; px += 1) {
        if (!isPatternEmptyCell(pattern.cells[py * pattern.width + px])) continue;
        svgEl("rect", {
          x: gap + (match.originX + px) * cellSize + cellSize * 0.28,
          y: gap + (match.originY + py) * cellSize + cellSize * 0.28,
          width: cellSize * 0.44,
          height: cellSize * 0.44,
          fill: "#fff",
          stroke: "#ff6192",
          "stroke-width": 2
        }, svg);
      }
    }
    for (const key of match.occupiedKeys) {
      const [x, y] = key.split(",").map(Number);
      svgEl("rect", {
        x: gap + x * cellSize + 3,
        y: gap + y * cellSize + 3,
        width: Math.max(1, cellSize - 6),
        height: Math.max(1, cellSize - 6),
        class: "patternOverlayCell",
        "data-match": matchIndex
      }, svg);
    }
    svgEl("text", {
      x: gap + (match.originX + (match.patternWidth - 1) / 2) * cellSize + cellSize * 0.5,
      y: gap + (match.originY + (match.patternHeight - 1) / 2) * cellSize + cellSize * 0.5,
      class: "patternOverlayLabel"
    }, svg).textContent = String(matchIndex + 1);
  });
}

function selectedCandidate() {
  return lab.archive.find((item) => item.id === lab.selectedCandidateId);
}

function selectCandidate(id) {
  lab.selectedCandidateId = id;
  selectedPatternBoard = null;
  saveState();
  renderAll();
}

function renderMetrics(candidate) {
  const strip = $("metricStrip");
  strip.replaceChildren();
  for (const objective of lab.objectives) {
    const span = document.createElement("span");
    span.textContent = `${objective.name} ${candidate ? Number(candidate.objectives[objective.id] ?? 0).toFixed(3) : "—"}`;
    strip.appendChild(span);
  }
}

function activeArchive() {
  return dynamicParetoFront(lab.archive, lab.objectives).sort((a, b) => b.generation - a.generation);
}

function renderArchive() {
  const node = $("archiveList");
  node.replaceChildren();
  const frontier = activeArchive();
  const selected = lab.archive.find((item) => item.id === lab.selectedCandidateId);
  const visibleArchive = selected && !frontier.some((item) => item.id === selected.id)
    ? [selected, ...frontier]
    : frontier;
  $("archiveCount").textContent = `${frontier.length} Pareto / ${lab.archive.length} total${visibleArchive.length !== frontier.length ? " · source shown" : ""}`;
  for (const item of visibleArchive) {
    const card = document.createElement("article");
    card.className = `card ${item.id === lab.selectedCandidateId ? "selected" : ""}`;
    card.innerHTML = `<h3>G${item.generation} · ${item.id}</h3>
      <div class="small">R ${item.params.rook.toFixed(1)} · B ${item.params.bishop.toFixed(1)} · N ${item.params.knight.toFixed(1)} · A ${item.params.attack.toFixed(1)}</div>
      <div class="scoreGrid">${lab.objectives.map((o) => `<span>${o.name.slice(0,3)} ${Number(item.objectives[o.id] ?? 0).toFixed(2)}</span>`).join("")}</div>
      <div class="small">${item.topCount}/${item.seedCount} repeats · parents ${item.parentIds.join(", ") || "random"}</div>`;
    const actions = document.createElement("div");
    actions.className = "cardActions";
    const select = button("View", () => selectCandidate(item.id));
    const pin = button(item.pinned ? "Unpin" : "Pin parent", () => { item.pinned = !item.pinned; saveState(); renderArchive(); });
    const exclude = button(item.excluded ? "Include" : "Exclude", () => { item.excluded = !item.excluded; saveState(); renderArchive(); });
    actions.append(select, pin, exclude);
    card.appendChild(actions);
    node.appendChild(card);
  }
}

function button(text, handler) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.addEventListener("click", handler);
  return element;
}

function patternContinuityText(pattern) {
  const testCount = Array.isArray(pattern.runs) && pattern.runs.length
    ? pattern.runs.length
    : Array.isArray(pattern.seeds) ? pattern.seeds.length : 0;
  const first = Number.isFinite(pattern.firstSeenTurn) ? pattern.firstSeenTurn : null;
  const last = Number.isFinite(pattern.lastSeenTurn) ? pattern.lastSeenTurn : null;
  const turnRange = first == null || last == null ? "turns n/a" : first === last ? `turn ${first}` : `turns ${first}-${last}`;
  return `tests ${testCount || "n/a"} · ${turnRange} · duration ${pattern.durationSteps || 0}`;
}

function preview(pattern) {
  const box = document.createElement("div");
  box.className = "patternPreview";
  box.style.gridTemplateColumns = `repeat(${pattern.width},1fr)`;
  box.style.aspectRatio = `${pattern.width}/${pattern.height}`;
  for (const value of pattern.cells) {
    const cell = document.createElement("i");
    cell.className = value === CELL.REQUIRED || value === 1 || value === "O" ? "on" : "";
    box.appendChild(cell);
  }
  return box;
}

function renderMotifs() {
  const node = $("motifList");
  node.replaceChildren();
  for (const motif of lab.motifs) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${motif.name || "Promoted motif"}</h3><div class="small">${(motif.methods || []).join(" + ")} · score ${Number(motif.totalMotifScore || 0).toFixed(2)}</div><div class="small">${patternContinuityText(motif)}</div>`;
    card.appendChild(preview(motif));
    const controls = document.createElement("div");
    controls.className = "cardActions";
    const show = button("Show", () => showPatternSource(motif));
    const enabled = button(motif.fitnessActive ? "Fitness Off" : "Fitness Active", () => { motif.fitnessActive = !motif.fitnessActive; saveState(); renderMotifs(); renderArchive(); });
    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.min = "0";
    weightInput.max = "5";
    weightInput.step = "0.1";
    weightInput.value = motif.fitnessWeight ?? 1;
    weightInput.title = "Fitness weight";
    weightInput.addEventListener("change", () => {
      motif.fitnessWeight = Math.max(0, Math.min(5, Number(weightInput.value) || 0));
      weightInput.value = motif.fitnessWeight;
      saveState();
      renderArchive();
    });
    const weightLabel = document.createElement("label");
    weightLabel.className = "fitnessWeight";
    weightLabel.append("Weight ", weightInput);
    const remove = button("Delete", () => {
      if (!confirm(`Delete ${motif.name || "promoted motif"}?`)) return;
      lab.motifs = lab.motifs.filter((item) => item.id !== motif.id);
      saveState(); renderMotifs();
    });
    const openFurniture = button("→ Furniture", () => {
      const data = { id: motif.id, name: motif.name || "Promoted motif",
        width: motif.width, height: motif.height, cells: motif.cells, cellSizeMm: 1500 };
      const params = new URLSearchParams({ motif: JSON.stringify(data) });
      window.open("./furniture-lab.html?" + params.toString(), "_blank");
    });
    openFurniture.style.background = "#2a3a2a";
    openFurniture.style.borderColor = "#5DC5A4";
    openFurniture.style.color = "#5DC5A4";
    controls.append(show, enabled, weightLabel, openFurniture, remove);
    card.append(controls, Object.assign(document.createElement("div"), { className: "small", textContent: `Fitness weight ${motif.fitnessWeight ?? 1} · episodes ${motif.episodeCount || 0} · detections ${motif.detectionCount || 0} · furniture ${motif.furniture?.status || "not_tested"}` }));
    node.appendChild(card);
  }
}

function renderDiscovered() {
  const node = $("discoveredList");
  node.replaceChildren();
  $("discoveredCount").textContent = `${lab.discovered.length} sampled`;
  for (const pattern of lab.discovered.slice(0, 100)) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${pattern.occupiedCount} occupied / ${pattern.width}×${pattern.height}</h3><div class="small">${(pattern.methods || []).join(" + ")} · episodes ${pattern.episodeCount || 0} · detections ${pattern.detectionCount || 0} · score ${Number(pattern.totalMotifScore || 0).toFixed(2)}</div><div class="small">${patternContinuityText(pattern)}</div>`;
    card.appendChild(preview(pattern));
    const actions = document.createElement("div");
    actions.className = "cardActions";
    actions.append(
      button("Show", () => showPatternSource(pattern)),
      button("Promote", () => promotePattern(pattern)),
      button("Ignore", () => {
        lab.ignoredSignatures.push(pattern.signature);
        lab.discovered = lab.discovered.filter((item) => item.signature !== pattern.signature);
        saveState(); renderDiscovered();
      })
    );
    card.appendChild(actions);
    node.appendChild(card);
  }
}

function promotePattern(pattern) {
  const existing = lab.motifs.find((item) => item.signature === pattern.signature);
  if (existing) {
    Object.assign(existing, {
      archiveCandidateId: existing.archiveCandidateId || pattern.archiveCandidateId,
      representativeBoard: existing.representativeBoard || pattern.representativeBoard,
      originX: Number.isFinite(existing.originX) ? existing.originX : pattern.originX,
      originY: Number.isFinite(existing.originY) ? existing.originY : pattern.originY
    });
    saveState();
    renderMotifs();
    return;
  }
  lab.motifs.push({
    ...structuredClone(pattern),
    id: `motif-${Date.now()}`,
    name: `Pattern ${lab.motifs.length + 1}`,
    fitnessActive: false,
    fitnessWeight: 1
  });
  saveState();
  renderMotifs();
}

function renderAll() {
  $("generationLabel").textContent = `Next generation ${lab.generation}`;
  const candidate = selectedCandidate() || activeArchive()[0];
  if (candidate && !lab.selectedCandidateId) lab.selectedCandidateId = candidate.id;
  const boardSource = selectedPatternBoard ? { representative: selectedPatternBoard } : candidate;
  renderBoard(boardSource);
  renderMetrics(candidate);
  $("candidateMeta").textContent = selectedPatternBoard
    ? "Archive discovery checkpoint board"
    : candidate ? `G${candidate.generation} · R ${candidate.params.rook.toFixed(1)} B ${candidate.params.bishop.toFixed(1)} N ${candidate.params.knight.toFixed(1)} A ${candidate.params.attack.toFixed(1)}` : "Select or generate a candidate.";
  renderArchive();
  renderMotifs();
  renderDiscovered();
}

function exportProject() {
  const blob = new Blob([serializeLabState(lab)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pattern-engine-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

for (const input of document.querySelectorAll(".sidebar input[type=number]")) input.addEventListener("change", readSettings);
$("runGenerationBtn").addEventListener("click", runGeneration);
$("stopBtn").addEventListener("click", () => { stopped = true; });
$("exportBtn").addEventListener("click", exportProject);
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async () => {
  const file = $("importFile").files[0];
  if (!file) return;
  try {
    const normalized = normalizeLabState(JSON.parse(await file.text()));
    lab = normalized.state;
    saveState(); syncInputsFromState(); renderAll();
    if (normalized.recovered) alert("The file was incompatible. Safe defaults were loaded.");
  } catch {
    alert("This JSON file could not be imported.");
  }
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset all Motif Lab data?")) return;
  lab = defaultLabState();
  saveState(); syncInputsFromState(); renderAll();
});
document.querySelectorAll(".tabs button").forEach((tab) => tab.addEventListener("click", () => {
  setActiveTab(tab.dataset.tab);
}));
$("patternOverlayInput").addEventListener("change", () => {
  patternOverlayEnabled = $("patternOverlayInput").checked;
  renderBoard(selectedCandidate() || activeArchive()[0]);
});
$("motifOverlayInput").addEventListener("change", () => {
  motifOverlayEnabled = $("motifOverlayInput").checked;
  renderBoard(selectedCandidate() || activeArchive()[0]);
});

syncInputsFromState();
renderAll();
