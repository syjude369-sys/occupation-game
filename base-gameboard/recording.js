export const DEFAULT_RECORDING_SETTINGS = Object.freeze({
  gridCount: 17,
  moduleMultiple: 2
});

export function buildRecordingInfo(state) {
  return {
    primary: [
      `TURN ${Math.round(state.currentTurn)} / ${Math.round(state.simTurns)}`,
      `PLAYERS ${Math.round(state.playerCount)}`,
      `GRID ${Math.round(state.gridCount)}x${Math.round(state.gridCount)}`,
      `SPAN ${Math.round(state.cellSize).toLocaleString("en-US")} mm`,
      `MODULE x${Math.round(state.moduleMultiple)}`
    ].join("  |  "),
    secondary: [
      `R ${Math.round(state.rookProb)}%`,
      `B ${Math.round(state.bishopProb)}%`,
      `N ${Math.round(state.knightProb)}%`,
      `ATTACK ${Math.round(state.attackProb)}%`,
      `DOOR ${Math.round(state.doorHoldTurns)}T`,
      `SPEED ${Math.round(state.playSpeed)}`
    ].join("  |  ")
  };
}

export function recordingFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `base-gameboard-${datePart}-${timePart}.webm`;
}

export function chooseRecordingMimeType(isSupported) {
  const candidates = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm"
  ];
  return candidates.find((type) => isSupported(type)) || "";
}
