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

  /** Compact string for AI context injection — truncated per entry to save tokens. */
  compressedContext(n: number): string {
    const entries = this.getRecent(n);
    if (!entries.length) return "";
    return `Prior theses (${entries.length}): ` +
      entries.map((t) => `${t.asset} ${t.direction} ${t.confidence}%${t.outcome ? ` [${t.outcome}]` : ""} — "${t.thesis.slice(0, 45)}"`).join(" | ");
  },
};
