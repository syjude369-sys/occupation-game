import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const cdpPort = 9259;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve("docs/presentation-screenshots", stamp);
const userDataDir = path.join(outDir, ".edge-profile");

const apps = [
  { port: 5174, dir: "base-gameboard", label: "phase-01-base-gameboard" },
  { port: 5175, dir: "base-gameboard-territory", label: "phase-02-territory" },
  { port: 5176, dir: "base-gameboard-form-finding", label: "phase-03-form-finding" },
  { port: 5177, dir: "base-gameboard-motif-lab", label: "phase-04-motif-lab" },
  { port: 5178, dir: "base-gameboard-pattern-engine", label: "phase-05-pattern-engine" },
  { port: 5179, dir: "base-gameboard-simulation-rules", label: "phase-06-simulation-rules" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const spawned = [];

await fs.mkdir(outDir, { recursive: true });

async function isUp(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(app) {
  if (await isUp(app.port)) return { ...app, started: false };
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: path.join(root, app.dir),
    env: { ...process.env, PORT: String(app.port) },
    stdio: "ignore",
    windowsHide: true,
  });
  spawned.push(child);
  for (let i = 0; i < 50; i += 1) {
    if (await isUp(app.port)) return { ...app, started: true };
    await sleep(200);
  }
  throw new Error(`Could not start ${app.label} on ${app.port}`);
}

for (const app of apps) await ensureServer(app);

const edge = spawn(edgePath, [
  "--headless=new",
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1600,1000",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

async function getJson(url, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(200);
  }
  throw new Error(`Could not fetch ${url}`);
}

const pages = await getJson(`http://127.0.0.1:${cdpPort}/json`);
const page = pages.find((item) => item.type === "page") || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let messageId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  if (message.error) item.reject(new Error(JSON.stringify(message.error)));
  else item.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++messageId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function goto(url) {
  await cdp("Page.navigate", { url });
  await sleep(1400);
}

async function shot(name) {
  const capture = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(outDir, name), Buffer.from(capture.data, "base64"));
}

async function waitForComplete(selector = "#progressLabel", attempts = 180) {
  for (let i = 0; i < attempts; i += 1) {
    const text = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ""`);
    if (text === "COMPLETE") return true;
    await sleep(200);
  }
  return false;
}

await cdp("Page.enable");
await cdp("Runtime.enable");

const qa = [];

await goto("http://127.0.0.1:5174/");
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "base", title: document.title, board: Boolean(document.querySelector("svg, canvas, #boardSvg")) })`)));
await shot("01-phase-base-gameboard.png");

await goto("http://127.0.0.1:5175/");
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "territory", title: document.title, board: Boolean(document.querySelector("svg, canvas, #boardSvg")) })`)));
await shot("02-phase-territory.png");

await goto("http://127.0.0.1:5176/");
await evaluate(`
  document.querySelector("#candidateCount").value = "4";
  document.querySelector("#seedCount").value = "2";
  document.querySelector("#turnCount").value = "24";
  ["candidateCount","seedCount","turnCount"].forEach((id) => document.querySelector("#" + id).dispatchEvent(new Event("change", { bubbles: true })));
  document.querySelector("#runButton")?.click();
`);
for (let i = 0; i < 120; i += 1) {
  const text = await evaluate(`document.querySelector("#progressText")?.textContent || ""`);
  if (text === "COMPLETE") break;
  await sleep(200);
}
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "form", title: document.title, boardCells: document.querySelectorAll("#resultBoard rect").length, candidates: document.querySelector("#resultSummary")?.textContent || "" })`)));
await shot("03-phase-form-finding.png");

await goto("http://127.0.0.1:5177/");
await evaluate(`
  document.querySelector("#generationSizeInput").value = "4";
  document.querySelector("#seedsInput").value = "2";
  document.querySelector("#turnsInput").value = "20";
  ["generationSizeInput","seedsInput","turnsInput"].forEach((id) => document.querySelector("#" + id).dispatchEvent(new Event("change", { bubbles: true })));
  document.querySelector("#runGenerationBtn").click();
`);
await waitForComplete();
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "motif", title: document.title, archive: document.querySelector("#archiveCount")?.textContent || "", discovered: document.querySelector("#discoveredCount")?.textContent || "" })`)));
await shot("04-phase-motif-lab-archive.png");

await goto("http://127.0.0.1:5178/");
await evaluate(`
  document.querySelector("#generationSizeInput").value = "4";
  document.querySelector("#seedsInput").value = "2";
  document.querySelector("#turnsInput").value = "20";
  ["generationSizeInput","seedsInput","turnsInput"].forEach((id) => document.querySelector("#" + id).dispatchEvent(new Event("change", { bubbles: true })));
  document.querySelector("#runGenerationBtn").click();
`);
await waitForComplete();
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "pattern", title: document.title, archive: document.querySelector("#archiveCount")?.textContent || "", discovered: document.querySelector("#discoveredCount")?.textContent || "" })`)));
await shot("05-phase-pattern-engine.png");

await goto("http://127.0.0.1:5179/");
await evaluate(`
  document.querySelector("#generationSizeInput").value = "6";
  document.querySelector("#seedsInput").value = "2";
  document.querySelector("#turnsInput").value = "30";
  ["generationSizeInput","seedsInput","turnsInput"].forEach((id) => document.querySelector("#" + id).dispatchEvent(new Event("change", { bubbles: true })));
  document.querySelector("#initialPatternSearchBtn")?.click();
`);
await waitForComplete();
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "simulation", title: document.title, archive: document.querySelector("#archiveCount")?.textContent || "", discovered: document.querySelector("#discoveredCount")?.textContent || "" })`)));
await shot("06-phase-simulation-rules.png");

await goto("http://127.0.0.1:5179/furniture-lab.html?motif=%7B%22signature%22%3A%223x3%3AEEOOEOOEO%22%2C%22id%22%3A%22presentation-motif%22%2C%22name%22%3A%22Presentation+Motif%22%2C%22width%22%3A3%2C%22height%22%3A3%2C%22cells%22%3A%5B%22E%22%2C%22O%22%2C%22O%22%2C%22E%22%2C%22E%22%2C%22E%22%2C%22O%22%2C%22O%22%2C%22O%22%5D%7D");
await evaluate(`document.querySelector("#runBtn")?.click()`);
for (let i = 0; i < 80; i += 1) {
  const count = await evaluate(`document.querySelectorAll(".apply-layout-btn").length`);
  if (count > 0) break;
  await sleep(200);
}
qa.push(JSON.parse(await evaluate(`JSON.stringify({ phase: "furniture", title: document.title, layouts: document.querySelectorAll(".layout-view").length, buttons: document.querySelectorAll(".apply-layout-btn").length })`)));
await shot("07-phase-furniture-layout.png");

await fs.writeFile(path.join(outDir, "phase-screenshot-qa.json"), JSON.stringify(qa, null, 2));
await fs.writeFile(path.join(outDir, "README.md"), `# DD3 Presentation Screenshots

Captured: ${new Date().toISOString()}

Files:

- 01-phase-base-gameboard.png
- 02-phase-territory.png
- 03-phase-form-finding.png
- 04-phase-motif-lab-archive.png
- 05-phase-pattern-engine.png
- 06-phase-simulation-rules.png
- 07-phase-furniture-layout.png

`);

ws.close();
edge.kill();
for (const child of spawned) child.kill();

console.log(outDir);
