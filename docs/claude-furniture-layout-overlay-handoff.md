# Claude Handoff: Furniture Layout Overlay Back To Pattern Engine

Date: 2026-06-22

## 2026-06-22 Codex Update

Codex has implemented the first version of this feature in `base-gameboard-simulation-rules`.

Implemented files:

- `furniture-overlay.js`
- `furniture-overlay.test.mjs`
- `furniture-lab.html`
- `lab-app.js`
- `style.css`

Implemented behavior:

- Furniture Lab keeps source motif metadata from the Pattern Engine URL.
- Each generated layout gets an `Apply to Pattern Board` button.
- Applied layouts are saved to `localStorage` under `dd3:furniture-layout-overlays`.
- Pattern Engine reads saved overlays and draws furniture rectangles on actual motif occurrences in the board SVG.
- Motif cards show `furniture layout applied: ...` when a saved layout matches by motif id or signature.
- Existing interfaces were preserved; only additive controls/status text were introduced.

Validation already run:

- `node --check lab-app.js`
- `node --test furniture-overlay.test.mjs`
- `node --test *.test.mjs` -> 166 pass
- `node codex-status.mjs` -> ALL OK, 31 passed
- Browser smoke test: motif URL -> Run Layout Engine -> Apply Best Overall -> Pattern Engine showed 6 `.furnitureOverlayItem` elements and motif card showed `layout applied: Best Overall`.

Claude should avoid reimplementing this same layer from scratch. Continue from this version unless the user asks for behavior changes or visual refinement.

## Current App

Work in:

`D:\3-1\디디3\DD3 Codex\base-gameboard-simulation-rules`

Current server:

`http://127.0.0.1:5179/`

Important: preserve the current 5179 simulation/pattern-engine version. Do not overwrite it with older `base-gameboard-pattern-engine` files. A backup exists at:

`D:\3-1\디디3\DD3 Codex\backups\base-gameboard-simulation-rules-before-furniture-merge-20260622-072014`

The furniture engine has already been merged into the 5179 app:

- `furniture-layout-engine.js`
- `furniture-layout-engine.test.mjs`
- `furniture-catalog.js`
- `furniture-catalog.test.mjs`
- `furniture-lab.html`
- `assets/furniture/metadata/furniture-catalog.json`
- `assets/furniture/metadata/furniture-svg-outlines.json`
- `codex-status.mjs`

Last known validation after merge:

- `node --check lab-app.js`
- `node --test *.test.mjs` -> 161 pass
- `node codex-status.mjs` -> ALL OK, 31 passed

## User Goal

When a user opens a motif in `furniture-lab.html`, runs furniture layout generation, and chooses one generated layout, that layout should be reflected back in the Pattern Engine game board motif visualization.

Meaning:

- The furniture layout is defined in motif-local coordinates.
- Pattern Engine must draw it on the actual board where that motif is found.
- It must not appear in arbitrary cells.
- If the motif appears multiple times on the currently displayed archive/replay board, the chosen layout can be repeated at each matching occurrence.
- This should be an overlay layer, not a mutation of simulation cells.

## Non-Negotiable UI Constraint

The existing interfaces must be preserved.

Do not redesign or replace either page:

- Keep the current Pattern Engine layout, sidebar, board, archive list, motifs/discovered tabs, replay controls, and existing buttons.
- Keep the current Furniture Lab layout, catalog panel, motif grid, run controls, layout tabs, SVG preview, and stats panel.
- Add only the smallest necessary controls:
  - one `Apply to Pattern Board` action on each generated furniture layout
  - small applied/status text where useful
  - optional motif-card status text in Pattern Engine
- Do not move existing controls unless there is a direct functional conflict.
- Do not change the existing motif overlay checkbox behavior. Furniture overlay should follow the same motif visualization layer unless a later user request asks for a separate toggle.
- Do not introduce a new workflow page, modal, wizard, or landing screen.

The desired user experience is additive:

`Pattern Engine → motif card → Furniture Lab → choose layout → apply → return to same Pattern Engine board with furniture drawn inside matching motif occurrences`.

## Recommended Architecture

