/** AI Memory — localStorage-backed trade memory with PnL and tags. */
export interface TradeMemoryEntry {
  id: string; ts: number; symbol: string; side: "buy"|"sell";
  entry: number; exit?: number; pnl?: number; pnlPct?: number;
  regime?: string; confidence?: number; tags?: string[]; outcome?: "win"|"loss"|"open";
}
const KEY = "ai_memory_v1";
const MAX = 500;
function read(): TradeMemoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function write(rows: TradeMemoryEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX))); } catch {}
}

export const aiMemory = {
  list(): TradeMemoryEntry[] { return read(); },
  record(e: Omit<TradeMemoryEntry, "id"|"ts">) {
    const rows = read();
    rows.unshift({ ...e, id: crypto.randomUUID(), ts: Date.now() });
    write(rows);
  },
  closeOpen(id: string, exit: number) {
    const rows = read();
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    r.exit = exit;
    r.pnl = (r.side === "buy" ? exit - r.entry : r.entry - exit);
    r.pnlPct = r.entry ? r.pnl / r.entry : 0;
    r.outcome = (r.pnl ?? 0) >= 0 ? "win" : "loss";
    write(rows);
  },
  clear() { write([]); },
};
