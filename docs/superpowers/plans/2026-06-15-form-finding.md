# Cellular Automata Form Finding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate browser application that searches movement and attack weights, evaluates repeated seeded simulations on five independent objectives, and presents the Pareto frontier.

**Architecture:** Copy the preserved Territory application into `base-gameboard-form-finding` and remove Phase 1-excluded rules from its simulation path. Add pure modules for seeded simulation, spatial metrics, canonical pattern equivalence, random candidate generation, and Pareto filtering so the computational core can be tested outside the browser.

**Tech Stack:** Browser JavaScript modules, SVG, Node built-in test runner, local Node HTTP server.

---

### Task 1: Create Isolated Form Finding Application

**Files:**
- Create: `base-gameboard-form-finding/` from `base-gameboard-territory/`
- Modify: `base-gameboard-form-finding/server.mjs`
- Modify: `base-gameboard-form-finding/index.html`

- [ ] Copy the Territory application without modifying ports `5174` or `5175`.
- [ ] Change the copied server default to port `5176`.
- [ ] Rename visible application identity to `Base GameBoard · Form Finding`.
- [ ] Verify all three folders remain distinct.

### Task 2: Spatial Metrics and Pattern Canonicalization

**Files:**
- Create: `base-gameboard-form-finding/form-metrics.js`
- Create: `base-gameboard-form-finding/form-metrics.test.mjs`

- [ ] Write failing tests for continuity, multi-scale interpenetration, shared boundary, occupancy balance, rotations/reflections, player-label permutation, and pattern frequency.
- [ ] Run `node --test base-gameboard-form-finding/form-metrics.test.mjs` and confirm missing-module failure.
- [ ] Implement pure metric and canonicalization functions.
- [ ] Re-run tests and confirm all metric cases pass.

### Task 3: Search Engine and Pareto Frontier

**Files:**
- Create: `base-gameboard-form-finding/form-search.js`
- Create: `base-gameboard-form-finding/form-search.test.mjs`

- [ ] Write failing tests for normalized movement weights, deterministic candidate generation, repeated-seed aggregation, stability frequency, dominance, and Pareto filtering.
- [ ] Run the search tests and confirm missing behavior.
- [ ] Implement random search utilities and Pareto filtering.
- [ ] Re-run all tests.

### Task 4: Phase 1 Simulation Adapter

**Files:**
- Create: `base-gameboard-form-finding/form-simulation.js`
- Create: `base-gameboard-form-finding/form-simulation.test.mjs`
- Modify: `base-gameboard-form-finding/app.js`

- [ ] Write tests proving equal inputs and seed produce identical final states.
- [ ] Extract a pure final-state simulation using fixed equidistant seeds.
- [ ] Exclude pivot-door retention, Cluster Keep, and Territory Skip from the search simulation.
- [ ] Connect movement and attack weights to candidate evaluation.
- [ ] Run all tests.

### Task 5: Form Finding Interface

**Files:**
- Modify: `base-gameboard-form-finding/index.html`
- Modify: `base-gameboard-form-finding/style.css`
- Modify: `base-gameboard-form-finding/app.js`

- [ ] Add controls for candidate count, seeds per candidate, final turn, weight ranges, and Run/Stop.
- [ ] Add a Pareto results table with objective values, reproduction rate, and parameter values.
- [ ] Allow selecting a result to render its most frequent representative board.
- [ ] Show search progress and retain JSON export of candidate results.

### Task 6: Verification and New Link

**Files:**
- Verify: `base-gameboard-form-finding/`

- [ ] Run all Node tests and syntax checks.
- [ ] Start the server on `http://127.0.0.1:5176/`.
- [ ] Verify `5174`, `5175`, and `5176` all return HTTP 200.
- [ ] Run a small random search and confirm the Pareto frontier is non-empty.
- [ ] Verify selecting a candidate changes the rendered representative board.

