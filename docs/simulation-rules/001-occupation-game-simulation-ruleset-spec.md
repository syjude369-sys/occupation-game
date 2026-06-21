# Occupation Game — Simulation Ruleset Spec

**Target:** simulation engine  
**Style:** code-ready / caveman  
**Scope:** simulation only  
**Do not modify:** motif search rules, furniture rules, old app versions

---

# 0. Core

Not normal optimization.

One run means little.

```text
same genome
same board
many seeds
many trials
= one evaluation batch
```

Randomness stays.

Goal is not identical boards.

Goal:

```text
different random runs
→ repeated spatial tendency
→ repeated motif family
→ repeated persistence
```

One lucky run must not win.

---

# 1. Board

Cell state:

```ts
type CellKind =
  | "INVALID"
  | "EMPTY"
  | "OCCUPIED";
```

Occupied cell:

```ts
interface OccupiedCell {
  ownerId: string;
  graceRemaining: number;
  survivalFailureStreak: number;
}
```

Rules:

```text
INVALID
→ cannot occupy

EMPTY
→ valid target

OCCUPIED
→ owned by one team
```

Every turn reads one frozen state:

```text
S(t)
```

All changes apply together.

Then:

```text
S(t+1)
```

---

# 2. Expansion Neighborhood

Each occupied cell proposes maximum one target per turn.

Search area:

```text
5×5 around source
minus source
= 24 cells
```

24 cells split:

```text
Rook   = 8
Bishop = 8
Knight = 8
```

## Rook offsets

```text
(±1, 0)
(0, ±1)
(±2, 0)
(0, ±2)
```

## Bishop offsets

```text
(±1, ±1)
(±2, ±2)
```

## Knight offsets

```text
(±1, ±2)
(±2, ±1)
```

---

# 3. Survival Neighborhood

Survival does not use 24 cells.

Survival uses adjacent Moore cells only.

```text
8 adjacent cells
```

Summary:

```text
Expansion range = 24
Survival range  = 8
```

---

# 4. Genome

Genome uses clear discrete rules.

No continuous tendency weight.

```ts
interface SimulationGenome {
  movementMode: "ROOK" | "BISHOP" | "KNIGHT";
  distanceMode: 0 | 1;
  cohesionEnabled: 0 | 1;
  aggressionEnabled: 0 | 1;
}
```

Meaning:

```text
distanceMode
0 = near
1 = far
```

```text
cohesionEnabled
0 = no cohesion bonus
1 = cohesion bonus active
```

```text
aggressionEnabled
0 = no enemy-target bonus
1 = enemy-target bonus active
```

Movement mode is categorical.

Other behavior genes are 0/1.

---

# 5. Candidate Pipeline

For each occupied source:

```text
1. Generate 8 movement candidates
2. Use gate
3. Accessibility gate
4. Visibility gate
5. Candidate score
6. Select highest score
7. Exact top tie → random
```

No valid candidate:

```text
no proposal
```

---

# 6. Use Gate

Reject target when:

```text
outside board
INVALID / void
already occupied by same team
```

Allow target when:

```text
EMPTY
enemy OCCUPIED
```

Enemy target still needs Accessibility and Visibility.

---

# 7. Accessibility Gate

Accessibility uses:

```text
Manhattan distance
```

Formula:

```text
d = |x1 - x2| + |y1 - y2|
```

For source `s` and target `t`:

```text
selfDistance
=
Manhattan(s, t)
```

```text
enemyDistance
=
minimum Manhattan distance
from any opposing occupied cell
to t
```

Pass:

```text
selfDistance <= enemyDistance
```

Meaning:

```text
self closer  → pass
same distance → pass
enemy closer → fail
```

When target is enemy occupied:

```text
exclude target cell itself
from enemyDistance calculation
```

Otherwise:

```text
enemyDistance = 0
stealing impossible
```

If no other enemy cell exists:

```text
enemyDistance = Infinity
```

---

# 8. Visibility Gate

Visibility means isovist.

Test:

```text
source cell center
→ target cell center
```

Pass only if direct line is open.

Blockers:

```text
enemy occupied cell
INVALID / void cell
```

Not blockers:

```text
own occupied cell
target cell itself
```

Rules:

