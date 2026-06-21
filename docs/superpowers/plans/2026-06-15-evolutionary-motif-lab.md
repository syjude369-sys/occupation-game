# Evolutionary Motif Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a separate persistent evolutionary Form Finding application with editable weighted motifs, bounded automatic pattern discovery, dynamic Pareto objectives, and multi-generation archives.

**Architecture:** Copy the Phase 1 Form Finding app to port 5177. Add pure modules for motif matching/discovery, evolutionary operators and dynamic dominance, and versioned persistence; connect them through a dedicated application UI with board, archive, motif library, discovery view, and four-state editor.

**Tech Stack:** Browser JavaScript modules, SVG, localStorage, Node built-in test runner, local Node HTTP server.

---

### Task 1: Isolated Application

**Files:**
- Create: `base-gameboard-motif-lab/`
- Modify: `base-gameboard-motif-lab/server.mjs`

- [ ] Copy `base-gameboard-form-finding`.
- [ ] Change the default server port to `5177`.
- [ ] Verify ports 5174 through 5176 remain untouched.

### Task 2: Motif Engine

**Files:**
- Create: `base-gameboard-motif-lab/motif-engine.js`
- Create: `base-gameboard-motif-lab/motif-engine.test.mjs`

- [ ] Test strict empty cells, partial completion, transformed orientations, frontage, greedy non-overlap, weighted fitness, and bounded discovery.
- [ ] Verify RED because the module is absent.
- [ ] Implement motif normalization, matching, allocation, fitness, and sampled discovery.
- [ ] Verify GREEN.

### Task 3: Evolution and Objectives

**Files:**
- Create: `base-gameboard-motif-lab/evolution.js`
- Create: `base-gameboard-motif-lab/evolution.test.mjs`

- [ ] Test enabled-objective dominance, crossover bounds, mutation bounds, elite retention, parent lineage, and archive growth.
- [ ] Verify RED.
- [ ] Implement generation creation and dynamic Pareto filtering.
- [ ] Verify GREEN.

### Task 4: Persistence

**Files:**
- Create: `base-gameboard-motif-lab/storage.js`
- Create: `base-gameboard-motif-lab/storage.test.mjs`

- [ ] Test default schema, serialization, invalid-data recovery, and bounded archive retention.
- [ ] Implement versioned state normalization suitable for localStorage and JSON import/export.
- [ ] Verify GREEN.

### Task 5: Motif Lab Interface

**Files:**
- Replace: `base-gameboard-motif-lab/index.html`
- Replace: `base-gameboard-motif-lab/style.css`
- Create: `base-gameboard-motif-lab/lab-app.js`

- [ ] Add generation controls with default cell cap 25 and occupancy warning.
- [ ] Add configurable objective toggles.
- [ ] Add persistent candidate archive and next-generation controls.
- [ ] Add motif library and discovered-pattern views.
- [ ] Add a four-state motif editor with weight and completion controls.
- [ ] Add automatic save plus JSON import/export/reset.

### Task 6: Verification

- [ ] Run every Node test and syntax check.
- [ ] Start `http://127.0.0.1:5177/`.
- [ ] Verify ports 5174 through 5177 return HTTP 200.
- [ ] Run a small two-generation command-line integration sample.
- [ ] Verify motif promotion, weighted scoring, and archive continuation through pure-module integration.

