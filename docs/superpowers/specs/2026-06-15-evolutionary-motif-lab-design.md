# Evolutionary Motif Lab Design

## Objective

Create a new Form Finding variant that continuously develops better rule settings from previous results and evaluates the generated board as an architectural occupancy field.

The system must support:

- Multi-generation evolutionary search
- User-curated spatial motif library
- Automatic discovery of recurring unnamed patterns
- Editable motif definitions with partial scoring
- Configurable Pareto objectives
- Local automatic persistence and JSON backup

## Version Isolation

The new application is a separate copy with a new local link.

The following versions remain unchanged:

- Base GameBoard: `http://127.0.0.1:5174/`
- Territory: `http://127.0.0.1:5175/`
- Phase 1 Form Finding: `http://127.0.0.1:5176/`

The Evolutionary Motif Lab will use the next available port.

## Occupancy Model

Spatial motif analysis ignores player colors and converts each final board cell into:

- Occupied
- Empty

Player identity remains available only to objectives that require it, such as continuity, interpenetration, shared boundary, occupancy balance, and future team visibility.

The default per-player cell cap is `25`.

The interface must warn when:

`player count × cell cap >= valid board cell count`

The search may continue after the warning, but the default settings must always leave substantial empty space.

## Evolutionary Search

### Genome

Each candidate genome contains:

- Rook weight
- Bishop weight
- Knight weight
- Attack weight

Movement weights are normalized before simulation. Initial seed placement remains fixed and approximately equidistant.

### Generations

Generation 0 is created through random sampling.

Every later generation is created from the persistent archive through:

- Elite preservation
- Parent selection
- Arithmetic crossover
- Bounded mutation
- A small proportion of fresh random candidates

Each candidate records:

- Candidate ID
- Generation number
- Parent IDs
- Mutation record
- Genome
- Evaluated seeds
- Objective values
- Representative final board
- Pattern reproduction data
- Discovered motif data

### Archive

The archive retains non-dominated and behaviorally distinct candidates across generations. Starting a new generation does not discard previous candidates.

The user can:

- Continue evolution from the archive
- Start a new lineage
- Pin candidates as preferred parents
- Remove candidates from parent selection without deleting their historical record

This phase uses a Pareto archive with diversity preservation. A later MAP-Elites archive can reuse the same candidate schema.

## Configurable Objective Registry

Objectives are not hardcoded into Pareto dominance.

Each objective definition contains:

- Stable ID
- Display name
- Enabled state
- Evaluation function
- Optimization direction
- Display formatter

Initial objectives:

- Continuity
- Multi-scale interpenetration
- Shared boundary
- Occupancy balance
- Reproduction stability
- Motif fitness

Only enabled objectives participate in dominance and archive updates.

The first five objectives may later be disabled or removed without changing the evolution engine.

## Motif Definition

### Cell States

Each motif cell has one of four states:

- Ignore
- Required occupied
- Optional occupied
- Required empty

Required-empty cells are strict. If any required-empty cell is occupied, the motif match is rejected.

Required-occupied and optional-occupied cells contribute to completion:

`completion = matched target occupied cells / total target occupied cells`

Each motif has a configurable minimum completion threshold. Matches below the threshold are rejected.

### Equivalence

Rotations and reflections are considered the same motif definition.

Every spatial occurrence is still counted.

### Cropping

Empty outer rows and columns that contain only Ignore cells are removed automatically when saving a motif.

### Metadata

Each motif stores:

- Name
- Architectural program description
- Weight from `-100` to `100`
- Enabled state
- Minimum completion
- Creation source: manual, discovered, or built-in
- Cell-state matrix
- Creation and update timestamps

Positive weights reward a motif. Negative weights penalize it. Zero weight records the motif without affecting fitness.

## Built-in Motifs

The initial library includes editable examples:

- Four-cell line
- Five-cell cross
- 3x3 ring with required-empty center
- 2x2 occupied block with frontage

### 2x2 Frontage Rule

The 2x2 block is a special exception to the default discovered-pattern minimum size.

It is valid only when at least one of its four sides has two adjacent cells that are both empty or outside the valid board.

The two frontage cells are treated as a directional required-empty condition. Rotations are equivalent.

## Motif Matching and Allocation

### Candidate Matches

The matcher scans every valid placement and every unique rotation/reflection of each enabled library motif.

Candidate matches are ordered by:

1. Higher completion
2. Larger number of target occupied cells
3. Higher absolute motif weight
4. Stable spatial order

### Non-overlap

Selected motif matches may not reuse occupied cells already assigned to another selected motif.

Required-empty cells do not consume occupancy and may be shared.

This greedy allocation produces an interpretable count of spatial programs rather than counting every overlapping sub-pattern.

## Motif Fitness

For each selected occurrence:

`occurrence value = motif weight × completion`

Motif frequency uses diminishing returns:

`frequency factor = sqrt(occurrence count)`

