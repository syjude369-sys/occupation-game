# Claude Handoff: Furniture Layout Engine for Pattern Motifs

## Read This First

This document is the handoff for Claude Code. It is intentionally scoped so Claude does not need the full project workflow explained again.

Active implementation target:

- App folder: `base-gameboard-pattern-engine`
- URL: `http://127.0.0.1:5178/`
- Do not edit or overwrite `base-gameboard-motif-lab` on port `5177`.

Main project references already supplied by the user:

- `docs/next-session-pattern-engine-handoff.md`
- `docs/agent-collaboration-boundaries.md`
- `C:/Users/User/Downloads/codex_pattern_discovery_patch_brief.md`
- `C:/Users/User/Downloads/occupation_game_multi_page_workflow_handoff.md`

The current work is the next stage after pattern discovery:

```text
promoted motif
  -> furniture-layout interpretation
  -> layout alternatives
  -> furniture/program score
  -> motif metadata and optional fitness contribution
```

Do not redesign the simulation workflow, pattern-discovery workflow, or motif archive workflow. Assume those exist and focus on finding furniture layouts that fit discovered/promoted motifs.

Note: the base simulation logic may also change through separate GPT-authored markdown files under `docs/simulation-rules/`. Furniture work should avoid simulation files and should not require simulation-rule edits.

## Current State To Preserve

The 5178 app already has:

- simulation checkpoints
- pattern discovery
- discovered motif promotion
- motif archive
- `Fitness Active`
- pattern-reading fitness weights
- nested pattern handling
- motif overlay on the actual board/archive/checkpoint where the pattern is found

Recent validation:

```powershell
cd D:\3-1\디디3\DD3 Codex\base-gameboard-pattern-engine
node --test *.test.mjs
```

Expected status before new work: all existing tests should pass.

## Claude's Task

Claude should implement the furniture-layout engine as an additive module, driven by markdown rule documents produced through GPT.

Claude is not responsible for inventing the final architectural rule logic from scratch. Claude should:

1. Read this handoff.
2. Read the GPT-authored furniture rules under `docs/furniture-rules/`.
3. Inspect the existing code.
4. Implement pure, testable layout functions first.
5. Integrate into the 5178 UI only after the core tests pass.

## Role Of GPT Documents

Furniture rules will be authored outside the codebase through GPT and delivered as markdown.

Treat those markdown files as rule contracts. They may define:

- furniture categories
- Metric Handbook-derived dimensions
- clearance requirements
- CAD/block metadata assumptions
- layout strategies
- scoring principles
- failure reasons
- program templates

Recommended location:

```text
docs/furniture-rules/
  README.md
  001-furniture-layout-rules.md
  002-metric-handbook-principles.md
  003-cad-source-mapping.md
```

If multiple rule documents conflict, stop and ask the user which rule wins. Do not silently choose.

Simulation-rule documents live separately in:

```text
docs/simulation-rules/
```

Do not use those documents to define furniture clearances, CAD mapping, or furniture scoring. Use them only to understand any changed checkpoint/motif source data shape if necessary.

## Motif Input Contract

Furniture placement receives a motif/pattern interpretation, not the raw whole simulation board.

Minimum input shape:

```js
{
  motifId,
  signature,
  width,
  height,
  cells,
  cellSizeMm,
  originX,
  originY,
  archiveCandidateId,
  representativeBoard,
  accessibleEdges,
  voidClassification,
  recurrence,
  distinctiveness,
  symmetry,
  source
}
```

Cell conventions:

- `O`: occupied cell inside the motif
- `E`: empty cell inside the motif
- legacy numeric motifs may still exist, so normalize them before furniture layout

Important:

- Preserve the raw motif boundary.
- Do not absorb adjacent exterior empty cells by default.
- Do not overwrite the motif's `O/E` cells with furniture data.
- Furniture output is interpretation metadata attached to the motif.

## Furniture Output Contract

The furniture engine should return several alternatives, not only one layout.

Suggested result shape:

```js
{
  status: "not_tested" | "success" | "failure",
  programType,
  scenarios: [
    {
      id,
      label,
      score,
      capacity,
      entrance,
      furniture: [],
      circulation: [],
      plantingZones: [],
      serviceZones: [],
      unresolvedZones: [],
      failureReasons: []
    }
  ],
  bestScenarioId,
  internalCirculationValid,
  capacity,
  furnitureCoverage,
  plantingZones,
  serviceZones,
  unresolvedZones,
  score,
  failureReasons
}
```

Failure should be informative. Prefer:

```js
{
  status: "failure",
  failureReasons: [
    "no_valid_entrance",
    "desk_clearance_blocked",
    "circulation_disconnected"
  ]
}
```

over a bare `false`.

## CAD Source Strategy

The user wants the option to provide CAD sources and map them into motif-fitting layouts.

Recommended asset structure:

```text
base-gameboard-pattern-engine/
  assets/
    furniture/
      README.md
      metadata/
        furniture-catalog.example.json
      cad/
      svg/
      dxf/
```

CAD source should not be treated as semantic truth by itself. Each object or block needs metadata.

Suggested furniture asset metadata:

```js
{
  id,
  name,
  category,
  subtype,
  capacity,
  sourceFile,
  sourceBlockName,
  footprintMm,
  simplifiedPolygonMm,
  allowedRotations,
  clearanceZones,
  requiredAccessEdges,
  wallRequirement,
  preferredLocation,
  compatibleSets,
  tags,
  handbookReference
}
```

