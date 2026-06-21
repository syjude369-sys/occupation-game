// codex-status.mjs
// Run: node codex-status.mjs
// Verifies furniture engine components and prints status report.

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const CHECKS = [
  {
    label: 'furniture-layout-engine.js',
    path: 'furniture-layout-engine.js',
    type: 'module',
    expectedExports: [
      'CELL_SIZE_MM','FINE_GRID_MM','MIN_PATH_WIDTH_MM','PREFERRED_PATH_WIDTH_MM',
      'normalizeMotifForFurniture','buildFineGrid','discoverFreeComponents',
      'generateGridFillingCandidates','generatePartialCellCandidates',
      'validateLayout','generateFurnitureLayouts','generateFurnitureLayoutCandidates',
    ],
  },
  {
    label: 'furniture-catalog.js',
    path: 'furniture-catalog.js',
    type: 'module',
    expectedExports: ['validateFurnitureCatalog','loadFurnitureCatalog'],
  },
  {
    label: 'furniture-catalog.json',
    path: 'assets/furniture/metadata/furniture-catalog.json',
    type: 'json',
    checks: (data) => {
      const arr = Array.isArray(data) ? data : [];
      const ids = arr.map(i => i.id);
      return [
        arr.length > 0 ? `${arr.length} items` : 'EMPTY — no items',
        ids.includes('office_cubicle') ? 'office_cubicle present' : 'WARN: office_cubicle missing',
        arr.every(i => i.footprintMm) ? 'all footprintMm present' : 'WARN: some missing footprintMm',
      ];
    },
  },
  {
    label: 'furniture-svg-outlines.json',
    path: 'assets/furniture/metadata/furniture-svg-outlines.json',
    type: 'json',
    checks: (data) => {
      const keys = Object.keys(data);
      const withPaths = keys.filter(k => data[k].paths && data[k].paths.length > 0);
      return [
        `${keys.length} blocks total`,
        `${withPaths.length} blocks with paths`,
        withPaths.length > 0 ? `sample: ${withPaths[0]}` : 'WARN: no paths found',
      ];
    },
  },
  {
    label: 'furniture-lab.html',
    path: 'furniture-lab.html',
    type: 'text',
    checks: (text) => [
      text.includes('loadMotifFromURL') ? 'URL param loading: OK' : 'MISSING: loadMotifFromURL',
      text.includes('applyMotifData') ? 'motif apply: OK' : 'MISSING: applyMotifData',
      text.includes('furniture-layout-engine.js') ? 'engine import: OK' : 'MISSING: engine import',
      text.includes('furniture-svg-outlines.json') ? 'SVG outlines: OK' : 'MISSING: SVG outlines fetch',
      text.includes('appnav') ? 'nav: OK' : 'MISSING: appnav',
    ],
  },
  {
    label: 'index.html (nav)',
    path: 'index.html',
    type: 'text',
    checks: (text) => [
      text.includes('appnav') ? 'nav: OK' : 'MISSING: appnav',
      text.includes('furniture-lab.html') ? 'Furniture link: OK' : 'MISSING: furniture-lab link',
    ],
  },
  {
    label: 'lab-app.js (→ Furniture button)',
    path: 'lab-app.js',
    type: 'text',
    checks: (text) => [
      text.includes('→ Furniture') ? '→ Furniture button: OK' : 'MISSING: → Furniture button',
      text.includes('furniture-lab.html') ? 'URL target: OK' : 'MISSING: furniture-lab.html ref',
      text.includes('motif:') && text.includes('JSON.stringify') ? 'motif serialization: OK' : 'WARN: check motif serialization',
    ],
  },
  {
    label: 'style.css (nav styles)',
    path: 'style.css',
    type: 'text',
    checks: (text) => [
      text.includes('nav.appnav') ? 'appnav styles: OK' : 'MISSING: nav.appnav',
    ],
  },
];

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function ok(s) { return `${GREEN}✓${RESET} ${s}`; }
function warn(s) { return `${YELLOW}⚠${RESET} ${s}`; }
function fail(s) { return `${RED}✗${RESET} ${s}`; }

async function checkModule(filePath, expectedExports) {
  try {
    const fileUrl = new URL('file:///' + filePath.replace(/\\/g, '/')).href + '?t=' + Date.now();
    const mod = await import(fileUrl);
    const results = [];
    for (const name of expectedExports) {
      if (mod[name] !== undefined) {
        results.push(ok(name));
      } else {
        results.push(fail(`export '${name}' missing`));
      }
    }
    return { ok: true, results };
  } catch (e) {
    return { ok: false, results: [fail(`import error: ${e.message}`)] };
  }
}

let totalOk = 0, totalFail = 0;

console.log(`\n${BOLD}${CYAN}DD3 Codex — Furniture Engine Status${RESET}`);
console.log(DIM + '─'.repeat(50) + RESET);

for (const check of CHECKS) {
  const absPath = join(__dir, check.path);
  console.log(`\n${BOLD}${check.label}${RESET}`);

  if (!existsSync(absPath)) {
    console.log('  ' + fail(`FILE NOT FOUND: ${check.path}`));
    totalFail++;
    continue;
  }

  if (check.type === 'module') {
    const result = await checkModule(absPath, check.expectedExports);
    for (const r of result.results) {
      const isFail = r.includes('\x1b[31m');
      console.log('  ' + r);
      if (isFail) totalFail++; else totalOk++;
    }
  } else if (check.type === 'json') {
    try {
      const data = JSON.parse(readFileSync(absPath, 'utf8'));
      const lines = check.checks(data);
      for (const line of lines) {
        const isFail = line.startsWith('EMPTY') || line.startsWith('MISSING');
        const isWarn = line.startsWith('WARN');
        if (isFail) { console.log('  ' + fail(line)); totalFail++; }
        else if (isWarn) { console.log('  ' + warn(line)); }
        else { console.log('  ' + ok(line)); totalOk++; }
      }
    } catch (e) {
      console.log('  ' + fail(`parse error: ${e.message}`));
      totalFail++;
    }
  } else {
    const text = readFileSync(absPath, 'utf8');
    const lines = check.checks(text);
    for (const line of lines) {
      const isFail = line.startsWith('MISSING');
      const isWarn = line.startsWith('WARN');
      if (isFail) { console.log('  ' + fail(line)); totalFail++; }
      else if (isWarn) { console.log('  ' + warn(line)); }
      else { console.log('  ' + ok(line)); totalOk++; }
    }
  }
}

console.log('\n' + DIM + '─'.repeat(50) + RESET);
const allOk = totalFail === 0;
const summary = `${BOLD}${allOk ? GREEN : RED}${allOk ? 'ALL OK' : 'ISSUES FOUND'}${RESET}  ${GREEN}${totalOk} passed${RESET}  ${totalFail > 0 ? RED : DIM}${totalFail} failed${RESET}`;
console.log(summary + '\n');
