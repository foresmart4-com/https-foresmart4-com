/**
 * Memory Intelligence Layer — Phase 5
 * Unifies genesis memory, thesis memory, and session intel into a single
 * continuity-aware context surface. Applies age-decay weighting so stale
 * exchanges influence the AI less than fresh ones.
 */
import { genesisMemory } from "./genesisMemory";
import { thesisMemory } from "./thesisMemory";
import { sessionIntelStore } from "./sessionIntelStore";

const CONTINUITY_WINDOW_MS = 4 * 60 * 60_000; // 4 hours

export interface MemorySnapshot {
  continuityScore: number;       // 0-100: how much context carries forward
  totalExchanges: number;
  activeTheses: number;
  sessionFresh: boolean;
  weeklyDigestWeeks: number;
  topAssets: string[];
  weightedAvgConfidence: number;
}

function calcContinuityScore(
  exchanges: number,
  theses: number,
  sessionFresh: boolean,
  digestWeeks: number,
): number {
  let s = Math.min(40, exchanges * 4);  // up to 40 pts from exchange depth
  s += Math.min(30, theses * 10);       // up to 30 pts from saved theses
  if (sessionFresh) s += 15;            // 15 pts for live session bus
  s += Math.min(15, digestWeeks * 5);   // up to 15 pts from digest coverage
  return Math.round(Math.min(100, s));
}

export const memoryIntelligence = {
  /** Point-in-time snapshot of all memory sources and continuity score. */
  snapshot(): MemorySnapshot {
    const ws = genesisMemory.weightedSummary();
    const theses = thesisMemory.all();
    const session = sessionIntelStore.read();
    const digestWeeks = genesisMemory.weeklyDigestCount();

    const assetFreq = new Map<string, number>();
    for (const t of theses) assetFreq.set(t.asset, (assetFreq.get(t.asset) ?? 0) + 1);
    const topAssets = [...assetFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a);

    return {
      continuityScore: calcContinuityScore(ws.total, theses.length, session !== null, digestWeeks),
      totalExchanges: ws.total,
      activeTheses: theses.length,
      sessionFresh: session !== null,
      weeklyDigestWeeks: digestWeeks,
      topAssets,
      weightedAvgConfidence: ws.avgConfidence,
    };
  },

  /**
   * Builds a compressed, age-weighted intelligence context string for AI injection.
   * Includes: weighted summary, weekly digest, aged recent exchanges, and a
   * continuity signal when a fresh prior thesis exists (< 4h old).
   */
  buildIntelContext(): string {
    const parts: string[] = [];
    const ws = genesisMemory.weightedSummary();
    if (ws.total > 0) {
      parts.push(`Memory: ${ws.total} exchanges, ${ws.avgConfidence}% wtd-conf, ${ws.aiRatio}% AI`);
    }
    const digest = genesisMemory.weeklyDigestContext();
    if (digest) parts.push(digest);
    const aged = genesisMemory.agedContext(3);
    if (aged) parts.push(aged);

    // Continuity signal — surface the most recent thesis when it is still fresh,
    // so the AI acknowledges whether the current query extends or revises it.
    const recent = thesisMemory.getRecent(1);
    if (recent.length > 0) {
      const t = recent[0];
      const ageMins = (Date.now() - t.ts) / 60_000;
      if (ageMins < CONTINUITY_WINDOW_MS / 60_000) {
        const ageStr = ageMins < 60
          ? `${Math.round(ageMins)}m ago`
          : `${(ageMins / 60).toFixed(1)}h ago`;
        parts.push(
          `Prior view (${ageStr}): ${t.asset} ${t.direction} at ${t.confidence}% — "${t.thesis.slice(0, 60)}". ` +
          `Acknowledge whether the current query confirms, extends, or revises this view.`,
        );
      }
    }

    return parts.join("\n");
  },

  /** Compress old genesis entries into weekly digests. Call on page mount. */
  compress(): void {
    genesisMemory.compressOldEntries(7);
  },
};
