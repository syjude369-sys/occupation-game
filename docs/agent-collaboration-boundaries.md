# Agent Collaboration Boundaries

This project may receive rule documents from GPT while Codex and Claude Code work on different implementation areas.

The goal is to reduce merge conflicts and conceptual drift.

## Active App

Work only in:

```text
base-gameboard-pattern-engine
```

Current URL:

```text
http://127.0.0.1:5178/
```

Do not modify preserved app versions unless the user explicitly asks.

## Rule Document Folders

Use markdown as the cross-agent contract.

```text
docs/furniture-rules/
  GPT-authored furniture, Metric Handbook, CAD mapping, layout scoring rules

docs/simulation-rules/
  GPT-authored base simulation, genome, turn logic, board setup rules
```

Rule docs are upstream specifications. Code changes should cite which document they implement.

## Ownership Boundaries

### Simulation Owner

Primary files:

```text
base-gameboard-pattern-engine/form-simulation.js
base-gameboard-pattern-engine/form-simulation.test.mjs
base-gameboard-pattern-engine/form-simulation-checkpoints.test.mjs
base-gameboard-pattern-engine/territory.js
base-gameboard-pattern-engine/territory.test.mjs
```

Likely future files:

```text
base-gameboard-pattern-engine/simulation-rules.js
base-gameboard-pattern-engine/simulation-rules.test.mjs
base-gameboard-pattern-engine/simulation-genome.js
base-gameboard-pattern-engine/simulation-genome.test.mjs
```

Responsibilities:

- board setup
- turn order
- expansion/movement rules
- attack/conflict rules
- cell caps
- deterministic seed behavior
- checkpoint state production
- genome fields related to simulation behavior

Do not place furniture or interpret motif quality here.

### Pattern/Motif Owner

Primary files:

```text
base-gameboard-pattern-engine/pattern-engine.js
base-gameboard-pattern-engine/pattern-engine.test.mjs
base-gameboard-pattern-engine/motif-engine.js
base-gameboard-pattern-engine/motif-engine.test.mjs
```

Responsibilities:

- checkpoint pattern extraction
- exact `O/E` motif identity
- canonical rotation/reflection
- nested suppression
- recurrence
- distinctiveness
- symmetry
- void classification
- motif occurrence matching and overlay support

Do not change base simulation rules here.
Do not place furniture here.

### Furniture Owner

Likely future files:

```text
base-gameboard-pattern-engine/furniture-catalog.js
base-gameboard-pattern-engine/furniture-catalog.test.mjs
base-gameboard-pattern-engine/furniture-layout-engine.js
base-gameboard-pattern-engine/furniture-layout-engine.test.mjs
base-gameboard-pattern-engine/assets/furniture/
```

Responsibilities:

- furniture asset metadata
- CAD/source mapping
- furniture sets
- placement candidates
- collision and clearance checks
- internal circulation validation
- capacity/program scoring
- furniture validation results attached to motifs

Do not alter raw motif boundaries.
Do not alter base simulation rules.

### UI/Storage Integration Owner

Shared files:

```text
base-gameboard-pattern-engine/lab-app.js
base-gameboard-pattern-engine/index.html
base-gameboard-pattern-engine/style.css
base-gameboard-pattern-engine/storage.js
base-gameboard-pattern-engine/storage.test.mjs
```

These files are high-conflict.

Rules:

- avoid editing them during pure engine work
- integrate only after the relevant pure module tests pass
- keep UI patches narrow
- record the module contract before changing storage schema
- run all tests after touching storage or `lab-app.js`

## Conflict Avoidance Rules

1. One agent owns one module area at a time.
2. Do not edit `lab-app.js` while another agent is changing simulation or furniture core unless the user explicitly coordinates it.
3. GPT rule docs should be committed or pasted before code implementation starts.
4. Add or update tests in the same module as the implementation.
5. Preserve public function contracts used by other modules.
6. If a rule doc requires changing a shared schema, write the schema change into markdown before editing code.
7. Do not silently reinterpret older saved data. Add migration tests.

## Suggested Patch Order When Both Simulation And Furniture Are Active

Use this order to keep conflicts low:

```text
1. GPT writes/updates simulation rule markdown
2. Implement simulation pure module changes and tests
3. Keep pattern-engine adapter stable by preserving checkpoint output shape
4. GPT writes/updates furniture rule markdown
5. Implement furniture pure module changes and tests
6. Add storage fields for simulation/furniture metadata in one deliberate migration patch
7. Add UI controls and overlays last
```

## Stable Checkpoint Contract

Simulation changes should preserve this concept even if internals change:

```js
{
  turn,
  state: {
    size,
    cells
  }
}
```

Pattern discovery depends on checkpoint board states. If simulation rules change, avoid breaking this output without updating pattern tests.

## Stable Motif Contract

Furniture changes should consume motifs through a normalized adapter rather than reading every motif field directly.

Minimum stable concept:

```js
{
  id,
  signature,
  width,
  height,
  cells,
  source
}
```

Where cells preserve:

- `O` occupied
- `E` internal empty

Legacy numeric motifs must be normalized by the furniture module or an adapter.

## Required Verification

After any simulation, pattern, furniture, storage, or UI patch:

```powershell
cd D:\3-1\디디3\DD3 Codex\base-gameboard-pattern-engine
node --test *.test.mjs
```

After touching `lab-app.js`:

```powershell
node --check .\lab-app.js
```

After UI changes:

Verify in the browser:

```text
http://127.0.0.1:5178/
```

