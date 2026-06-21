# GPT Handoff: Cellular Automata Form Finding / Motif Lab

## Purpose

This project began as a web recreation of a Grasshopper Python gameboard generator and has evolved into a browser-based cellular-automata form-finding simulator for architectural spatial pattern exploration.

The current design direction is no longer only "simulate a game." It is to use modified cellular automata rules to generate, evaluate, and evolve spatial occupancy patterns. The user is interested in architectural readings of occupied cell configurations: long linear groups, rings around voids, cross-like groups, compact blocks with frontage, mixed territories, and other emergent patterns that may correspond to future programmatic spaces.

## Preserved Local Versions

Do not overwrite previous versions unless the user explicitly asks.

- Base GameBoard: `http://127.0.0.1:5174/`
  - Folder: `base-gameboard`
  - Main board simulator with grid, voids, module structure, pivot doors, player expansion, caps, recording.

- Territory Variant: `http://127.0.0.1:5175/`
  - Folder: `base-gameboard-territory`
  - Adds territory-skip behavior and configurable cluster keep.

- Form Finding Phase 1: `http://127.0.0.1:5176/`
  - Folder: `base-gameboard-form-finding`
  - Separate search-oriented version using final-state metrics and Pareto candidates.

- Evolutionary Motif Lab: `http://127.0.0.1:5177/`
  - Folder: `base-gameboard-motif-lab`
  - Current active experimental version.

## Original GameBoard Concepts

The board is based on an orthogonal N-by-N grid.

Important geometry controls:

- Grid size defaults to `17`.
- Grid span/cell size is adjustable in older versions.
- Module width is chosen as a multiple of the grid span; default module multiple is `2`.
- Outer catwalk was removed in the simplified version.
- Pivot doors are closed by default and open only when the adjacent inside cell directly in front of the door has been occupied for a threshold number of turns.
- Door visuals should behave like a real pivot-door plan symbol, not just a static rectangle.

Void behavior:

- User can remove rows/columns from selected sides.
- Void depth can differ by selected side.
- Void cells cannot be occupied.

Module behavior:

- Module structure appears outside the valid grid boundary, excluding corners.
- Module cells divide each side by the selected module multiple.
- If a side cannot be evenly filled by modules, remaining space is left empty.
- Empty remainder direction is controlled globally by clockwise/counterclockwise filling.

## Simulation Rules Before Form Finding

Players occupy grid cells and expand over turns.

Player behavior:

- Player count is configurable.
- Each player has a distinguishable color.
- Initial start points are approximately evenly spaced.
- Starts should be near the midpoint between the valid grid's center and perimeter, avoiding void cells.

Expansion modes:

- Rook: orthogonal movement candidates.
- Bishop: diagonal movement candidates.
- Knight: chess-knight movement candidates.
- Rook and Bishop candidates were increased from 8 to 12 nearest valid options.
- Knight remains 8 options.

Turn behavior:

- At each turn, each player gets expansion attempts equal to its current occupied cell count.
- Each attempt randomly chooses a movement mode according to user-adjustable weights.
- If no valid expansion target exists, that attempt does nothing.

Attack / stealing behavior:

- A player may steal an opponent cell only if conditions are satisfied.
- The attacking player must occupy a cell at an equal or shorter rook-distance to the target than the defending player.
- The attacking player must also have line-of-sight to the target along the target row or column without another opponent cell blocking the path.
- If attack probability triggers, the attacker expands into the opponent cell and the defender loses it.
- If attack probability does not trigger, opponent cells are excluded from normal expansion.

Cell cap behavior:

- Each player has an individual maximum occupied-cell cap.
- Default in later form-finding work is `25`.
- The cap should be low enough that even full-cap occupation by all players leaves meaningful empty space.
- When a player exceeds its cap, it may discard older/non-prioritized cells or skip expansion depending on settings.

Cell retention / cluster logic:

- Cells that opened pivot doors were previously prioritized for retention.
- Earlier cluster logic preserved 2x2 blocks, but this was later generalized to connected occupied groups of configurable size.
- These retained cells are not protected from being stolen by opponents. They only affect cap-discard behavior.

## Form Finding Shift

The user now wants to treat the simulation as a form-finding system, closer to Game of Life than to a competitive game.

