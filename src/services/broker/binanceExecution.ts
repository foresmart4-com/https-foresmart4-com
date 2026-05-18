// Order execution facade — validation + duplicate-order guard.
import { BinanceClient } from "./binanceRealConnector";

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP_LOSS" | "TAKE_PROFIT" | "STOP_LOSS_LIMIT";

export interface PlaceOrderInput {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: string;
  executedQty: number;
  avgPrice: number;
  ts: number;
}

const RECENT_KEYS = new Map<string, number>();
const DUP_WINDOW_MS = 3_000;

function guardDuplicate(key: string) {
  const now = Date.now();
  for (const [k, v] of RECENT_KEYS) if (now - v > DUP_WINDOW_MS) RECENT_KEYS.delete(k);
  if (RECENT_KEYS.has(key)) throw new Error("duplicate order suppressed");
  RECENT_KEYS.set(key, now);
}

export function validateOrder(o: PlaceOrderInput) {
  if (!o.symbol || o.symbol.length < 5) throw new Error("invalid symbol");
  if (o.quantity <= 0) throw new Error("invalid quantity");
  if (["LIMIT", "STOP_LOSS_LIMIT"].includes(o.type) && !o.price) throw new Error("price required");
  if (["STOP_LOSS", "TAKE_PROFIT", "STOP_LOSS_LIMIT"].includes(o.type) && !o.stopPrice) throw new Error("stopPrice required");
}

export async function placeOrder(client: BinanceClient, o: PlaceOrderInput): Promise<OrderResult> {
  validateOrder(o);
  const key = `${o.symbol}|${o.side}|${o.type}|${o.quantity}|${o.price ?? ""}`;
  guardDuplicate(key);
  const params: Record<string, string | number | undefined> = {
    symbol: o.symbol, side: o.side, type: o.type, quantity: o.quantity,
    price: o.price, stopPrice: o.stopPrice, newClientOrderId: o.clientOrderId,
    timeInForce: ["LIMIT", "STOP_LOSS_LIMIT"].includes(o.type) ? "GTC" : undefined,
  };
  const raw = await client.signedRequest<Record<string, unknown>>("POST", "/api/v3/order", params);
  const fills = (raw.fills as Array<{ price: string; qty: string }> | undefined) ?? [];
  const totalQty = fills.reduce((a, f) => a + Number(f.qty), 0);
  const avgPrice = totalQty > 0
    ? fills.reduce((a, f) => a + Number(f.price) * Number(f.qty), 0) / totalQty
    : Number(o.price ?? 0);
  return {
    orderId: String(raw.orderId),
    symbol: o.symbol, side: o.side, type: o.type,
    status: String(raw.status ?? "NEW"),
    executedQty: totalQty || Number(raw.executedQty ?? 0),
    avgPrice,
    ts: Date.now(),
  };
}

export async function cancelOrder(client: BinanceClient, symbol: string, orderId: string) {
  return client.signedRequest("DELETE", "/api/v3/order", { symbol, orderId });
}
