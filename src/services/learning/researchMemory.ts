/**
 * Research Memory — Phase 8
 * localStorage ring buffer (max 20 entries) for Genesis institutional research reports.
 * Client-side only — never sent to server. User-visible and clearable.
 * No hidden profiling — each entry stores only the question topic, type, and metadata.
 */
const KEY = "foresmart.genesis.research.v1";
const MAX = 20;

export type ResearchType = "asset" | "comparison" | "sector" | "thesis" | "market";

export interface ResearchEntry {
  id: string;
  ts: number;
  question: string;        // first 100 chars of the question
  topic: string;           // extracted primary topic (ticker, pair, or "market")
  type: ResearchType;
  confidence: number;      // AI confidence at time of report
  sectionsPresent: string[]; // which of the 10 sections were populated
}

function read(): ResearchEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ResearchEntry[]; } catch { return []; }
}

function persist(entries: ResearchEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

export const researchMemory = {
  save(entry: ResearchEntry): void {
    const entries = read();
    entries.push(entry);
    persist(entries);
  },

  getRecent(n: number): ResearchEntry[] {
    return read().slice(-n).reverse();
  },

  count(): number {
    return read().length;
  },

  clear(): void { persist([]); },
};
