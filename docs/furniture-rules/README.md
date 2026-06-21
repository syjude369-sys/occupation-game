# Furniture Rules Document Drop Zone

This folder stores GPT-authored rule documents that Claude Code should treat as implementation contracts for furniture layout.

Recommended document sequence:

```text
001-furniture-layout-rules.md
002-metric-handbook-principles.md
003-cad-source-mapping.md
004-program-templates.md
005-scoring-and-failure-reasons.md
```

The first implementation should not require every document above. Start with the smallest complete rule set available.

## What Belongs Here

Use markdown files here for:

- Metric Handbook-derived dimensions and clearance principles
- furniture categories and asset definitions
- furniture-set templates
- CAD/block metadata mapping rules
- layout generation heuristics
- scoring rules
- failure reasons
- UI requirements for furniture validation

## What Does Not Belong Here

Do not store heavy CAD binaries in this docs folder.

Use:

```text
base-gameboard-pattern-engine/assets/furniture/
```

for source CAD, SVG, DXF, or metadata artifacts.

## Rule Priority

If two rule docs conflict:

1. newer numbered docs override older numbered docs only when they explicitly say so
2. otherwise Claude should stop and ask the user

Do not silently merge conflicting Metric Handbook assumptions.