Use a separate localStorage channel instead of writing furniture choices into the main pattern-engine state immediately.

Suggested key:

`dd3:furniture-layout-overlays`

Suggested stored shape:

```json
{
  "version": 1,
  "items": {
    "motif-1782080624202": {
      "motifId": "motif-1782080624202",
      "signature": "3x3:EEOOEOOEO",
      "name": "Pattern 1",
      "width": 3,
      "height": 3,
      "layoutLabel": "Layout 1",
      "layout": {
        "valid": true,
        "placements": []
      },
      "updatedAt": "2026-06-22T00:00:00.000Z"
    }
  }
}
```

Keying:

- Prefer `motif.id` when present.
- Also store `signature` as fallback matching key.
- Pattern Engine should match by `id` first, then by `signature`.

## Files To Touch

### `furniture-lab.html`

Relevant anchors:

- URL motif loading: `loadMotifFromURL()`
- motif apply: `applyMotifData(motifData)`
- layout rendering: `renderResults(result, motif)`
- layout SVG preview: `buildLayoutSVG(layout, motif)`
- layout stats: `buildStats(layout)`

Needed changes:

1. Preserve source motif metadata when URL motif is loaded.
   - Current `renderResults` receives a generated `motif` object with id `lab_motif`.
   - Add a module-level `sourceMotifData` or `activeMotifMeta`.
   - In `applyMotifData(motifData)`, save:
     - `id`
     - `signature`
     - `name`
     - `archiveCandidateId`
     - `width`
     - `height`

2. Add an `Apply to Pattern Board` button to each layout view/card in `renderResults`.
   - On click, store the selected layout in `dd3:furniture-layout-overlays`.
   - Store only serializable layout data needed for overlay:
     - `layout.label`
     - `layout.valid`
     - `layout.placements`
     - scores if useful
     - motif width/height/cells
   - Show a small applied status in the layout card or top status line.

3. Optional but useful:
   - Add a `Back to Pattern Engine` link or button after applying.
   - Since both pages are same-origin, localStorage is enough; no server API needed.

### `lab-app.js`

Relevant anchors:

- storage imports near top
- motif overlay flag: `let motifOverlayEnabled = true;`
- pattern identity: `patternKey(pattern)`
- occurrence finder: `displayPatternOccurrences(board, pattern)`
- board rendering: `renderBoard(candidate)`
- motif overlay: `renderMotifOverlay(svg, board, gap, cellSize)`
- selected pattern overlay: `renderPatternOverlay(svg, board, gap, cellSize)`
- motif cards: `renderMotifs()`

Needed changes:

1. Add constants/helpers:

```js
const FURNITURE_OVERLAY_KEY = "dd3:furniture-layout-overlays";

function loadFurnitureOverlays() { ... }
function furnitureOverlayForPattern(pattern) { ... }
```

Keep parsing defensive. Bad JSON should return empty data.

2. Add a renderer after motif overlay:

```js
function renderFurnitureOverlay(svg, board, gap, cellSize) {
  if (!motifOverlayEnabled) return;
  const overlays = loadFurnitureOverlays();
  for (const motif of lab.motifs) {
    const overlay = furnitureOverlayForPattern(motif, overlays);
    if (!overlay) continue;
    const matches = displayPatternOccurrences(occupancyBoard(board), motif);
    for (const match of matches) {
      drawFurnitureLayoutAtMatch(svg, overlay.layout, match, gap, cellSize);
    }
  }
}
```

3. Call it from `renderBoard(candidate)` after `renderMotifOverlay(...)`.

Current order:

```js
renderMotifOverlay(svg, board, gap, size);
renderPatternOverlay(svg, board, gap, size);
```

Recommended order:

```js
renderMotifOverlay(svg, board, gap, size);
renderFurnitureOverlay(svg, board, gap, size);
renderPatternOverlay(svg, board, gap, size);
```

Pattern overlay should stay on top because it is the user's explicit selected pattern marker.

4. Coordinate transform:

Furniture placement data is motif-local. Board overlay is board-global.

Use:

```js
const boardX = match.x + localX;
const boardY = match.y + localY;
```

