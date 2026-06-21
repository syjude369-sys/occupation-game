import { canonicalPattern, evaluateState } from "./form-metrics.js";
import { aggregateRuns, createSeededRandom, generateCandidate } from "./form-search.js";
import { simulateFinalState } from "./form-simulation.js";
import { CELL, allocateMatches, discoverPatterns, findMotifMatches, findPatternOccurrences, motifFitness, selectedMotifOccurrences } from "./motif-engine.js";
import { dynamicParetoFront, nextGeneration } from "./evolution.js";
import { STORAGE_KEY, defaultLabState, normalizeLabState, serializeLabState } from "./storage.js";

const COLORS = ["#00a9f4", "#ff6192", "#111111", "#7d5cff", "#00b894", "#ff9f1c", "#e84393", "#6c5ce7"];
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
let lab = loadState();
let stopped = false;
let editorMotif = null;
let editorTool = CELL.REQUIRED;
let painting = false;
let motifOverlayEnabled = true;
let patternOverlayEnabled = true;
let selectedPatternSignature = null;

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
    generationSizeInput: "generationSize", seedsInput: "seeds", masterSeedInput: "masterSeed",
    minPatternInput: "minPatternSize", maxPatternInput: "maxPatternSize", sampleInput: "discoverySamples"
  };
  for (const [id, key] of Object.entries(map)) $(id).value = lab.settings[key];
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
    masterSeed: Math.round(inputNumber("masterSeedInput", 1, 99999999)),
    minPatternSize: Math.round(inputNumber("minPatternInput", 4, 100)),
    maxPatternSize: Math.round(inputNumber("maxPatternInput", 6, 200)),
    discoverySamples: Math.round(inputNumber("sampleInput", 5, 500))
  });
  if (lab.settings.maxPatternSize < lab.settings.minPatternSize) lab.settings.maxPatternSize = lab.settings.minPatternSize;
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

function evaluateCandidate(params, id, parentIds, generation) {
  const runs = [];
  const discoveries = new Map();
  for (let seedIndex = 0; seedIndex < lab.settings.seeds; seedIndex += 1) {
    const seed = (lab.settings.masterSeed + generation * 1000003 + seedIndex * 9176 + id.length * 101) >>> 0;
    const state = simulateFinalState({ ...lab.settings, ...params }, seed);
    const spatial = evaluateState(state, lab.settings.players);
    const binary = occupancyBoard(state);
    const allocated = allocateMatches(findMotifMatches(binary, lab.motifs));
    const motifScore = motifFitness(allocated, lab.motifs, state.size);
    for (const pattern of discoverPatterns(binary, {
      minSize: lab.settings.minPatternSize,
      maxSize: lab.settings.maxPatternSize,
      sampleLimit: lab.settings.discoverySamples,
      windowSize: Math.min(11, Math.max(5, Math.ceil(Math.sqrt(lab.settings.maxPatternSize))))
    })) {
      if (lab.ignoredSignatures.includes(pattern.signature)) continue;
      const current = discoveries.get(pattern.signature) || { ...pattern, occurrences: 0, seedCount: 0 };
      current.occurrences += pattern.occurrences;
      current.seedCount += 1;
      discoveries.set(pattern.signature, current);
    }
    runs.push({
      state,
      pattern: canonicalPattern(state),
      metrics: { ...spatial, motifFitness: motifScore }
    });
  }
  const aggregate = aggregateRuns(runs);
  aggregate.objectives.motifFitness = runs.reduce((sum, run) => sum + run.metrics.motifFitness, 0) / runs.length;
  return {
    id,
    generation,
    parentIds,
    params,
    seedCount: lab.settings.seeds,
    pinned: false,
    excluded: false,
    discoveries: [...discoveries.values()],
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
  for (const item of items) {
    const existing = lab.discovered.find((pattern) => pattern.signature === item.signature);
    if (existing) {
      existing.occurrences += item.occurrences;
      existing.seedCount += item.seedCount;
    } else {
      lab.discovered.push({ ...item });
    }
  }
  lab.discovered.sort((a, b) => b.seedCount - a.seedCount || b.occurrences - a.occurrences);
  lab.discovered = lab.discovered.slice(0, 300);
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
  const matches = selectedMotifOccurrences(occupancyBoard(board), lab.motifs);
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
  const pattern = lab.discovered.find((item) => item.signature === selectedPatternSignature);
  if (!pattern) return;
  const matches = findPatternOccurrences(occupancyBoard(board), pattern);
  matches.forEach((match, matchIndex) => {
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
      x: gap + match.center[0] * cellSize + cellSize * 0.5,
      y: gap + match.center[1] * cellSize + cellSize * 0.5,
      class: "patternOverlayLabel"
    }, svg).textContent = String(matchIndex + 1);
  });
}

