function emptySummary(totalMotifs) {
  return {
    totalHits: 0,
    activeHits: 0,
    uniqueMotifsHit: 0,
    totalMotifs,
    topHits: []
  };
}

function matchKey(motif, match) {
  return `${motif.id || motif.signature}:${match.occupiedKeys.slice().sort().join("|")}`;
}

export function summarizeArchiveMotifHits(checkpoints, motifs, occurrenceFinder, options = {}) {
  const definedMotifs = Array.isArray(motifs) ? motifs : [];
  const frames = Array.isArray(checkpoints) ? checkpoints : [];
  const minTurns = Math.max(1, Number(options.minTurns ?? 3) || 3);
  if (!frames.length || !definedMotifs.length) return emptySummary(definedMotifs.length);

  const activeEpisodes = new Map();
  const completeEpisodes = [];
  const closeMissing = (key) => {
    const episode = activeEpisodes.get(key);
    if (episode) completeEpisodes.push(episode);
    activeEpisodes.delete(key);
  };

  frames.forEach((checkpoint, checkpointIndex) => {
    const seen = new Set();
    for (const motif of definedMotifs) {
      for (const match of occurrenceFinder(checkpoint.state, motif)) {
        const key = matchKey(motif, match);
        seen.add(key);
        const current = activeEpisodes.get(key);
        if (current && current.lastCheckpointIndex === checkpointIndex - 1) {
          current.lastTurn = checkpoint.turn;
          current.lastCheckpointIndex = checkpointIndex;
          current.count += 1;
        } else {
          if (current) completeEpisodes.push(current);
          activeEpisodes.set(key, {
            id: motif.id || motif.signature,
            name: motif.name || "Motif",
            active: motif.fitnessActive === true,
            firstTurn: checkpoint.turn,
            lastTurn: checkpoint.turn,
            lastCheckpointIndex: checkpointIndex,
            count: 1
          });
        }
      }
    }
    for (const key of [...activeEpisodes.keys()]) {
      if (!seen.has(key) && activeEpisodes.get(key).lastCheckpointIndex < checkpointIndex) closeMissing(key);
    }
  });
  completeEpisodes.push(...activeEpisodes.values());

  const persistent = completeEpisodes.filter((episode) => episode.lastTurn - episode.firstTurn + 1 >= minTurns);
  const byMotif = new Map();
  for (const episode of persistent) {
    const item = byMotif.get(episode.id) || { id: episode.id, name: episode.name, count: 0, active: episode.active };
    item.count += 1;
    byMotif.set(episode.id, item);
  }
  const topHits = [...byMotif.values()].sort((a, b) =>
    b.count - a.count ||
    Number(b.active) - Number(a.active) ||
    a.name.localeCompare(b.name)
  );
  return {
    totalHits: topHits.reduce((sum, item) => sum + item.count, 0),
    activeHits: topHits.filter((item) => item.active).reduce((sum, item) => sum + item.count, 0),
    uniqueMotifsHit: topHits.length,
    totalMotifs: definedMotifs.length,
    topHits: topHits.slice(0, 3)
  };
}