Each motif also receives:

- Spatial distribution factor based on occurrence-center dispersion
- Reproduction factor based on the proportion of evaluated seeds containing the motif

The candidate motif fitness aggregates the enabled library:

`motif fitness = normalized sum(weight × mean completion × sqrt(count) × distribution × reproduction)`

The exact normalization must keep the objective within a stable numeric range and preserve negative penalties.

Motif fitness is one independent Pareto objective, not one objective per motif.

## Automatic Pattern Discovery

### Scope

Automatic discovery operates on the colorless occupied field.

Default settings:

- Minimum pattern occupied cells: `6`
- Maximum pattern occupied cells: `36`
- Both values are user-configurable

The system also records larger connected components without applying the maximum-size limit, so very large recurring forms can be discovered.

### Discovery Sources

The discovery engine extracts:

- Whole connected occupied components
- Local connected patterns around boundary cells
- Local connected patterns around branch cells
- Local occupied rings around empty cells

Local patterns may be subsets of a larger connected component.

### Computation Limits

The engine must not enumerate every connected subset.

It uses deterministic bounded sampling:

- Configurable samples per final board
- Configurable local window size
- Canonical deduplication within each board
- Hard cap on stored discovered signatures

The UI clearly labels discovery counts as sampled estimates rather than exact exhaustive frequencies.

### Discovered Pattern Identity

Discovered patterns:

- Ignore player labels
- Preserve occupied and internal empty cells inside their cropped bounding box
- Are canonicalized across rotations and reflections
- Store occurrence count, seed frequency, average size, average bounding dimensions, and representative board locations

Patterns can be promoted into the motif library.

## Motif Editor

The editor is a modal or dedicated inspector with:

- Resizable grid
- Four-state segmented cell tool
- Click-and-drag painting
- Clear, rotate, reflect, crop, undo, and redo
- Name and architectural description
- Weight input
- Minimum completion input
- Enabled toggle
- Live previews of every unique orientation

Cell states use distinct visual treatment:

- Required occupied: solid cyan
- Optional occupied: cyan hatch or lighter cyan
- Required empty: hot-pink outline with white center
- Ignore: pale neutral

A discovered pattern opens in the editor with occupied cells prefilled as Required occupied. The user can convert cells into Optional occupied or Required empty before saving.

## Library and Discovery Interface

The application adds two views:

### Motif Library

- Searchable motif list
- Preview
- Weight
- Completion threshold
- Enabled toggle
- Edit, duplicate, and delete
- Occurrence statistics across the current archive

### Discovered Patterns

- Ranked by occurrence frequency, seed reproduction, size, or novelty
- Minimum and maximum pattern size controls
- Representative pattern preview
- Promote-to-library command
- Ignore signature command

## Persistence

Use versioned `localStorage` records with separate keys for this application.

Persist:

- Motif library
- Ignored discovered signatures
- Objective enabled states
- Evolution settings
- Generation counter
- Candidate archive
- Parent pinning and exclusion
- Last selected candidate

Large representative boards and archive history are bounded by configurable retention limits.

Provide:

- Automatic save after meaningful state changes
- JSON export
- JSON import with schema validation
- Reset application data with explicit confirmation

If stored data is invalid or from an unsupported schema version, keep it untouched, load safe defaults, and show a recovery message.

## User Workflow

1. Configure board, cap, simulation, and discovery limits.
2. Select active objectives.
3. Create or edit motif weights.
4. Run Generation 0 or continue the current lineage.
5. Review Pareto candidates and representative boards.
6. Review discovered unnamed patterns.
7. Promote useful patterns into the motif library and edit their semantics.
8. Run the next generation using the updated motif fitness.
9. Repeat while the archive and lineage history accumulate.

## Deferred Objectives

The objective registry reserves future modules for:

- Symmetry
- Temporal loops
- Exterior visibility

Exterior visibility will later evaluate whether each team has unobstructed visual access toward the board exterior. Its ray directions, blockers, and aggregation level remain intentionally unspecified.

## Validation

### Unit Tests

- Four-state motif matching
- Strict required-empty rejection
- Partial completion
- Rotation and reflection equivalence
- 2x2 frontage rule
- Greedy non-overlap allocation
- Weighted motif fitness
- Bounded discovery and canonicalization
- Dynamic objective dominance
- Crossover and mutation bounds
- Archive continuation
- Storage schema migration and invalid-data recovery

### Integration Tests

- Promote discovered pattern to editor and library
- Change motif weight and observe changed motif fitness
- Disable an objective and observe changed Pareto frontier
- Run a second generation and verify parent IDs and archive growth
- Reload the page and verify automatic restoration
- Export, reset, import, and recover the same project state

### Performance Checks

- Default 17x17, 4 players, cap 25
- Discovery minimum 6 and maximum 36
- Bounded discovery must not freeze the interface
- Long-running evolution and discovery operations must yield to the browser and support Stop