Inspect layout placement fields before implementing final math. The furniture engine usually uses mm/fine-grid/cell-derived placement rects. Convert relative mm to cells with the same scale used by `buildLayoutSVG`.

Known furniture constants:

- One motif cell = 1500 mm
- `buildLayoutSVG()` uses `PX = 72` for preview only; do not use preview pixels for board math.
- For board overlay, convert mm to board cell units:

```js
const cellUnitsX = placement.xMm / 1500;
const cellUnitsY = placement.yMm / 1500;
const cellUnitsW = placement.widthMm / 1500;
const cellUnitsH = placement.depthMm / 1500;
```

If placement fields are named differently, inspect `furniture-layout-engine.js` and use the actual keys.

5. Visual treatment:

Keep it quiet but readable:

- furniture rect fill: translucent green/teal
- stroke: dark green
- label: short furniture id/name, clipped or tiny
- pointer-events: none

Suggested classes in CSS:

- `.furnitureOverlayItem`
- `.furnitureOverlayLabel`

6. Motif card status:

In `renderMotifs()`, append whether a furniture layout is applied:

Existing card line:

```js
Fitness weight ... · furniture ${motif.furniture?.status || "not_tested"}
```

Change/add:

`layout applied` when `furnitureOverlayForPattern(motif)` returns an overlay.

## Tests To Add

Prefer a small standalone test file:

`furniture-overlay.test.mjs`

Test pure helpers, not DOM if possible.

Recommended exported helper module:

`furniture-overlay.js`

Possible functions:

```js
export function normalizeFurnitureOverlayStore(raw) { ... }
export function findFurnitureOverlayForPattern(pattern, store) { ... }
export function projectFurniturePlacementToBoardRect(placement, match, cellSizePx) { ... }
```

Test cases:

1. Invalid localStorage payload returns empty overlay store.
2. Finds overlay by motif id.
3. Falls back to signature when id does not match.
4. Projects placement mm coordinates to board rect:
   - match `{ x: 9, y: 14 }`
   - placement `{ xMm: 1500, yMm: 0, widthMm: 1500, depthMm: 1500 }`
   - cellSize `20`
   - expected board rect x around `(9 + 1) * 20`, y around `14 * 20`, width `20`, height `20`
5. Handles rotation if placement includes rotation and swapped dimensions are required.

After implementation run:

```powershell
cd "D:\3-1\디디3\DD3 Codex\base-gameboard-simulation-rules"
node --check lab-app.js
node --test *.test.mjs
node codex-status.mjs
```

Then restart 5179 if needed.

## Current Important Behavior To Preserve

- `Initial pattern search` is simulation-only and disabled once motif fitness is active.
- `Run generation` is motif-optimization mode.
- Motif/pattern overlays currently mark occurrences on the actual board, not arbitrary preview cells.
- Motif hits count persistent episodes of at least 3 turns.
- Replay shows every turn from turn 0 through final turn.
- Pattern condition defaults:
  - minimum occupied cells: 3
  - minimum occupancy ratio: 1/3
- Nested pattern handling preserves inner patterns only when they have adjacent empty access.

## Implementation Cautions

- Do not overwrite `lab-app.js` with the older version from `base-gameboard-pattern-engine`.
- Do not mutate the board cells to represent furniture.
- Do not store furniture layout inside the main simulation archive yet unless the user explicitly asks. Use separate overlay storage first.
- If a selected layout does not fit the currently selected archive board because the motif is absent, show no furniture overlay and do not error.
- If multiple active motifs have saved furniture, render all saved overlays whose motifs occur on the displayed board.
- Keep the Pattern Engine page usable even when `furniture-lab.html` has never been opened.

## Minimal User Flow

1. In Pattern Engine, click a motif card's `→ Furniture`.
2. Furniture Lab opens with that motif loaded.
3. User runs layout generation.
4. User clicks `Apply to Pattern Board` on one layout.
5. User returns to Pattern Engine.
6. With motif overlay enabled, the board shows:
   - existing motif occurrence marks
   - furniture layout drawn inside each matching motif occurrence