```text
arbitrary angle allowed
Rook/Bishop direction not required
Knight uses same isovist rule
```

Implementation:

```text
deterministic supercover grid traversal
```

No corner ambiguity.

---

# 9. Candidate Score

Only gate-passed targets receive score.

```text
Candidate Score
=
Distance Score
+ Cohesion Score
+ Aggression Score
```

Every component:

```text
0 or 1
```

No float tendency weight.

---

# 10. Distance Score

## Rook

```text
near = one-cell rook offsets
far  = two-cell rook offsets
```

## Bishop

```text
near = (±1, ±1)
far  = (±2, ±2)
```

Score:

```text
candidate matches distanceMode → 1
candidate does not match       → 0
```

## Knight

All knight targets are same tier.

```text
distanceMode ignored
Distance Score omitted
```

---

# 11. Cohesion Score

Check target's adjacent Moore 8 cells.

Exclude proposal source.

Condition:

```text
at least one other same-team occupied cell
adjacent to target
```

Score:

```text
cohesionEnabled = 1
AND condition true
→ Cohesion Score = 1
```

Otherwise:

```text
Cohesion Score = 0
```

Important:

```text
source alone does not count
```

Works for:

```text
near Rook
far Rook
near Bishop
far Bishop
Knight
enemy target
```

---

# 12. Aggression Score

Condition:

```text
target is enemy occupied
AND aggressionEnabled = 1
```

Then:

```text
Aggression Score = 1
```

Otherwise:

```text
Aggression Score = 0
```

Aggression OFF does not forbid attack.

It removes attack bonus only.

---

# 13. Candidate Tie Randomness

One highest candidate:

```text
select it
```

Many exact highest candidates:

```text
random among tied candidates
```

Randomness may happen often.

One trial is only one sample.

## Random key rule

Random decision must be replayable.

Random key must not depend only on absolute turn.

Reason:

```text
turn-based random key
→ same board can evolve differently
→ real loop detection breaks
```

Use:

```text
hash(
  trialSeed,
  preDecisionFullStateHash,
  decisionType,
  teamId,
  sourceCellId,
  sortedCandidateIds
)
```

For conflict tie:

```text
hash(
  trialSeed,
  preDecisionFullStateHash,
  "CONFLICT_TIE",
  targetCellId,
  sortedTeamIds
)
```

Same trial seed allows replay.

Different seeds may produce very different boards.

That is expected.

---

# 14. Same-Target Conflict

Several teams may claim same target.

Same-team proposals first merge:

```text
many source proposals
from same team
to same target
→ one team claim
```

Proposal count gives no hidden bonus.

Conflict priority:

```text
1. Accessibility
2. Visibility
3. Random
```

Accessibility has more power.

Not weighted sum.

Lexicographic priority.

---

# 15. Conflict Accessibility

For each competing team:

```text
teamDistance
=
minimum Manhattan distance
from that team's proposing sources
to target
```

Winner:

```text
smaller teamDistance
```

Example:

```text
Team A distance = 1
Team B distance = 2

Team A wins
```

Only if Accessibility tied:

```text
compare Visibility
```

---

# 16. Conflict Visibility

For each tied team:

Check local 5×5 area around target.

Count same-team occupied cells that have open isovist to target.

```text
visibleSupportCount
```

Winner:

```text
larger visibleSupportCount
```

If still tied:

```text
seeded random
```

Conflict rule:

```text
Accessibility
> Visibility
> Random
```

---

# 17. Survival Input

For each occupied cell:

```text
S = adjacent same-team occupied count
E = adjacent enemy occupied count
```

Adjacent means:

```text
Moore 8 cells
```

Effective support:

```text
effectiveSupport
=
S - enemyWeight × E
```

Default:

```text
enemyWeight = 1
```

---

# 18. Survival Minimum

Pass minimum rule when:

```text
effectiveSupport >= survivalMin
```

Default:

```text
survivalMin = 2
```

---

# 19. Survival Maximum

Default:

```text
enabled
```

Can be disabled.

```ts
survivalMaxEnabled = true;
```

Default value:

```text
survivalMax = 5
```

Pass maximum rule when:

```text
survivalMaxEnabled = false
OR
S <= survivalMax
```

Full survival pass:

```text
minimum pass
AND
maximum pass
```

---

# 20. Newborn Grace

