export type PaperOrderStatus = "proposed" | "approved" | "paper_submitted" | "simulated_fill" | "fill_failed" | "rejected" | "cancelled";

export interface PaperOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  notional: number;
  targetWeight: number;
  oldWeight: number;
  status: PaperOrderStatus;
  aiDecisionRef: string | null;
  confidence: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
  fillPrice: number | null;
  fillPriceSource: "live" | "last_known" | "failed" | null;
  fillTimestamp: string | null;
  rejectedReason: string | null;
  source: "genesis100-ai" | "manual";
}

const orders: PaperOrder[] = [];

export function createPaperOrder(params: {
  symbol: string;
  side: "buy" | "sell";
  notional: number;
  targetWeight: number;
  oldWeight: number;
  aiDecisionRef: string | null;
  confidence: number;
  reason: string;
  source?: "genesis100-ai" | "manual";
}): PaperOrder {
  const now = new Date().toISOString();
  const order: PaperOrder = {
    id: `PO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...params,
    status: "proposed",
    source: params.source ?? "genesis100-ai",
    createdAt: now,
    updatedAt: now,
    fillPrice: null,
    fillPriceSource: null,
    fillTimestamp: null,
    rejectedReason: null,
  };
  orders.unshift(order);
  if (orders.length > 500) orders.length = 500;
  return order;
}

export function approvePaperOrder(id: string): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "proposed") return null;
  order.status = "approved";
  order.updatedAt = new Date().toISOString();
  return order;
}

export function submitPaperOrder(id: string): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "approved") return null;
  order.status = "paper_submitted";
  order.updatedAt = new Date().toISOString();
  return order;
}

export function fillPaperOrder(
  id: string,
  fillPrice: number,
  fillPriceSource: PaperOrder["fillPriceSource"] = "live",
): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "paper_submitted") return null;
  order.status = "simulated_fill";
  order.fillPrice = fillPrice;
  order.fillPriceSource = fillPriceSource;
  order.fillTimestamp = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  return order;
}

export function failFillPaperOrder(id: string): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== "paper_submitted") return null;
  order.status = "fill_failed";
  order.fillPriceSource = "failed";
  order.updatedAt = new Date().toISOString();
  return order;
}

export function rejectPaperOrder(id: string, reason: string): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || (order.status !== "proposed" && order.status !== "approved")) return null;
  order.status = "rejected";
  order.rejectedReason = reason;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function cancelPaperOrder(id: string): PaperOrder | null {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status === "simulated_fill" || order.status === "cancelled") return null;
  order.status = "cancelled";
  order.updatedAt = new Date().toISOString();
  return order;
}

export function getPaperOrders(limit = 50): PaperOrder[] {
  return orders.slice(0, limit);
}

export function getPaperOrderById(id: string): PaperOrder | null {
  return orders.find((o) => o.id === id) ?? null;
}
