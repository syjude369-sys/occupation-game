# Next Session Handoff: Pattern Engine Reset for Occupation Game

## Purpose

This document is the handoff for the next coding session.

The project is moving from a game-simulation prototype toward an architectural form-finding workflow:

```text
Simulation Rules
  -> Board states over time
  -> Pattern Discovery
  -> Discovered Motifs
  -> User-selected Fitness Motifs
  -> Furniture / Program Validation
  -> Evolutionary Fitness
  -> New simulation-rule populations
```

The next implementation should not continue expanding the current app in-place. Instead, preserve the current app and create a new experimental copy.

## Current Active App To Preserve

Current active version:

- App folder: `base-gameboard-motif-lab`
- URL: `http://127.0.0.1:5177/`

Older preserved versions:

- `base-gameboard`
- `base-gameboard-territory`
- `base-gameboard-form-finding`

Do not overwrite these versions.

## Recommended Next App

Create a copied experimental version:

- Suggested folder: `base-gameboard-pattern-engine`
- Suggested URL/port: `http://127.0.0.1:5178/`

Use the existing `5177` app as a starting shell because it already has:

- local server structure
- board rendering
- generation/archive flow
- seeded simulation loop
- JSON import/export
- localStorage persistence pattern
- Node test setup

However, the existing motif/discovery internals should be treated as replaceable.

## Strategic Decision

Do not rebuild the full app from scratch.

Recommended approach:

```text
Copy 5177
  -> keep UI/server/storage/test scaffolding
  -> replace pattern discovery and motif archive logic
  -> keep simulation engine only as a producer of checkpoint board states
```

In other words:

- reuse the app shell
- rewrite the pattern engine
- keep the raw simulation and future furniture engine separate

## Main Reference Documents

External reference docs supplied by the user:

- `C:/Users/User/Downloads/codex_pattern_discovery_patch_brief.md`
- `C:/Users/User/Downloads/occupation_game_multi_page_workflow_handoff.md`

Existing project handoff:

- `docs/gpt-handoff-current-work.md`

The detailed pattern-discovery behavior should follow `codex_pattern_discovery_patch_brief.md` unless the user later provides a revised version.

## Updated User Decisions

### Manual Motif Editor

The old manual four-state motif editor should be removed or disabled for the new version.

Previous manual motif states:

- ignore
- required occupied
- optional occupied
- required empty

These are no longer the main workflow.

The new workflow is:

```text
discovered exact O/E pattern
  -> user reviews it
  -> user promotes/activates it as a motif
  -> user chooses whether it affects fitness
```

If a manual editor is needed again later, the user will request it.

### Discovered vs Motif Library

Terminology:

- `Discovered`: automatically detected valid patterns.
- `Motif Library`: user-selected patterns promoted from `Discovered`.
- `Fitness Active`: a motif-library item only affects evolution when this is enabled.

Archive membership does not automatically mean fitness influence.

### Automatic Pattern Cell States

Automatic motifs use exact binary states inside the extracted boundary:

- `O`: occupied
- `E`: empty inside the extracted region

Do not absorb exterior adjacent empty cells into the motif.

Exterior empty cells are inspected only for:

- accessibility
- boundary contrast
- boundary closure
- later furniture metadata

### External Accessibility

A discovered candidate is valid if it has access to either:

- an outside-the-motif empty-cell network, or
- the outside-board circulation band.

Use orthogonal adjacency only. Diagonal-only contact does not count.

### Nested Suppression

If a smaller candidate and a larger candidate both satisfy all pattern conditions at the same board and checkpoint, and the smaller occurrence is fully contained inside the larger occurrence, keep the larger one as the representative occurrence.

Important:

- this applies only when both are valid patterns
- compare actual covered board coordinates, not just bounding-box size
- the smaller motif can still be valid elsewhere if it appears independently

### Temporal Episodes

The same canonical motif at the same board placement across consecutive search checkpoints is one continuing episode.

Store:

- `detectionCount`
- `episodeCount`
- `durationSteps`
- `firstSeenTurn`
- `lastSeenTurn`

Use `episodeCount` for recurrence fitness by default, not raw detection count.

### Recurrence Weights

The recurrence score has three user-adjustable components:

- `withinBoard`
- `crossSeed`
- `crossGenome`

Each must be stored separately and weighted through UI controls.

Suggested defaults:

- within-board: `0.30`
- cross-seed: `0.40`
- cross-genome: `0.30`

Normalize or clearly display weights if they do not sum to `1`.

## Performance Expectation

The user can tolerate around 30 seconds of loading/computation for a meaningful generation or discovery pass.

Still avoid unbounded search.

Reasonable first defaults:

- search interval: every `5` turns
- always search final turn
- sliding windows: `2x2`, `3x3`, `4x4`, `5x5`
- occupancy ratio range: `0.20` to `0.80`
- region-based discovery enabled, but with a maximum bounding-box area or cell count
- show progress during long generation/discovery runs

## Desired Patch Order

### Patch 1: Isolated Copy

Create:

- `base-gameboard-pattern-engine`
- port `5178`

Preserve `5177`.

### Patch 2: Simulation Checkpoints

Extend the simulation layer so it can return board states at:

