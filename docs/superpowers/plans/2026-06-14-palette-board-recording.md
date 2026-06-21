# Palette and Board Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Base GameBoard with the approved reference palette and add board-only WebM recording with a settings information bar.

**Architecture:** Keep the current static HTML/CSS/SVG application. Add a small pure recording utility module for deterministic metadata and format decisions, then connect it to a Canvas capture and MediaRecorder controller in `app.js`.

**Tech Stack:** HTML, CSS, browser SVG/Canvas APIs, MediaRecorder, Node built-in test runner.

---

### Task 1: Recording Utilities and Defaults

**Files:**
- Create: `base-gameboard/recording.js`
- Create: `base-gameboard/recording.test.mjs`
- Modify: `base-gameboard/app.js`

- [ ] Write tests asserting `17` grid cells, module multiplier `2`, metadata formatting, safe filenames, and supported WebM MIME selection.
- [ ] Run `node --test base-gameboard/recording.test.mjs` and confirm failure because the utility module is absent.
- [ ] Implement the utility functions and update application defaults.
- [ ] Re-run the test and confirm all cases pass.

### Task 2: Approved Palette

**Files:**
- Modify: `base-gameboard/style.css`
- Modify: `base-gameboard/app.js`

- [ ] Replace the dark theme with white, black, cyan, pink, and lilac tokens.
- [ ] Reduce SVG grid, ring, module, pivot, and guide stroke weights.
- [ ] Update player and legend colors to remain distinct on white.
- [ ] Run JavaScript syntax checks.

### Task 3: Board-Only Recording

**Files:**
- Modify: `base-gameboard/index.html`
- Modify: `base-gameboard/app.js`
- Modify: `base-gameboard/style.css`

- [ ] Add Record, Stop, and Download controls plus recording status.
- [ ] Serialize the rendered board SVG and paint it into a 1920x1080 canvas with a compact bottom information bar.
- [ ] Capture the canvas stream, start playback from turn 0, and stop automatically at the last turn.
- [ ] Preserve partial recordings when stopped manually and expose the resulting WebM download.
- [ ] Run unit and syntax checks.

### Task 4: Browser Verification

**Files:**
- Verify: `base-gameboard/index.html`

- [ ] Reload `http://127.0.0.1:5174/`.
- [ ] Confirm page identity, nonblank content, no framework overlay, and no relevant console errors.
- [ ] Confirm defaults are `17x17` and module `x2`.
- [ ] Exercise Record, observe playback and recording state, stop, and confirm Download becomes enabled.
- [ ] Capture desktop and mobile screenshots and compare the rendered palette to the approved thin-line concept.

