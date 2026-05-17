// Trade Audit Engine — records full lifecycle of every execution event.
// Lightweight ring buffer with optional localStorage persistence.
export interface TradeAuditEntry {
  id: string;
  ts: number;
  asset: string;
  orderType: "MARKET" | "LIMIT" | "STOP_LOSS" | "TAKE_PROFIT" | "TRAILING_STOP";
  side: "BUY" | "SELL";
  entry?: number;
  exit?: number;
  size: number;
  confidence?: number;
  regime?: string;
  reasoning?: string;
  latencyMs?: number;
  slippagePct?: number;
  pnl?: number;
  status: "open" | "filled" | "closed" | "rejected" | "canceled";
}

const KEY = "fs.tradeAudit.v1";
const MAX = 200;
let BUFFER: TradeAuditEntry[] = load();

function load(): TradeAuditEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(BUFFER.slice(0, MAX))); } catch { /* quota */ }
}

export function recordTrade(entry: Omit<TradeAuditEntry, "id" | "ts"> & Partial<Pick<TradeAuditEntry, "id" | "ts">>): TradeAuditEntry {
  const e: TradeAuditEntry = {
    id: entry.id ?? `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: entry.ts ?? Date.now(),
    ...entry,
  } as TradeAuditEntry;
  BUFFER.unshift(e);
  if (BUFFER.length > MAX) BUFFER.length = MAX;
  save();
  return e;
}

export function updateTrade(id: string, patch: Partial<TradeAuditEntry>): TradeAuditEntry | null {
  const i = BUFFER.findIndex((t) => t.id === id);
  if (i < 0) return null;
  BUFFER[i] = { ...BUFFER[i], ...patch };
  save();
  return BUFFER[i];
}

export function getAuditLog(limit = 50): TradeAuditEntry[] {
  return BUFFER.slice(0, limit);
}

export function getLifecycle(asset: string, limit = 20): TradeAuditEntry[] {
  return BUFFER.filter((t) => t.asset === asset).slice(0, limit);
}

export function clearAuditLog() { BUFFER = []; save(); }