New occupied cell needs settlement time.

Default:

```text
newbornGrace = 2 turns
```

During grace:

```text
cell remains occupied
cell may propose expansion
survival failure does not release cell
```

Grace countdown is part of full simulation state.

---

# 21. Release Delay

One failed survival test does not remove cell.

Default:

```text
releaseDelay = 2 consecutive failed turns
```

Logic:

```text
survival pass
→ survivalFailureStreak = 0
```

```text
survival fail
→ survivalFailureStreak += 1
```

```text
survivalFailureStreak >= releaseDelay
→ release occupation
```

Recovery resets streak.

Failure streak is part of full simulation state.

---

# 22. Dying Cell Still Acts

A cell scheduled to die still proposes expansion this turn.

```text
survival fail
≠ action cancelled
```

Order:

```text
cell acts
then simultaneous release applies
```

This is required.

---

# 23. Turn Order

Every turn:

```text
1. Freeze S(t)

2. Test survival for every occupied cell

3. Every occupied cell proposes expansion
   dying cells included

4. Apply Use gate

5. Apply Accessibility gate

6. Apply Visibility gate

7. Score candidates

8. Resolve candidate top ties

9. Merge same-team claims

10. Resolve team conflicts

11. Calculate survival losses

12. Calculate stealing losses

13. Apply cell-cap rule

14. Approve acquisitions

15. Apply every change together

16. Build S(t+1)

17. Update motif persistence hooks

18. Check termination
```

No mid-turn board mutation.

---

# 24. Cell Cap

Default:

```text
enabled
```

Can be disabled.

Default cap:

```text
25 cells per team
```

```ts
cellCapEnabled = true;
perTeamCellCap = 25;
```

---

# 25. Cell Cap — Same-Turn Overshoot

Cap is checked at turn start / projected availability.

If team starts turn below cap:

```text
all successful acquisitions
during that turn are approved
```

Even if final count becomes greater than 25.

Example:

```text
start = 24
successful acquisitions = 4
final = 28
```

All four approved.

No cutting inside that turn.

---

# 26. Cell Cap — Later Turns

If team starts turn at or above cap:

```text
no net growth
```

Losses may reopen slots.

Losses:

```text
cell stolen by enemy
survival release
```

Projected count:

```text
projectedAfterLoss
=
startCount - confirmedLosses
```

Available slots:

```text
availableSlots
=
max(0, cellCap - projectedAfterLoss)
```

Approve acquisitions up to available slots.

Example:

```text
start = 25
lose = 1
availableSlots = 1
```

Team may immediately replace lost cell in same turn.

Example:

```text
start = 28
lose = 5
projectedAfterLoss = 23
availableSlots = 2
```

Team may acquire 2.

Final returns to 25.

If cap disabled:

```text
all successful acquisitions approved
```

---

# 27. Pattern Engine Boundary

Simulation produces board states.

Pattern engine observes.

Pattern engine does not modify simulation.

```text
simulation produces
pattern engine observes
fitness evaluates
```

Discovered motif is not frozen on board.

Board keeps evolving.

Pattern may survive.

Pattern may collapse.

Both are valid data.

---

# 28. Motif Persistence

Persistence means:

```text
same absolute cells
same team
same occupied/empty mask
consecutive turns
```

Same form at another location:

```text
recurrence
not persistence
```

Track:

```ts
interface MotifPersistence {
  motifId: string;
  teamId: string;
  firstSeenTurn: number;
  lastSeenTurn: number;
  currentStreak: number;
  longestStreak: number;
  totalVisibleTurns: number;
  collapseCount: number;
}
```

Pattern search may run at configured intervals.

Already detected motif persistence must be checked every turn.

---

# 29. Persistence Bonus

Continuous survival length:

```text
L
```

Score:

```text
L(L + 1) / 2
```

Examples:

```text
1 turn  = 1
2 turns = 3
3 turns = 6
10 turns = 55
```

Broken streak:

```text
new streak
```

Default cap:

```text
persistenceCap = 20
```

Configurable.

Cross-trial recurrence uses canonical:

```text
rotation equivalent
reflection equivalent
```

Absolute-position persistence does not canonicalize location.

---

# 30. Termination Reasons

Every trial returns explicit reason.

