# Cellular Automata Form Finding Design

## Objective

Transform the existing game simulation into a separate form-finding system. The system searches for rule settings that repeatedly produce strong spatial patterns instead of optimizing for a game winner.

## Version Isolation

- Preserve the existing Base GameBoard at `http://127.0.0.1:5174/`.
- Preserve the Territory variant at `http://127.0.0.1:5175/`.
- Build Form Finding in a separate copied application and expose it through a new link.
- Do not modify the behavior of the two preserved versions.

## Phase 1 Scope

### Fixed Inputs

- N-by-N board geometry
- Player count
- Final evaluation turn N
- Existing approximately equidistant seed placement
- Identical rules and conditions for every player

### Search Variables

- Rook movement weight
- Bishop movement weight
- Knight movement weight
- Attack weight

Movement weights are normalized before simulation. Initial placement is not optimized in Phase 1, so the influence of the rule weights remains interpretable.

### Excluded Rules

- Pivot-door behavior
- Cluster Keep
- Territory Skip
- Door-opening cell retention

These rules remain available in preserved versions but do not participate in the first form-finding search.

## Randomness and Evaluation

Each candidate setting is evaluated across multiple deterministic random seeds. A setting is judged by its aggregate behavior rather than a single favorable run.

Only the final state at turn N is used for form comparison. Intermediate growth paths are retained only if needed for playback and debugging.

## Objective Axes

The system uses a Pareto frontier rather than one weighted total score.

### Continuity

For each player:

`largest orthogonally connected component / total occupied cells`

The candidate score aggregates the player values without rewarding one dominant player at the expense of the others.

### Multi-scale Interpenetration

Measure the coexistence of different players in local neighborhoods at multiple scales, initially 3x3, 5x5, and 7x7.

This rewards territories that penetrate one another while avoiding a preference for either branching forms or thick interwoven bands.

### Shared Boundary

Measure the proportion of orthogonal occupied-cell edges shared by different players.

### Occupancy Balance

Measure how evenly the final occupied cells are distributed between players. Lower variance produces a better score.

### Reproduction Stability

Compare final patterns after canonicalization. Report:

- Most frequent canonical pattern
- Number of occurrences
- Reproduction rate
- Number of distinct canonical patterns

High stability means that the same candidate setting repeatedly reaches an equivalent final form across seeds.

## Pattern Equivalence

Two final states are classified as the same pattern when they become identical after any combination of:

- 90-degree board rotations
- Horizontal, vertical, or diagonal reflections
- Player-label permutations when all affected players use identical rules

Every individual occurrence is still counted. Equivalence reduces the number of pattern classes but does not discard frequency information.

## Search Strategy

### Stage A: Random Search

Use random parameter sampling first to validate that the objective metrics reward the intended architectural qualities.

The result browser must expose the individual objective values and final boards so metric failures can be recognized visually.

### Stage B: Multi-objective Evolution

After metric validation, introduce an NSGA-II-style evolutionary search to refine the Pareto frontier.

Reinforcement learning is deferred because Phase 1 optimizes a small set of fixed rule parameters rather than learning per-turn actions.

## Result Presentation

Each Pareto candidate should show:

- Rule weights
- Number of evaluated seeds
- Five objective values
- Most frequent final pattern
- Reproduction count and rate
- Representative final boards from the repeated runs

Candidates remain separate when they make different tradeoffs between continuity, interpenetration, boundary, balance, and stability.

## Deferred Evaluation Axes

### Symmetry

Point, line, diagonal, and pinwheel symmetry are deferred until the first five objectives are validated.

### Loops

Exact, player-permutation, and approximate temporal loops require multi-turn state comparison and are deferred.

### Exterior Visibility

A future evaluation axis should measure whether each team's occupied region has an unobstructed visual connection toward the board exterior.

The later design must define:

- Whether visibility uses rook-like orthogonal rays, angular rays, or both
- Whether other cells belonging to the same team block sight
- Whether visibility is evaluated per cell, per connected component, or per player
- Whether one exterior opening is sufficient or multiple directional openings are rewarded

This axis is recorded now but intentionally excluded from Phase 1 scoring.

## Validation

- Unit tests for every objective metric
- Canonicalization tests for rotations, reflections, and player permutations
- Deterministic repeatability tests for seeded simulations
- Small exhaustive-board cases with manually verifiable scores
- Visual review of random-search Pareto candidates before adding NSGA-II