The goal is not to find a winner. The goal is to find rule settings that produce spatially meaningful final occupancy patterns.

Important user decisions:

- Evaluate final results only, not the full intermediate sequence.
- Use the same rules for all players.
- If player labels differ but rule conditions are identical, player-label permutations can count as the same pattern.
- Individual occurrences still count even when patterns are considered equivalent.
- Stability is important.
- The user prefers design/spatial interpretation over pure game scoring.

Deferred but important future metric:

- Exterior visibility: evaluate whether each team's occupied region has unobstructed visibility/opening toward the exterior.

## Phase 1 Form Finding Metrics

Implemented in `base-gameboard-form-finding`.

Search variables:

- Rook movement weight.
- Bishop movement weight.
- Knight movement weight.
- Attack weight.

Excluded in Phase 1:

- Pivot doors.
- Cluster Keep.
- Territory Skip.
- Door-opening retention.

Metrics:

- Continuity: how much of each player's occupied area belongs to its largest orthogonal connected component.
- Multi-scale interpenetration: how much different players mix in local neighborhoods.
- Shared boundary: how much orthogonal adjacency exists between different players.
- Occupancy balance: how evenly occupied cell counts are distributed across players.
- Reproduction stability: how often repeated seeded runs produce equivalent final patterns.

Search method:

- Random search first.
- Pareto frontier rather than one weighted score.
- Reinforcement learning is deferred because the initial genome is small and rule-based.

## Evolutionary Motif Lab Direction

The current active version is `base-gameboard-motif-lab` at `http://127.0.0.1:5177/`.

This version answers the user's concern that running one optimization once only gives "one good variable set." Instead, it stores candidates, lets better or preferred candidates become parents, and develops new generations from the archive.

Core idea:

- Keep an archive of evaluated candidates.
- Generate new candidates from pinned/elite/Pareto parents.
- Use crossover and mutation to create next-generation rule settings.
- Preserve user-selected parents through `Pin parent`.
- Allow excluding candidates from parent selection without deleting historical records.

Genome:

- Rook weight.
- Bishop weight.
- Knight weight.
- Attack weight.

Default settings:

- Board size: `17`.
- Players: `4`.
- Turns: `30`.
- Per-player cell cap: `25`.
- Generation size: `12`.
- Evaluated seeds per candidate: `4`.
- Minimum discovered pattern size: `6`.
- Maximum discovered pattern size: `36`.

## Motif-Based Spatial Scoring

The user wants spatial pattern frequency to become a scoring basis.

Occupancy model:

- Motif analysis ignores player colors.
- Final board becomes occupied vs empty.
- Player colors remain available for continuity, mixing, boundary, balance, and future visibility metrics.

Motif cells have four states:

- Ignore.
- Required occupied.
- Optional occupied.
- Required empty.

Required-empty cells are strict:

- If a required-empty cell is occupied, that motif placement fails.

Partial score:

- Required and optional occupied cells contribute to completion.
- A motif can pass if completion is above its threshold.
- The user wanted partial scoring instead of all-or-nothing matching.

Equivalence:

- Rotations and reflections are treated as equivalent motif definitions.
- Occurrences are still counted.

Greedy allocation:

- Motif matches may not reuse occupied cells already assigned to another selected motif.
- Required-empty cells can overlap because they do not consume occupied cells.

Motif weights:

- Each motif has a user-defined weight.
- Positive weight rewards the motif.
- Negative weight penalizes it.
- Zero weight records it without affecting fitness.

Built-in examples:

- Four-cell line.
- Five-cell cross.
- 3x3 ring with required-empty center.
- 2x2 occupied block with frontage.

Special 2x2 frontage rule:

- A full 2x2 block is valid only when at least one side has two adjacent empty or outside-board cells.
- This allows compact 4-cell spaces to count only when they have meaningful empty frontage.

## Automatic Pattern Discovery

The system can discover recurring unnamed occupied patterns from final boards.

Discovery:

- Works on colorless occupied/empty fields.
- Uses connected occupied components and bounded local sampling.
- Canonicalizes patterns across rotations and reflections.
- Minimum occupied-cell size is configurable; default `6`.
- Maximum local pattern size is configurable; default `36`.
- Very large connected components are still recorded when meaningful.