Supported CAD workflow should be staged:

1. Accept metadata JSON first.
2. Accept simplified SVG/DXF/polygon geometry second.
3. Treat `.3dm` or rich CAD files as source references unless a parser/export path is explicitly implemented.

Do not make runtime layout depend on a heavy CAD parser in the first patch.

## Metric Handbook Principle

Metric Handbook text should be used as dimensional and planning principles, not as a direct CAD library.

Use it to define:

- furniture footprint ranges
- clearance distances
- access widths
- aisle/circulation widths
- occupancy/capacity assumptions
- adjacency preferences
- service/storage placement constraints

Do not hardcode handbook-derived numbers without a source note in the markdown rule file or catalog metadata.

## First Implementation Boundary

Start with pure modules and tests.

Recommended files:

```text
base-gameboard-pattern-engine/
  furniture-layout-engine.js
  furniture-layout-engine.test.mjs
  furniture-catalog.js
  furniture-catalog.test.mjs
```

Suggested public functions:

```js
normalizeMotifForFurniture(motif, options)
loadFurnitureCatalog(rawCatalog)
validateFurnitureCatalog(catalog)
generateFurnitureLayoutCandidates(motif, catalog, rules, options)
scoreFurnitureLayout(layout, rules)
summarizeFurnitureValidation(layouts)
```

Keep DOM/UI integration out of the first test pass.

Do not edit these simulation-owned files during furniture core work:

```text
form-simulation.js
form-simulation.test.mjs
form-simulation-checkpoints.test.mjs
territory.js
territory.test.mjs
```

Treat these as shared/high-conflict files and defer edits until pure furniture tests pass:

```text
lab-app.js
index.html
style.css
storage.js
storage.test.mjs
```

## Layout Search Requirements

The first furniture solver should be deterministic.

It should:

- map motif cells into millimeter coordinates using `cellSizeMm`
- derive usable occupied zones and internal empty zones
- identify candidate entrances from accessible motif edges
- place furniture sets or assets according to rule documents
- test overlap
- test clearance
- test access from entrance to required furniture
- return multiple ranked alternatives

It should not:

- call an LLM at runtime for every motif
- mutate the motif boundary
- use exterior empty cells unless an explicit future expansion mode is requested
- silently ignore clearance failures
- add fitness contribution unless `Fitness Active` or a later furniture fitness toggle says so

## Furniture Sets Before Single Objects

Prefer furniture sets/templates over isolated object placement.

Examples:

```text
4-person work cluster
6-person meeting set
focus station
print/storage wall
pantry/service module
planted waiting pocket
```

A set should include:

- required furniture assets
- relative placement rules
- clearance rules
- access rules
- capacity
- preferred motif conditions

## UI Integration Target

Only after the pure engine passes tests, add a narrow UI integration.

Recommended UI behavior:

- each Motif Library item gets a furniture status summary
- user can run `Test Furniture` on one motif
- app stores the result on the motif
- board overlay can show the best scenario on the motif's actual discovered board/archive/checkpoint
- if CAD-derived geometry is unavailable, use simple rectangles/polygons from metadata

Do not build a broad new page first. Keep the first UI patch small and inspectable.

## Storage Guidance

Furniture results must be versioned and migration-safe.

Attach to motif metadata:

```js
furnitureValidation: {
  status: "not_tested",
  scenarios: [],
  bestScenarioId: null,
  internalCirculationValid: null,
  capacity: null,
  plantingZones: [],
  serviceZones: [],
  score: null,
  failureReasons: []
}
```

Do not store large CAD payloads in localStorage. Store IDs, lightweight geometry, or references.

## Tests Required Before UI

Add tests for:

- motif `O/E` normalization
- legacy numeric motif normalization
- catalog validation
- invalid asset metadata rejection
- cell-to-mm coordinate conversion
- collision detection
- clearance detection
- entrance detection
- path/circulation connectivity
- successful simple layout
- failed layout with useful failure reasons
- multiple alternatives ranked by score
- deterministic output for same input

After UI integration, run:

```powershell
node --check .\base-gameboard-pattern-engine\lab-app.js
cd .\base-gameboard-pattern-engine
node --test *.test.mjs
```

Then verify in the browser at:

```text
http://127.0.0.1:5178/
```

## Suggested Claude Starting Prompt

Use this prompt for Claude Code:

```text
Read docs/claude-furniture-layout-engine-handoff.md first.
Then read docs/agent-collaboration-boundaries.md.
Then read docs/furniture-rules/README.md and any rule docs in docs/furniture-rules/.

Work only in base-gameboard-pattern-engine on the 5178 app.
Do not modify base-gameboard-motif-lab or any 5177 files.
Do not edit simulation-owned files unless the user explicitly asks.

Implement the furniture layout engine tests-first.
Start with pure modules:
- furniture-catalog.js
- furniture-layout-engine.js
- matching *.test.mjs files

Do not do broad UI work until core tests pass.
Use Metric Handbook-derived rules only when they are captured in markdown or catalog metadata.
Preserve raw motif boundaries and attach furniture results as metadata.
```

## Known Caveat

Some old motif-library items may be source-less legacy motifs. Newly promoted discovered motifs preserve source archive/checkpoint data and are the better first target for furniture layout testing.