- every configurable interval
- final turn

Do not redesign the simulation rules yet. Future simulation rules will come from separate ChatGPT documents.

### Patch 3: New Pattern Engine Core

Create a new module, for example:

- `pattern-engine.js`

It should handle:

- interval search input
- sliding-window extraction
- region-based extraction
- exact O/E pattern identity
- external accessibility gate
- canonical rotation/reflection identity
- symmetry detection
- nested suppression
- temporal episode tracking
- recurrence aggregation hooks
- distinctiveness scoring
- void classification

### Patch 4: Discovered Pattern UI

Replace the old discovered workflow with:

- discovered patterns list
- method badges
- score breakdown
- recurrence breakdown
- symmetry/void/accessibility metadata
- show-on-board overlay
- promote/add-to-motif-library action

### Patch 5: Motif Library and Fitness Active

Motif Library should contain promoted discovered patterns.

Each motif should expose:

- `Fitness Active`
- total motif score
- score breakdown
- recurrence data
- future furniture status placeholder

Only `fitnessActive === true` affects evolutionary fitness.

### Patch 6: Evolution Fitness Integration

Connect active motifs to candidate scoring.

Keep existing evolution mechanics if possible:

- candidate archive
- parent pinning
- exclusion
- crossover
- mutation

But compute motif fitness using the new pattern archive data.

### Patch 7: Furniture Stub

Do not implement furniture placement yet.

Attach a stable placeholder:

```js
{
  status: "not_tested",
  scenarios: [],
  internalCirculationValid: null,
  plantingZones: [],
  serviceZones: [],
  score: null
}
```

Furniture logic will come from a later rules document.

## Claude Code Collaboration Workflow

The user may also work with Claude Code. To avoid confusion between Codex, ChatGPT, and Claude Code, use a document-based workflow.

### Recommended Roles

ChatGPT:

- creates and revises design rules
- writes conceptual rule documents
- proposes scoring definitions
- helps interpret architectural meaning

Codex:

- implements code locally
- runs tests
- starts local servers
- verifies UI and behavior
- maintains project handoff docs

Claude Code:

- can implement isolated modules
- can review or refactor specific files
- can write tests against a clearly defined module contract
- should not make broad architecture changes without a handoff doc

### Source-of-Truth Files

Use markdown files as contracts.

Recommended shared docs:

- `docs/next-session-pattern-engine-handoff.md`
- future `docs/pattern_engine_spec.md`
- future `docs/simulation_ruleset_spec.md`
- future `docs/furniture_engine_ruleset.md`
- future `docs/occupation_game_integrated_implementation_plan.md`

When ChatGPT or Claude Code proposes a rule change, capture it in markdown before implementation.

### Suggested Claude Code Task Format

Give Claude Code narrow module tasks, for example:

```text
Implement and test only pattern-engine.js functions:
- extractSlidingWindows
- extractRegionMotifs
- canonicalizeBinaryPattern
- suppressNestedOccurrences

Do not edit UI files.
Do not change storage schema.
Return tests and a short handoff summary.
```

Good task boundaries:

- pure pattern extraction
- canonicalization
- recurrence aggregation
- scoring functions
- storage migration tests

Avoid asking Claude Code for:

- broad UI redesign
- simultaneous simulation + pattern + furniture changes
- changes across all engines without a written integration plan

### Handoff After Claude Code Work

After Claude Code changes code, ask it to produce:

```text
changed files
new public functions
test commands run
known limitations
next integration step
```

Then paste that into the Codex session before continuing.

### Conflict Avoidance

Best practice:

- one agent owns one module at a time
- no two agents edit the same file concurrently
- preserve previous app versions before major changes
- add tests before connecting modules to UI/evolution
- update handoff docs after each meaningful patch

## Testing Expectations

Add tests before connecting new behavior to UI.

Required test areas:

- interval and final-turn search
- sliding-window extraction
- all-empty and overfilled rejection
- region extraction with internal empty cells
- exterior empty cells not absorbed
- external accessibility gate
- rotation/reflection canonicalization
- symmetry detection
- nested suppression
- temporal episode tracking
- recurrence aggregation
- distinctiveness score normalization
- void classification
- promotion to motif library
- Fitness Active controlling fitness contribution
- storage migration
- JSON export/import round trip

Also run:

- all Node tests
- JavaScript syntax checks
- local HTTP checks for `5178`
- manual browser review

## Next Session Starting Prompt

Use this prompt to start the next Codex session:

```text
Read docs/next-session-pattern-engine-handoff.md and the two downloaded reference docs:
- C:/Users/User/Downloads/codex_pattern_discovery_patch_brief.md
- C:/Users/User/Downloads/occupation_game_multi_page_workflow_handoff.md

Create a new preserved-copy app from base-gameboard-motif-lab to base-gameboard-pattern-engine on port 5178.
Do not modify 5177.
Start with the simulation checkpoint and pattern-engine core patches.
Use tests-first for the pure pattern-engine functions.
```

## Important Reminder

The next session should not begin by implementing furniture placement.

The immediate priority is:

```text
checkpoint board states
  -> robust pattern discovery
  -> discovered pattern archive
  -> Fitness Active motif connection
```
