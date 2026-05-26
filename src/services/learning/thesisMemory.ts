/** Genesis thesis memory — localStorage ring buffer (max 20 entries).
 * Stores investment theses produced by Genesis AI for context continuity
 * and thesis tracking. Client-side only — never sent to server as PII.
 */
const KEY = "foresmart.genesis.theses.v1";
const MAX = 20;

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
};