```ts
type TerminationReason =
  | "MAX_TURNS"
  | "FIXED_POINT"
  | "LOOP"
  | "EXTINCTION";
```

Required output:

```text
terminationReason
terminationTurn
```

---

# 31. Max Turns

Default:

```text
maxTurns = 30
```

At turn 30:

```text
MAX_TURNS
```

---

# 32. Fixed Point

Fixed point:

```text
FullState(t) = FullState(t - 1)
```

Termination:

```text
FIXED_POINT
```

Fixed board is not failure.

It is stable occupation.

---

# 33. Loop

Loop:

```text
FullState(t) = FullState(t - k)
k >= 2
```

Termination:

```text
LOOP
```

Store:

```ts
interface LoopData {
  loopStartTurn: number;
  loopPeriod: number;
}
```

A period-1 loop is reported as:

```text
FIXED_POINT
```

---

# 34. Extinction

When:

```text
total occupied cells = 0
```

Termination:

```text
EXTINCTION
```

---

# 35. Full-State Hash

Do not compare visible owner colors only.

Hash every future-affecting value:

```text
cell ownerId
graceRemaining
survivalFailureStreak
all other runtime state
```

Also include board identity/config if hash is reused across trials.

Random tie key uses this hash.

Therefore:

```text
same full state
+ same trial seed
→ same next random decisions
```

Real loop detection works.

---

# 36. Early Termination Projection

Simulation may stop early.

Fitness horizon remains:

```text
maxTurns = 30
```

## Fixed point

Virtually repeat same state to turn 30.

## Loop

Virtually replay detected loop to turn 30.

Use virtual continuation for:

```text
motif persistence
motif recurrence
occupancy metrics
trial fitness
```

Keep original:

```text
termination reason
termination turn
loop data
```

---

# 37. Multi-Run Evaluation

Never evaluate genome from one run by default.

```text
one genome
→ many trials
→ one batch fitness
```

Default:

```text
runsPerGenome = 8
```

Configurable.

Recommended UI range:

```text
4 to 16
```

---

# 38. Shared Seed Set

All genomes in same generation use same ordered trial seeds.

```text
Genome A → [s1, s2, s3, ...]
Genome B → [s1, s2, s3, ...]
Genome C → [s1, s2, s3, ...]
```

Reason:

```text
compare rule
not luck
```

Seed set may change between generations.

Recommended:

```text
retain some seeds
replace some seeds
```

Reduces seed-set overfitting.

---

# 39. Trial Output

Each trial stores:

```ts
interface TrialResult {
  seed: number;

  trialFitness: number;

  terminationReason: TerminationReason;
  terminationTurn: number;

  loopStartTurn?: number;
  loopPeriod?: number;

  discoveredMotifs: unknown[];
  motifPersistence: unknown[];

  occupancyMetrics: unknown;
  conflictMetrics: unknown;
}
```

Keep every trial.

Do not keep best run only.

---

# 40. Batch Output

```ts
interface BatchResult {
  genomeId: string;

  runsPerGenome: number;
  trialSeeds: number[];

  meanTrialFitness: number;
  medianTrialFitness: number;
  trialFitnessStandardDeviation: number;

  bestTrialFitness: number;
  worstTrialFitness: number;

  successfulTrialRate: number;

  terminationReasonDistribution: Record<
    TerminationReason,
    number
  >;

  crossTrialMotifRecurrenceScore: number;

  batchFitness: number;

  trials: TrialResult[];
}
```

---

# 41. Batch Fitness

Normalize trial fitness and recurrence terms to:

```text
0 to 1
```

Default:

```text
batchFitness
=
meanTrialFitness
- 0.25 × trialFitnessStandardDeviation
+ 0.50 × crossTrialMotifRecurrenceScore
```

Defaults:

```ts
variancePenaltyWeight = 0.25;
recurrenceBonusWeight = 0.50;
```

Both configurable.

Meaning:

```text
one lucky result
→ weak

stable good results
→ strong

same motif family across seeds
→ bonus
```

---

# 42. Optimization Target

Not:

```text
same board every run
```

Target:

```text
similar relational behavior
similar motif families
long persistence
repeatable termination character
across different seeds
```

Randomness remains.

Batch measures robustness.

---

# 43. Default Config

