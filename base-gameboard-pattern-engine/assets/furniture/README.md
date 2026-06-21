# Furniture Asset Folder

This folder is reserved for CAD-derived or metadata-driven furniture assets used by the furniture layout engine.

Recommended structure:

```text
assets/furniture/
  metadata/
    furniture-catalog.example.json
  cad/
  svg/
  dxf/
```

## First-Pass Rule

The first furniture solver should work from lightweight metadata and simplified geometry. Do not require a `.3dm` parser for the first implementation.

CAD files can be used as source references, but runtime placement should use:

- metadata JSON
- simplified polygons
- rectangles/footprints
- exported SVG/DXF where practical

## Metadata Shape

Suggested asset metadata:

```json
{
  "id": "desk-1200x700",
  "name": "Desk 1200 x 700",
  "category": "work",
  "subtype": "individual_desk",
  "capacity": 1,
  "sourceFile": null,
  "sourceBlockName": null,
  "footprintMm": { "width": 1200, "depth": 700 },
  "allowedRotations": [0, 90, 180, 270],
  "clearanceZones": [
    { "edge": "front", "depthMm": 900 }
  ],
  "requiredAccessEdges": ["front"],
  "wallRequirement": "optional",
  "preferredLocation": "edge",
  "compatibleSets": ["workstation-single"],
  "tags": ["metric-handbook-derived"],
  "handbookReference": "capture exact source note in docs/furniture-rules"
}
```

