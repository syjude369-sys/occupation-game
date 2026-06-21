import test from "node:test";
import assert from "node:assert/strict";
import { defaultLabState, normalizeLabState, serializeLabState } from "./storage.js";

test("default state includes motifs objectives and generation", () => {
  const state = defaultLabState();
  assert.equal(state.version, 1);
  assert.equal(state.settings.cellCap, 25);
  assert.ok(state.motifs.length >= 4);
  assert.ok(state.objectives.some((o) => o.id === "motifFitness"));
});

test("invalid data recovers safe defaults", () => {
  const result = normalizeLabState({ version: 99, motifs: "broken" });
  assert.equal(result.recovered, true);
  assert.equal(result.state.version, 1);
});

test("archive retention bounds serialized state", () => {
  const state = defaultLabState();
  state.settings.archiveLimit = 2;
  state.archive = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const parsed = JSON.parse(serializeLabState(state));
  assert.deepEqual(parsed.archive.map((x) => x.id), [2, 3]);
});