function selectedCandidate() {
  return lab.archive.find((item) => item.id === lab.selectedCandidateId);
}

function selectCandidate(id) {
  lab.selectedCandidateId = id;
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
  $("archiveCount").textContent = `${frontier.length} Pareto / ${lab.archive.length} total`;
  for (const item of frontier) {
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

function preview(pattern) {
  const box = document.createElement("div");
  box.className = "patternPreview";
  box.style.gridTemplateColumns = `repeat(${pattern.width},1fr)`;
  box.style.aspectRatio = `${pattern.width}/${pattern.height}`;
  for (const value of pattern.cells) {
    const cell = document.createElement("i");
    cell.className = value === CELL.REQUIRED || value === 1 ? "on" : "";
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
    card.innerHTML = `<h3>${motif.name}</h3><div class="small">${motif.description || "No description"}</div>`;
    card.appendChild(preview(motif));
    const controls = document.createElement("div");
    controls.className = "cardActions";
    const enabled = button(motif.enabled ? "Disable" : "Enable", () => { motif.enabled = !motif.enabled; saveState(); renderMotifs(); });
    const edit = button("Edit", () => openEditor(motif));
    const remove = button("Delete", () => {
      if (!confirm(`Delete ${motif.name}?`)) return;
      lab.motifs = lab.motifs.filter((item) => item.id !== motif.id);
      saveState(); renderMotifs();
    });
    controls.append(enabled, edit, remove);
    card.append(controls, Object.assign(document.createElement("div"), { className: "small", textContent: `Weight ${motif.weight} · completion ${motif.minCompletion}` }));
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
    card.innerHTML = `<h3>${pattern.occupiedCount} cells</h3><div class="small">${pattern.occurrences} samples · ${pattern.seedCount} seed appearances</div>`;
    card.appendChild(preview(pattern));
    const actions = document.createElement("div");
    actions.className = "cardActions";
    actions.append(
      button("Show", () => {
        selectedPatternSignature = pattern.signature;
        patternOverlayEnabled = true;
        $("patternOverlayInput").checked = true;
        renderAll();
      }),
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
  const cells = pattern.cells.map((value) => value ? CELL.REQUIRED : CELL.IGNORE);
  openEditor({
    id: `motif-${Date.now()}`,
    name: `Discovered ${pattern.occupiedCount}`,
    description: "Promoted from sampled discovery",
    width: pattern.width,
    height: pattern.height,
    cells,
    weight: 50,
    minCompletion: 0.75,
    enabled: true,
    source: "discovered"
  }, true);
}

function openEditor(motif = null, isNew = false) {
  editorMotif = motif ? structuredClone(motif) : {
    id: `motif-${Date.now()}`, name: "New motif", description: "", width: 5, height: 5,
    cells: Array(25).fill(CELL.IGNORE), weight: 50, minCompletion: 0.75, enabled: true, source: "manual"
  };
  editorMotif.isNew = isNew || !lab.motifs.some((item) => item.id === editorMotif.id);
  $("motifNameInput").value = editorMotif.name;
  $("motifDescriptionInput").value = editorMotif.description || "";
  $("motifWeightInput").value = editorMotif.weight;
  $("motifCompletionInput").value = editorMotif.minCompletion;
  $("motifEnabledInput").checked = editorMotif.enabled;
  renderEditorGrid();
  $("motifDialog").showModal();
}

function renderEditorGrid() {
  const grid = $("editorGrid");
  grid.replaceChildren();
  grid.style.gridTemplateColumns = `repeat(${editorMotif.width},1fr)`;
  for (let i = 0; i < editorMotif.cells.length; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `editorCell s${editorMotif.cells[i]}`;
    const paint = () => { editorMotif.cells[i] = editorTool; cell.className = `editorCell s${editorTool}`; };
    cell.addEventListener("pointerdown", (event) => { event.preventDefault(); painting = true; paint(); });
    cell.addEventListener("pointerenter", () => { if (painting) paint(); });
    grid.appendChild(cell);
  }
}

function resizeEditor(width, height) {
  const cells = Array(width * height).fill(CELL.IGNORE);
  for (let y = 0; y < Math.min(height, editorMotif.height); y += 1) {
    for (let x = 0; x < Math.min(width, editorMotif.width); x += 1) cells[y * width + x] = editorMotif.cells[y * editorMotif.width + x];
  }
  editorMotif.width = width;
  editorMotif.height = height;
  editorMotif.cells = cells;
  renderEditorGrid();
}

function saveMotif() {
  Object.assign(editorMotif, {
    name: $("motifNameInput").value.trim() || "Untitled motif",
    description: $("motifDescriptionInput").value.trim(),
    weight: Math.max(-100, Math.min(100, Number($("motifWeightInput").value) || 0)),
    minCompletion: Math.max(0, Math.min(1, Number($("motifCompletionInput").value) || 0)),
    enabled: $("motifEnabledInput").checked
  });
  cropEditorMotif();
  delete editorMotif.isNew;
  const index = lab.motifs.findIndex((item) => item.id === editorMotif.id);
  if (index >= 0) lab.motifs[index] = editorMotif;
  else lab.motifs.push(editorMotif);
  saveState();
  renderMotifs();
  $("motifDialog").close();
}

function cropEditorMotif() {
  const active = [];
  for (let y = 0; y < editorMotif.height; y += 1) {
    for (let x = 0; x < editorMotif.width; x += 1) {
      if (editorMotif.cells[y * editorMotif.width + x] !== CELL.IGNORE) active.push([x, y]);
    }
  }
  if (!active.length) return;
  const minX = Math.min(...active.map(([x]) => x));
  const maxX = Math.max(...active.map(([x]) => x));
  const minY = Math.min(...active.map(([, y]) => y));
  const maxY = Math.max(...active.map(([, y]) => y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells = Array(width * height).fill(CELL.IGNORE);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells[(y - minY) * width + x - minX] = editorMotif.cells[y * editorMotif.width + x];
    }
  }
  editorMotif.width = width;
  editorMotif.height = height;
  editorMotif.cells = cells;
}

function renderAll() {
  $("generationLabel").textContent = `Next generation ${lab.generation}`;
  const candidate = selectedCandidate() || activeArchive()[0];
  if (candidate && !lab.selectedCandidateId) lab.selectedCandidateId = candidate.id;
  renderBoard(candidate);
  renderMetrics(candidate);
  $("candidateMeta").textContent = candidate ? `G${candidate.generation} · R ${candidate.params.rook.toFixed(1)} B ${candidate.params.bishop.toFixed(1)} N ${candidate.params.knight.toFixed(1)} A ${candidate.params.attack.toFixed(1)}` : "Select or generate a candidate.";
  renderArchive();
  renderMotifs();
  renderDiscovered();
}

function exportProject() {
  const blob = new Blob([serializeLabState(lab)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `motif-lab-${Date.now()}.json`;
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
  document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === tab));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${tab.dataset.tab}View`));
}));
$("newMotifBtn").addEventListener("click", () => openEditor());
document.querySelectorAll("#editorTools button").forEach((tool) => tool.addEventListener("click", () => {
  editorTool = Number(tool.dataset.tool);
  document.querySelectorAll("#editorTools button").forEach((item) => item.classList.toggle("active", item === tool));
}));
window.addEventListener("pointerup", () => { painting = false; });
$("addRowBtn").addEventListener("click", () => resizeEditor(editorMotif.width, Math.min(20, editorMotif.height + 1)));
$("addColBtn").addEventListener("click", () => resizeEditor(Math.min(20, editorMotif.width + 1), editorMotif.height));
$("clearGridBtn").addEventListener("click", () => { editorMotif.cells.fill(CELL.IGNORE); renderEditorGrid(); });
$("saveMotifBtn").addEventListener("click", saveMotif);
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
