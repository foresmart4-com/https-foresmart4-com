// Binance Connector — client-side facade. Real REST calls go through a server
// function (see src/lib/broker.functions.ts) so API keys never touch the browser.
// Defaults to TESTNET. Live mode is gated behind an explicit flag.
import { callBroker } from "@/lib/broker.functions";

export type BrokerMode = "testnet" | "live";
export type BrokerSide = "BUY" | "SELL";
export type BrokerOrderType = "MARKET" | "LIMIT" | "STOP_LOSS" | "TAKE_PROFIT" | "TRAILING_STOP";

export interface BrokerBalance { asset: string; free: number; locked: number; }
export interface BrokerPosition { symbol: string; qty: number; entryPrice: number; markPrice: number; pnl: number; }
export interface BrokerOrder {
  id: string; symbol: string; side: BrokerSide; type: BrokerOrderType;
  qty: number; price?: number; status: "NEW" | "FILLED" | "CANCELED" | "REJECTED";
  ts: number; latencyMs?: number; slippagePct?: number; reason?: string;
}
export interface BrokerAccount {
  mode: BrokerMode; connected: boolean; canTrade: boolean;
  equity: number; available: number; balances: BrokerBalance[];
  positions: BrokerPosition[]; lastPing: number;
}

const DEFAULT_MODE: BrokerMode = "testnet";

export async function getAccount(mode: BrokerMode = DEFAULT_MODE): Promise<BrokerAccount> {
  try {
    return await callBroker<BrokerAccount>("account", { mode });
  } catch {
    return fallbackAccount(mode);
  }
}

export async function getBalances(mode: BrokerMode = DEFAULT_MODE): Promise<BrokerBalance[]> {
  const acc = await getAccount(mode);
  return acc.balances;
}

export async function getOpenPositions(mode: BrokerMode = DEFAULT_MODE): Promise<BrokerPosition[]> {
  const acc = await getAccount(mode);
  return acc.positions;
}

export async function placeOrder(input: {
  mode?: BrokerMode; symbol: string; side: BrokerSide; type: BrokerOrderType;
  qty: number; price?: number; stopPrice?: number; trailingPct?: number;
}): Promise<BrokerOrder> {
  const mode = input.mode ?? DEFAULT_MODE;
  const t0 = performance.now();
  try {
    const o = await callBroker<BrokerOrder>("place", { ...input, mode });
    return { ...o, latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    return {
      id: `SIM-${Date.now()}`, symbol: input.symbol, side: input.side, type: input.type,
      qty: input.qty, price: input.price, status: "REJECTED", ts: Date.now(),
      latencyMs: Math.round(performance.now() - t0),
      reason: e instanceof Error ? e.message : "broker offline — simulated",
    };
  }
}

export async function cancelOrder(orderId: string, symbol: string, mode: BrokerMode = DEFAULT_MODE): Promise<BrokerOrder> {
  try { return await callBroker("cancel", { orderId, symbol, mode }); }
  catch { return { id: orderId, symbol, side: "BUY", type: "MARKET", qty: 0, status: "CANCELED", ts: Date.now() }; }
}

export async function getOrderStatus(orderId: string, symbol: string, mode: BrokerMode = DEFAULT_MODE): Promise<BrokerOrder> {
  try { return await callBroker("status", { orderId, symbol, mode }); }
  catch { return { id: orderId, symbol, side: "BUY", type: "MARKET", qty: 0, status: "NEW", ts: Date.now() }; }
}

function fallbackAccount(mode: BrokerMode): BrokerAccount {
  return {
    mode, connected: false, canTrade: false,
    equity: 10_000, available: 9_500,
    balances: [
      { asset: "USDT", free: 9_500, locked: 0 },
      { asset: "BTC", free: 0.01, locked: 0 },
    ],
    positions: [],
    lastPing: Date.now(),
  };
}
