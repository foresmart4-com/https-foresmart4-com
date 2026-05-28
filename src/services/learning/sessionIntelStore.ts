/** Cross-surface session intelligence bus — Phase 4 expansion.
 * Carries the full Genesis analysis snapshot across surfaces (Genesis, Advisor, Market).
 * localStorage-backed, 30-minute TTL. Never sent to server. No PII.
 * v2 key: incompatible schema upgrade from v1 (regime+confidence only).
 */
const KEY = "foresmart.session.intel.v2";
const TTL_MS = 30 * 60_000;

export interface IntelligenceEvent {
  // Core (always set)
  regime: string;
  confidence: number;
  ts: number;
  // Phase 4 enrichment (nullable — only set when multi-agent path ran)
  primaryRisk: string | null;
  dominantBias: "bullish" | "bearish" | "neutral" | null;
  topThesis: string | null;
  invalidationTrigger: string | null;
  tracksUsed: number;
  msq: "live" | "partial" | "inferred" | null;
}

/** Backward-compatible alias so existing consumers still type-check. */
export type SessionIntel = IntelligenceEvent;

export const sessionIntelStore = {
  write(intel: Omit<IntelligenceEvent, "ts">): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...intel, ts: Date.now() }));
    } catch {}
  },

  read(): IntelligenceEvent | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as IntelligenceEvent;
      if (!d.ts || Date.now() - d.ts > TTL_MS) { localStorage.removeItem(KEY); return null; }
      return d;
    } catch { return null; }
  },

  clear(): void {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(KEY); } catch {}
  },
};