```ts
const DEFAULT_SIMULATION_CONFIG = {
  runsPerGenome: 8,

  enemyWeight: 1,

  survivalMin: 2,
  survivalMaxEnabled: true,
  survivalMax: 5,

  newbornGrace: 2,
  releaseDelay: 2,

  cellCapEnabled: true,
  perTeamCellCap: 25,

  persistenceCap: 20,

  maxTurns: 30,

  variancePenaltyWeight: 0.25,
  recurrenceBonusWeight: 0.50,
};
```

---

# 44. Required Debug — Expansion

```ts
interface ExpansionProposalDebug {
  turn: number;

  teamId: string;
  sourceCellId: string;
  targetCellId: string;

  movementMode: "ROOK" | "BISHOP" | "KNIGHT";

  usePass: boolean;
  accessibilityPass: boolean;
  visibilityPass: boolean;

  distanceScore: 0 | 1;
  cohesionScore: 0 | 1;
  aggressionScore: 0 | 1;

  candidateScore: number;

  selected: boolean;
  topTieCount: number;
}
```

---

# 45. Required Debug — Survival

```ts
interface SurvivalDebug {
  turn: number;

  teamId: string;
  cellId: string;

  sameNeighbors: number;
  enemyNeighbors: number;

  effectiveSupport: number;

  minimumPass: boolean;
  maximumPass: boolean;

  inGrace: boolean;

  failureStreakBefore: number;
  failureStreakAfter: number;

  scheduledForRelease: boolean;
  proposedBeforeRelease: boolean;
}
```

---

# 46. Required Debug — Conflict

```ts
interface ConflictDebug {
  turn: number;
  targetCellId: string;

  competingTeams: string[];

  teamDistance: Record<string, number>;
  visibleSupportCount: Record<string, number>;

  accessibilityWinnerIds: string[];
  visibilityWinnerIds: string[];

  resolvedBy:
    | "ACCESSIBILITY"
    | "VISIBILITY"
    | "RANDOM";

  winnerTeamId: string;
}
```

---

# 47. Required Debug — Termination

```ts
interface TerminationDebug {
  reason: TerminationReason;
  turn: number;

  loopStartTurn?: number;
  loopPeriod?: number;

  fullStateHash: string;
}
```

---

# 48. Required Tests

## Movement

```text
Rook offsets = 8
Bishop offsets = 8
Knight offsets = 8
union = 24
no duplicate
```

## Use

```text
outside rejected
INVALID rejected
own occupied rejected
EMPTY allowed
enemy occupied allowed
```

## Accessibility

```text
Manhattan only
self closer passes
same distance passes
enemy closer fails
enemy target excluded from enemy distance
```

## Visibility

```text
clear isovist passes
enemy blocker fails
INVALID blocker fails
own cell does not block
target does not block
corner traversal deterministic
```

## Distance

```text
Rook near/far correct
Bishop near/far correct
Knight ignores distanceMode
```

## Cohesion

```text
source alone = 0
one other adjacent ally = 1
enemy neighbor does not count
```

## Aggression

```text
enemy + enabled = 1
enemy + disabled = 0
empty = 0
```

## Candidate Tie

```text
only top candidates enter random
same trial seed replays
different seeds may diverge
```

## Conflict

```text
Accessibility beats Visibility
Visibility used only after Accessibility tie
random used only after both tie
```

## Survival

```text
minimum works
maximum ON works
maximum OFF works
enemy pressure works
grace works
release delay works
recovery resets streak
dying cell still proposes
```

## Cap

```text
default = 25
cap can disable
below-cap turn approves all successes
same-turn overshoot allowed
at-cap loss opens same-turn slot
above-cap loss may return toward cap
```

## Termination

```text
MAX_TURNS at 30
FIXED_POINT detected
period-2 LOOP detected
period-N LOOP detected
EXTINCTION detected
full-state hash includes counters
```

## Batch

```text
same generation uses same seed list
all trials stored
mean correct
median correct
standard deviation correct
termination distribution correct
recurrence canonicalizes rotation/reflection
batch score uses configured weights
```

---

# 49. Implementation Boundary

Do not rewrite motif discovery here.

Do not rewrite furniture placement here.

Do not let pattern engine change live board.

Do not delete old app versions.

Create new version / patch layer.

End.
