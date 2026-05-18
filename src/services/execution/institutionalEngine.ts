/** Institutional execution engine extensions:
 *  smart routing, slippage protection, liquidity-aware execution,
 *  partial fills, batching, prioritization, replay, audit. */

export interface VenueQuote { venue: string; bid: number; ask: number; depthUsd: number; latencyMs: number; }
export interface RouteDecision { venue: string; reason: string; expectedSlippageBps: number; }

export function smartRoute(side: "buy"|"sell", notionalUsd: number, quotes: VenueQuote[]): RouteDecision | null {
  if (!quotes.length) return null;
  const ranked = quotes.map((q) => {
    const px = side === "buy" ? q.ask : q.bid;
    const depthCover = Math.min(1, q.depthUsd / Math.max(1, notionalUsd));
    const slippageBps = (1 - depthCover) * 25 + Math.min(20, q.latencyMs / 20);
    const score = depthCover * 0.6 - slippageBps / 200 - q.latencyMs / 2000;
    return { q, px, slippageBps, score };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return { venue: best.q.venue,
    reason: `Best score across depth/latency/spread`,
    expectedSlippageBps: Number(best.slippageBps.toFixed(2)) };
}

export interface SlippageGuardInput { referencePrice: number; fillPrice: number; maxBps: number; }
export function slippageOk(g: SlippageGuardInput): boolean {
  const bps = Math.abs(g.fillPrice - g.referencePrice) / g.referencePrice * 10000;
  return bps <= g.maxBps;
}

export interface PartialFill { qty: number; price: number; ts: number; }
export function aggregateFills(fills: PartialFill[]) {
  const qty = fills.reduce((s, f) => s + f.qty, 0);
  const notional = fills.reduce((s, f) => s + f.qty * f.price, 0);
  return { qty, avgPrice: qty ? notional / qty : 0, count: fills.length };
}

export interface PendingOrder { id: string; symbol: string; priority: number; notional: number; createdAt: number; }
export function prioritizeQueue(orders: PendingOrder[]): PendingOrder[] {
  return [...orders].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
}

export function batchOrders<T extends { symbol: string }>(orders: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const o of orders) (out[o.symbol] ??= []).push(o);
  return out;
}

export interface ExecAuditEntry {
  id: string; ts: number; symbol: string; side: "buy"|"sell";
  requested: number; filled: number; avgPrice: number; slippageBps: number;
  venue?: string; status: "filled"|"partial"|"rejected"|"replayed";
}
const _auditTrail: ExecAuditEntry[] = [];
export function recordAudit(e: ExecAuditEntry) { _auditTrail.unshift(e); if (_auditTrail.length > 500) _auditTrail.pop(); }
export function readAudit(limit = 50) { return _auditTrail.slice(0, limit); }
export function replayExecution(id: string) {
  const e = _auditTrail.find((x) => x.id === id);
  return e ? { ...e, status: "replayed" as const, ts: Date.now() } : null;
}
