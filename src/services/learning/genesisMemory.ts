/** Genesis conversation history — localStorage ring buffer (max 50 entries). */
const KEY = "foresmart.genesis.history.v1";
const MAX = 50;

export interface GenesisHistoryEntry {
  ts: number;
  question: string;
  headline: string;
  confidence: number;
  engineUsed: "ai" | "heuristic";
  actionType: string | null;
}

function read(): GenesisHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as GenesisHistoryEntry[]; } catch { return []; }
}

function persist(entries: GenesisHistoryEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

export const genesisMemory = {
  list(): GenesisHistoryEntry[] { return read(); },

  append(entry: GenesisHistoryEntry): void {
    const entries = read();
    entries.push(entry);
    persist(entries);
  },

  clear(): void { persist([]); },

  summary(): { total: number; avgConfidence: number; aiRatio: number } {
    const entries = read();
    if (!entries.length) return { total: 0, avgConfidence: 0, aiRatio: 0 };
    const avg = entries.reduce((s, e) => s + e.confidence, 0) / entries.length;
    const aiCount = entries.filter((e) => e.engineUsed === "ai").length;
    return {
      total: entries.length,
      avgConfidence: Math.round(avg),
      aiRatio: Math.round((aiCount / entries.length) * 100),
    };
  },
};
