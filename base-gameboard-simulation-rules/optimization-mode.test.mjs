import test from "node:test";
import assert from "node:assert/strict";
import { effectiveObjectives, hasActiveMotifs, optimizationModeLabel } from "./optimization-mode.js";

const objectives = [
  { id: "continuity", enabled: true },
  { id: "activePatternFitness", enabled: true },
  { id: "balance", enabled: false }
];

test("hasActiveMotifs only counts active non-excluded motifs", () => {
  assert.equal(hasActiveMotifs([]), false);
  assert.equal(hasActiveMotifs([{ fitnessActive: false }]), false);
  assert.equal(hasActiveMotifs([{ fitnessActive: true, excluded: true }]), false);
  assert.equal(hasActiveMotifs([{ fitnessActive: true }]), true);
});

test("effectiveObjectives excludes motif fitness before any motif is active", () => {
  assert.deepEqual(effectiveObjectives(objectives, []).map((item) => item.id), ["continuity"]);
});

test("effectiveObjectives includes motif fitness after a motif becomes active", () => {
  assert.deepEqual(effectiveObjectives(objectives, [{ fitnessActive: true }]).map((item) => item.id), [
    "continuity",
    "activePatternFitness"
  ]);
});

test("optimization mode label separates simulation collection from motif optimization", () => {
  assert.equal(optimizationModeLabel([]), "Simulation only");
  assert.equal(optimizationModeLabel([{ fitnessActive: true }]), "Motif optimization");
});
