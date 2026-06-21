import test from "node:test";
import assert from "node:assert/strict";
import { canRunGeneration, canRunInitialPatternSearch, runModeLabel } from "./search-mode.js";

test("initial pattern search is available only before motif fitness is active", () => {
  assert.equal(canRunInitialPatternSearch([], false), true);
  assert.equal(canRunInitialPatternSearch([{ fitnessActive: true }], false), false);
  assert.equal(canRunInitialPatternSearch([], true), false);
});

test("run generation is available only after motif fitness is active", () => {
  assert.equal(canRunGeneration([], false), false);
  assert.equal(canRunGeneration([{ fitnessActive: false }], false), false);
  assert.equal(canRunGeneration([{ fitnessActive: true }], false), true);
  assert.equal(canRunGeneration([{ fitnessActive: true }], true), false);
});

test("run mode label follows motif fitness state", () => {
  assert.equal(runModeLabel([]), "Initial pattern search");
  assert.equal(runModeLabel([{ fitnessActive: true }]), "Run generation");
});
