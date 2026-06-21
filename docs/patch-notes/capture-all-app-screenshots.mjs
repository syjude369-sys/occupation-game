import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9241;
const outDir = path.resolve("docs/patch-notes/screenshots");
const userDataDir = path.resolve("docs/patch-notes/.edge-profile-all");
await fs.mkdir(outDir, { recursive: true });
await fs.rm(userDataDir, { recursive: true, force: true });

const edge = spawn(edgePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1440,900",
  "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const pages = await getJson(`http://127.0.0.1:${port}/json`);
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

async function shot(name) {
  const capture = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(outDir, name), Buffer.from(capture.data, "base64"));
}

async function goto(url) {
  await cdp("Page.navigate", { url });
  await sleep(1200);
}

await cdp("Page.enable");
await cdp("Runtime.enable");

const qa = [];

await goto("http://127.0.0.1:5174/");
qa.push(await evaluate(`JSON.stringify({ port: 5174, title: document.title, hasBoard: Boolean(document.querySelector("svg, canvas, #boardSvg")) })`));
await shot("5174-01-base-gameboard.png");

await goto("http://127.0.0.1:5175/");
qa.push(await evaluate(`JSON.stringify({ port: 5175, title: document.title, hasBoard: Boolean(document.querySelector("svg, canvas, #boardSvg")) })`));
await shot("5175-01-territory-variant.png");

await goto("http://127.0.0.1:5176/");
await evaluate(`
  if (document.querySelector("#generationSizeInput")) document.querySelector("#generationSizeInput").value = "2";
  if (document.querySelector("#seedsInput")) document.querySelector("#seedsInput").value = "2";
  if (document.querySelector("#runSearchBtn")) document.querySelector("#runSearchBtn").click();
`);
await sleep(1800);
qa.push(await evaluate(`JSON.stringify({ port: 5176, title: document.title, hasBoard: Boolean(document.querySelector("svg, canvas, #boardSvg")) })`));
await shot("5176-01-form-finding.png");

await goto("http://127.0.0.1:5177/");
await evaluate(`
  document.querySelector("#generationSizeInput").value = "2";
  document.querySelector("#seedsInput").value = "2";
  document.querySelector("#turnsInput").value = "18";
  document.querySelector("#generationSizeInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#seedsInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#turnsInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#runGenerationBtn").click();
`);
for (let i = 0; i < 150; i += 1) {
  const status = await evaluate(`document.querySelector("#progressLabel")?.textContent || ""`);
  if (status === "COMPLETE") break;
  await sleep(200);
}
qa.push(await evaluate(`JSON.stringify({
  port: 5177,
  title: document.title,
  archiveCount: document.querySelector("#archiveCount")?.textContent || "",
  discoveredCount: document.querySelector("#discoveredCount")?.textContent || "",
  hasBoard: Boolean(document.querySelector("#boardSvg rect.boardCell")),
  hasMotifOverlay: Boolean(document.querySelector("#boardSvg .motifOverlayCell"))
})`));
await shot("5177-01-evolution-archive.png");

await fs.writeFile(path.join(outDir, "all-apps-browser-qa.json"), JSON.stringify(qa.map(JSON.parse), null, 2));

ws.close();
edge.kill();
