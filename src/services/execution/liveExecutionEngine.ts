// Live Execution Engine — wraps the broker connector with execution metrics
// (latency, slippage, rejections) and emits an in-memory event log.
import {
  placeOrder, cancelOrder, type BrokerMode, type BrokerOrder, type BrokerSide,
} from "@/services/broker/binanceConnector";

export interface ExecutionEvent {
  id: string; ts: number; kind: "fill" | "reject" | "cancel" | "stop" | "tp" | "trail";
  symbol: string; side: BrokerSide; qty: number;
  latencyMs?: number; slippagePct?: number; reason?: string;
}
export interface ExecutionMetrics {
  total: number; filled: number; rejected: number; canceled: number;
  avgLatencyMs: number; avgSlippagePct: number; successRate: number;
}

const EVENTS: ExecutionEvent[] = [];
const MAX_EVENTS = 100;

function push(e: ExecutionEvent) {
  EVENTS.unshift(e);
  if (EVENTS.length > MAX_EVENTS) EVENTS.length = MAX_EVENTS;
}

function toEvent(o: BrokerOrder, kind: ExecutionEvent["kind"]): ExecutionEvent {
  return {
    id: o.id, ts: o.ts, kind, symbol: o.symbol, side: o.side, qty: o.qty,
    latencyMs: o.latencyMs, slippagePct: o.slippagePct, reason: o.reason,
  };
}

export async function marketBuy(symbol: string, qty: number, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await placeOrder({ mode, symbol, side: "BUY", type: "MARKET", qty });
  push(toEvent(o, o.status === "FILLED" ? "fill" : "reject"));
  return o;
}

export async function marketSell(symbol: string, qty: number, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await placeOrder({ mode, symbol, side: "SELL", type: "MARKET", qty });
  push(toEvent(o, o.status === "FILLED" ? "fill" : "reject"));
  return o;
}

export async function stopLoss(symbol: string, side: BrokerSide, qty: number, stopPrice: number, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await placeOrder({ mode, symbol, side, type: "STOP_LOSS", qty, stopPrice });
  push(toEvent(o, "stop"));
  return o;
}

export async function takeProfit(symbol: string, side: BrokerSide, qty: number, price: number, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await placeOrder({ mode, symbol, side, type: "TAKE_PROFIT", qty, price });
  push(toEvent(o, "tp"));
  return o;
}

export async function trailingStop(symbol: string, side: BrokerSide, qty: number, trailingPct: number, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await placeOrder({ mode, symbol, side, type: "TRAILING_STOP", qty, trailingPct });
  push(toEvent(o, "trail"));
  return o;
}

export async function cancel(orderId: string, symbol: string, mode: BrokerMode = "testnet"): Promise<BrokerOrder> {
  const o = await cancelOrder(orderId, symbol, mode);
  push(toEvent(o, "cancel"));
  return o;
}

export function getExecutionFeed(limit = 20): ExecutionEvent[] {
  return EVENTS.slice(0, limit);
}

export function getExecutionMetrics(): ExecutionMetrics {
  const total = EVENTS.length;
  const filled = EVENTS.filter((e) => e.kind === "fill").length;
  const rejected = EVENTS.filter((e) => e.kind === "reject").length;
  const canceled = EVENTS.filter((e) => e.kind === "cancel").length;
  const lat = EVENTS.filter((e) => e.latencyMs).map((e) => e.latencyMs!);
  const slp = EVENTS.filter((e) => e.slippagePct).map((e) => e.slippagePct!);
  return {
    total, filled, rejected, canceled,
    avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
    avgSlippagePct: slp.length ? +(slp.reduce((a, b) => a + b, 0) / slp.length).toFixed(3) : 0,
    successRate: total ? Math.round((filled / total) * 100) : 0,
  };
}
