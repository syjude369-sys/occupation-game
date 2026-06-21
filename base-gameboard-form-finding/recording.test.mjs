import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RECORDING_SETTINGS,
  buildRecordingInfo,
  chooseRecordingMimeType,
  recordingFilename
} from "./recording.js";

test("approved defaults use a 17x17 grid and module multiplier 2", () => {
  assert.equal(DEFAULT_RECORDING_SETTINGS.gridCount, 17);
  assert.equal(DEFAULT_RECORDING_SETTINGS.moduleMultiple, 2);
});

test("recording info includes compact board and simulation settings", () => {
  const info = buildRecordingInfo({
    currentTurn: 12,
    simTurns: 60,
    playerCount: 4,
    gridCount: 17,
    cellSize: 1500,
    moduleMultiple: 2,
    rookProb: 40,
    bishopProb: 35,
    knightProb: 25,
    attackProb: 45,
    doorHoldTurns: 3,
    playSpeed: 4,
    territorySkipEnabled: true,
    territorySkipStartTurn: 10,
    clusterKeepCount: 4
  });

  assert.match(info.primary, /TURN 12 \/ 60/);
  assert.match(info.primary, /GRID 17x17/);
  assert.match(info.primary, /MODULE x2/);
  assert.match(info.secondary, /R 40%/);
  assert.match(info.secondary, /DOOR 3T/);
  assert.match(info.secondary, /SKIP 10T/);
  assert.match(info.secondary, /CLUSTER 4/);
});

test("recording filename is portable and uses webm extension", () => {
  assert.match(recordingFilename(new Date("2026-06-14T12:34:56Z")), /^base-gameboard-\d{8}-\d{6}\.webm$/);
});

test("MIME selection picks the first supported WebM format", () => {
  const selected = chooseRecordingMimeType((type) => type === "video/webm;codecs=vp8");
  assert.equal(selected, "video/webm;codecs=vp8");
});

test("MIME selection prefers VP8 over VP9 for embedded Chromium stability", () => {
  const selected = chooseRecordingMimeType((type) =>
    type === "video/webm;codecs=vp8" || type === "video/webm;codecs=vp9"
  );
  assert.equal(selected, "video/webm;codecs=vp8");
});
