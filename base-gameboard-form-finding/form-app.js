import { canonicalPattern, evaluateState } from "./form-metrics.js";
import {
  aggregateRuns,
  createSeededRandom,
  generateCandidate,
  paretoFront
} from "./form-search.js";
import { simulateFinalState } from "./form-simulation.js";

const PLAYER_COLORS = ["#00a9f4", "#ff6192", "#111111", "#7d5cff", "#00b894", "#ff9f1c", "#e84393", "#6c5ce7"];
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
let stopped = false;
let allResults = [];
let frontier = [];
let selectedId = null;

function number(id, min, max) {
  return Math.max(min, Math.min(max, Number($(id).value) || min));
}

function currentConfig() {
  return {
    size: Math.round(number("gridSize", 4, 31)),
    players: Math.round(number("playerCount", 2, 8)),
    turns: Math.round(number("turnCount", 1, 200)),
    cellCap: Math.round(number("cellCap", 1, 400)),
    candidates: Math.round(number("candidateCount", 2, 200)),
    seeds: Math.round(number("seedCount", 2, 50)),
    masterSeed: Math.round(number("masterSeed", 1, 9999999))
  };
}

function setRunning(running) {
  $("runButton").disabled = running;
  $("stopButton").disabled = !running;
}

function format(value) {
  return Number(value).toFixed(3);
}

function svgElement(tag, attrs, parent) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  parent.appendChild(element);
  return element;
}

function renderBoard(board) {
  const svg = $("resultBoard");
  svg.replaceChildren();
  if (!board) {
    $("emptyState").hidden = false;
    return;
  }
  $("emptyState").hidden = true;
  const gap = 40;
  const available = 1000 - gap * 2;
  const cell = available / board.size;
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svgElement("rect", { x: gap, y: gap, width: available, height: available, fill: "#fff", stroke: "#111", "stroke-width": 2 }, svg);
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size; x += 1) {
      const owner = board.cells[y * board.size + x];
      svgElement("rect", {
        x: gap + x * cell,
        y: gap + y * cell,
        width: cell,
        height: cell,
        fill: owner < 0 ? "#fff" : PLAYER_COLORS[owner % PLAYER_COLORS.length],
        class: "boardCell"
      }, svg);
    }
  }
}

function renderMetrics(candidate) {
  const labels = [
    ["Continuity", "continuity"],
    ["Interpenetration", "interpenetration"],
    ["Boundary", "boundary"],
    ["Balance", "balance"],
    ["Stability", "stability"]
  ];
  $("metricBar").replaceChildren(...labels.map(([label, key]) => {
    const span = document.createElement("span");
    span.textContent = candidate ? `${label} ${format(candidate.objectives[key])}` : `${label} —`;
    return span;
  }));
}

function selectCandidate(id) {
  const candidate = frontier.find((item) => item.id === id);
  if (!candidate) return;
  selectedId = id;
  renderBoard(candidate.representative);
  renderMetrics(candidate);
  $("selectionLabel").textContent =
    `R ${candidate.params.rook.toFixed(1)} · B ${candidate.params.bishop.toFixed(1)} · N ${candidate.params.knight.toFixed(1)} · Attack ${candidate.params.attack.toFixed(1)}%`;
  document.querySelectorAll(".resultItem").forEach((item) => item.classList.toggle("selected", item.dataset.id === id));
}

function renderResults() {
  const list = $("resultList");
  list.replaceChildren();
  frontier.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "resultItem";
    button.dataset.id = candidate.id;
    const scores = candidate.objectives;
    button.innerHTML = `
      <span class="rank">${index + 1}</span>
      <span class="resultBody">
        <span class="weights">R ${candidate.params.rook.toFixed(1)} · B ${candidate.params.bishop.toFixed(1)} · N ${candidate.params.knight.toFixed(1)} · A ${candidate.params.attack.toFixed(1)}</span>
        <span class="scores">
          <span>C ${format(scores.continuity)}</span>
          <span>I ${format(scores.interpenetration)}</span>
          <span>B ${format(scores.boundary)}</span>
          <span>E ${format(scores.balance)}</span>
          <span>S ${format(scores.stability)}</span>
        </span>
        <span class="frequency">${candidate.topCount}/${candidate.seedCount} repeats · ${candidate.distinctPatterns} pattern classes</span>
      </span>`;
    button.addEventListener("click", () => selectCandidate(candidate.id));
    list.appendChild(button);
  });
  $("resultSummary").textContent = `${frontier.length} Pareto / ${allResults.length} total`;
  $("exportButton").disabled = !allResults.length;
  if (frontier.length) selectCandidate(selectedId && frontier.some((item) => item.id === selectedId) ? selectedId : frontier[0].id);
}

async function runSearch() {
  stopped = false;
  setRunning(true);
  allResults = [];
  frontier = [];
  selectedId = null;
  renderResults();
  renderBoard(null);
  renderMetrics(null);

  const config = currentConfig();
  const random = createSeededRandom(config.masterSeed);
  $("searchProgress").max = config.candidates;
  $("searchProgress").value = 0;

  for (let index = 0; index < config.candidates; index += 1) {
    if (stopped) break;
    const params = generateCandidate(random);
    const runs = [];
    for (let seedIndex = 0; seedIndex < config.seeds; seedIndex += 1) {
      const seed = (config.masterSeed + index * 1009 + seedIndex * 9176) >>> 0;
      const finalState = simulateFinalState({ ...config, ...params }, seed);
      runs.push({
        state: finalState,
        metrics: evaluateState(finalState, config.players),
        pattern: canonicalPattern(finalState)
      });
    }
    const aggregate = aggregateRuns(runs);
    allResults.push({
      id: `candidate-${index + 1}`,
      params,
      seedCount: config.seeds,
      ...aggregate
    });
    frontier = paretoFront(allResults).sort((a, b) => b.objectives.stability - a.objectives.stability);
    $("searchProgress").value = index + 1;
    $("progressText").textContent = `${index + 1} / ${config.candidates}`;
    renderResults();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  setRunning(false);
  $("progressText").textContent = stopped ? "STOPPED" : "COMPLETE";
}

function exportResults() {
  const blob = new Blob([JSON.stringify({
    generatedAt: new Date().toISOString(),
    config: currentConfig(),
    frontier,
    allResults
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `form-finding-${Date.now()}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("runButton").addEventListener("click", runSearch);
$("stopButton").addEventListener("click", () => { stopped = true; });
$("exportButton").addEventListener("click", exportResults);
renderBoard(null);
