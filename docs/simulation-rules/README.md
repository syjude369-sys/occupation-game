# Simulation Rules Document Drop Zone

This folder stores GPT-authored base simulation rule documents.

These documents are meant to be implemented by Codex or another coding agent without interfering with furniture-layout work.

Recommended document sequence:

```text
001-base-simulation-rules.md
002-genome-schema.md
003-turn-and-conflict-rules.md
004-checkpoint-output-contract.md
005-storage-and-ui-requirements.md
```

## What Belongs Here

Use markdown files here for:

- board setup rules
- valid/invalid/void cell behavior
- turn order
- expansion modes
- attack/conflict rules
- cell cap rules
- protected cell rules
- genome fields
- mutation and crossover behavior
- deterministic seed requirements
- checkpoint output shape
- UI controls
- storage migration requirements
- tests expected for the simulation engine

## What Does Not Belong Here

Do not define:

- motif score
- furniture placement rules
- CAD asset mapping
- Metric Handbook clearance rules
- furniture fitness scoring

Those belong in:

```text
docs/furniture-rules/
```

Pattern extraction rules belong in:

```text
docs/next-session-pattern-engine-handoff.md
C:/Users/User/Downloads/codex_pattern_discovery_patch_brief.md
```

## Stable Contract For Pattern Discovery

Even if the simulation rules change, the pattern engine should continue to receive checkpoint board states in this conceptual shape:

```js
{
  turn,
  state: {
    size,
    cells
  }
}
```

If a simulation rule document requires changing that shape, document the adapter and update pattern-engine tests in the same patch.

## Conflict Avoidance

Simulation implementation should primarily touch:

```text
base-gameboard-pattern-engine/form-simulation.js
base-gameboard-pattern-engine/form-simulation.test.mjs
base-gameboard-pattern-engine/form-simulation-checkpoints.test.mjs
base-gameboard-pattern-engine/territory.js
base-gameboard-pattern-engine/territory.test.mjs
```

Avoid touching furniture files:

```text
base-gameboard-pattern-engine/furniture-layout-engine.js
base-gameboard-pattern-engine/furniture-catalog.js
base-gameboard-pattern-engine/assets/furniture/
```

Avoid touching shared UI/storage files until the pure simulation tests pass.

