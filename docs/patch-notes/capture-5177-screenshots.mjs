import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const baseUrl = "http://127.0.0.1:5177/";
const port = 9237;
const outDir = path.resolve("docs/patch-notes/screenshots");
const userDataDir = path.resolve("docs/patch-notes/.edge-profile");
await fs.mkdir(outDir, { recursive: true });
await fs.rm(userDataDir, { recursive: true, force: true });

const edge = spawn(edgePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1440,900",
  baseUrl
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
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function screenshot(name) {
  await cdp("Page.bringToFront");
  const shot = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(outDir, name), Buffer.from(shot.data, "base64"));
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Page.navigate", { url: baseUrl });
await cdp("Page.loadEventFired").catch(() => {});
await sleep(1000);

await evaluate(`
  document.querySelector("#generationSizeInput").value = "2";
  document.querySelector("#seedsInput").value = "2";
  document.querySelector("#turnsInput").value = "18";
  document.querySelector("#maxPatternInput").value = "16";
  document.querySelector("#generationSizeInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#seedsInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#turnsInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#maxPatternInput").dispatchEvent(new Event("change", { bubbles: true }));
`);
await evaluate(`document.querySelector("#runGenerationBtn").click()`);
for (let i = 0; i < 150; i += 1) {
  const status = await evaluate(`document.querySelector("#progressLabel")?.textContent || ""`);
  if (status === "COMPLETE") break;
  await sleep(200);
}
await screenshot("5177-01-evolution-archive.png");

await evaluate(`[...document.querySelectorAll(".tabs button")].find((button) => button.textContent === "Motifs")?.click()`);
await sleep(300);
await screenshot("5177-02-motif-library-overlay.png");

await evaluate(`[...document.querySelectorAll(".tabs button")].find((button) => button.textContent === "Discovered")?.click()`);
await sleep(300);
await screenshot("5177-03-discovered-patterns.png");

for (let i = 0; i < 80; i += 1) {
  const clicked = await evaluate(`
    (() => {
      const shows = [...document.querySelectorAll("button")].filter((button) => button.textContent === "Show");
      if (!shows[${i}]) return false;
      shows[${i}].click();
      return true;
    })()
  `);
  if (!clicked) break;
  await sleep(80);
  const hasOverlay = await evaluate(`Boolean(document.querySelector("#boardSvg .patternOverlayCell"))`);
  if (hasOverlay) break;
}
await screenshot("5177-04-discovered-show-overlay.png");

const qa = await evaluate(`JSON.stringify({
  title: document.title,
  archiveCount: document.querySelector("#archiveCount")?.textContent || "",
  discoveredCount: document.querySelector("#discoveredCount")?.textContent || "",
  motifOverlay: document.querySelector("#motifOverlayInput")?.checked,
  patternOverlay: document.querySelector("#patternOverlayInput")?.checked,
  hasBoard: Boolean(document.querySelector("#boardSvg rect.boardCell")),
  hasMotifOverlay: Boolean(document.querySelector("#boardSvg .motifOverlayCell")),
  hasPatternOverlay: Boolean(document.querySelector("#boardSvg .patternOverlayCell"))
})`);
await fs.writeFile(path.join(outDir, "5177-browser-qa.json"), qa);

ws.close();
edge.kill();
