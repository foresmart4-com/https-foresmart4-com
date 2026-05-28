/** Genesis thesis memory — localStorage ring buffer (max 50 entries).
 * Stores investment theses produced by Genesis AI for context continuity
 * and thesis tracking. Client-side only — never sent to server as PII.
 */
const KEY = "foresmart.genesis.theses.v1";
const MAX = 50;

export interface ThesisEntry {
  id: string;
  ts: number;
  asset: string;               // ticker or topic keyword e.g. "BTC", "MARKET"
  direction: "bullish" | "bearish" | "neutral";
  thesis: string;              // one-sentence investment thesis
  confidence: number;          // 0-100 at the time of generation
  uncertainty: string | null;  // uncertainty note if low confidence
  invalidation: string | null; // condition that would invalidate the thesis
  catalyst: string | null;     // primary near-term catalyst to watch
  regimeAtSave?: string;       // market regime label when thesis was generated
  outcome?: "correct" | "incorrect" | "mixed" | "pending"; // user-resolved outcome
  resolvedAt?: number;         // timestamp when outcome was recorded
}

export interface ThesisOutcomeStats {
  total: number;
  resolved: number;
  accuracy: number;            // 0-100: % of resolved theses that were "correct"
  breakdown: Partial<Record<NonNullable<ThesisEntry["outcome"]>, number>>;
}

function read(): ThesisEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ThesisEntry[]; } catch { return []; }
}

function persist(entries: ThesisEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

export const thesisMemory = {
  save(entry: ThesisEntry): void {
    const entries = read();
    // Deduplicate: if same asset updated within 30 min, replace rather than append.
    const idx = entries.findIndex((e) => e.asset === entry.asset && entry.ts - e.ts < 30 * 60_000);
    if (idx >= 0) { entries[idx] = entry; persist(entries); return; }
    entries.push(entry);
    persist(entries);
  },

  getRecent(n: number): ThesisEntry[] {
    return read().slice(-n);
  },

  all(): ThesisEntry[] {
    return read();
  },

  clear(): void { persist([]); },

  /** Mark a thesis outcome. Idempotent — re-resolving updates the record. */
  resolveThesis(id: string, outcome: NonNullable<ThesisEntry["outcome"]>): void {
    const entries = read();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    entries[idx] = { ...entries[idx], outcome, resolvedAt: Date.now() };
    persist(entries);
  },

  /** Aggregate outcome accuracy across all resolved theses. */
  outcomeStats(): ThesisOutcomeStats {
    const entries = read();
    const resolved = entries.filter((e) => e.outcome && e.outcome !== "pending");
    const correct = resolved.filter((e) => e.outcome === "correct").length;
    const breakdown: ThesisOutcomeStats["breakdown"] = {};
    for (const e of resolved) {
      if (e.outcome) breakdown[e.outcome] = (breakdown[e.outcome] ?? 0) + 1;
    }
    return {
      total: entries.length,
      resolved: resolved.length,
      accuracy: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
      breakdown,
    };
  },

  /**
   * Age-weighted compact context for AI injection.
   * Sorts by recency (2-day half-life) so fresh theses rank first.
   * Includes age labels so the AI can judge how stale a prior view is.
   * Optional assetHint boosts same-asset entries to the top.
   */
  compressedContext(n: number, assetHint?: string): string {
    const all = read();
    if (!all.length) return "";
    const now = Date.now();
    // Score: recency weight × asset-match boost
    const scored = all.map((t) => {
      const ageDays = (now - t.ts) / 86400000;
      const recency = Math.exp((-ageDays * Math.LN2) / 2); // half-life 2 days
      const assetBoost = assetHint && t.asset.toUpperCase() === assetHint.toUpperCase() ? 2 : 1;
      return { ...t, _score: recency * assetBoost };
    });
    const top = [...scored].sort((a, b) => b._score - a._score).slice(0, n);
    if (!top.length) return "";
    const parts = top.map((t) => {
      const ageDays = (now - t.ts) / 86400000;
      const age = ageDays < 0.5 ? "today" : ageDays < 1.5 ? "yesterday" : `${Math.round(ageDays)}d ago`;
      const outcomeStr = t.outcome ? ` [${t.outcome}]` : "";
      return `${t.asset} ${t.direction} ${t.confidence}%${outcomeStr} (${age}): "${t.thesis.slice(0, 50)}"`;
    });
    return `Prior theses (${top.length}): ` + parts.join(" | ");
  },
};