The user can promote discovered patterns into the motif library, then edit their semantics and weights.

## Current User Interface

Main UI areas:

- Board settings and evolution settings.
- Objective toggles.
- Board preview.
- Candidate archive.
- Motif library.
- Discovered patterns.
- Motif editor.

Candidate actions:

- View: inspect representative board.
- Pin parent: force candidate to remain available as a parent for future generations.
- Unpin: return candidate to normal selection.
- Exclude: remove candidate from parent selection while keeping historical record.
- Include: allow excluded candidate to be considered again.

Motif editor:

- Paint cells as required occupied, optional occupied, required empty, or ignore.
- Set motif name, description, weight, completion threshold, and enabled state.
- Add row/column.
- Clear.
- Save to library.

Persistence:

- Uses versioned `localStorage`.
- Supports JSON export/import/reset.
- Auto-saves motif library, archive, objective states, settings, pins/exclusions, and selected candidate.

## Important File Map

Active app:

- `base-gameboard-motif-lab/index.html`
- `base-gameboard-motif-lab/style.css`
- `base-gameboard-motif-lab/lab-app.js`
- `base-gameboard-motif-lab/motif-engine.js`
- `base-gameboard-motif-lab/evolution.js`
- `base-gameboard-motif-lab/storage.js`
- `base-gameboard-motif-lab/form-simulation.js`
- `base-gameboard-motif-lab/form-metrics.js`
- `base-gameboard-motif-lab/form-search.js`
- `base-gameboard-motif-lab/server.mjs`

Tests:

- `base-gameboard-motif-lab/motif-engine.test.mjs`
- `base-gameboard-motif-lab/evolution.test.mjs`
- `base-gameboard-motif-lab/storage.test.mjs`
- Existing form and recording tests are also retained.

Design docs:

- `docs/superpowers/specs/2026-06-15-form-finding-design.md`
- `docs/superpowers/specs/2026-06-15-evolutionary-motif-lab-design.md`
- `docs/superpowers/plans/2026-06-15-evolutionary-motif-lab.md`

## Verification Status

Previously verified:

- Node tests passed for the motif lab modules and retained modules.
- Syntax checks passed for JavaScript files.
- HTTP 200 was verified for ports `5174`, `5175`, `5176`, and `5177`.
- A small integration sample confirmed generation, parent lineage, motifs, and discovery output.

Known limitation:

- In-app browser automation previously failed because the Windows sandbox could not start the browser-control runner. Manual browser review may still be needed for exact UI behavior.

## Open Design Questions / Next Good Steps

Likely next steps:

1. Improve motif editor quality.
   - Add rotate, reflect, crop, undo, redo.
   - Add live previews of unique motif orientations.

2. Improve motif fitness.
   - Make reproduction factor more explicit per motif across evaluated seeds.
   - Show motif contribution breakdown per candidate.

3. Improve discovered pattern workflow.
   - Add ranking controls: frequency, size, novelty, reproduction.
   - Add duplicate detection against existing library motifs.

4. Add spatial evaluation beyond motif frequency.
   - Exterior visibility / unobstructed visual access.
   - Empty-space ratio and mandatory void preservation.
   - Distribution of occupied mass around board center/perimeter.

5. Decide whether old Pareto axes remain.
   - The user has said the current Pareto axes may later be removed.
   - Motif-driven architectural scoring may become dominant.

6. Consider less-random rule variants.
   - Current stochastic expansion may make optimization noisy.
   - Future versions may use deterministic target selection or weighted heuristics to make form outcomes more controllable.

## Current Explanation of "Pin Parent"

`Pin parent` means the selected candidate is kept as a guaranteed parent source for the next generation, regardless of whether it is currently strong on the active Pareto objectives.

It is useful when the user visually likes a candidate's board pattern or motif behavior, even if the numeric scores do not fully capture that preference yet.

Pinned candidates:

- Stay in the parent pool.
- Can be crossed with other parents.
- Can produce mutated children.
- Are not automatically deleted or ignored by score changes.

`Unpin` returns the candidate to normal selection behavior.

`Exclude` is different: it removes the candidate from parent selection while preserving it in the archive as historical data.
