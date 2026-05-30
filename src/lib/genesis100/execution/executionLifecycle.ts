// Phase C: Execution lifecycle — now uses real market prices for fills.
// Replaces Math.random() with getRealFillPrice() + ±0.1% slippage simulation.
// All orders remain paper/simulation only. "محاكاة ورقية — لا تنفيذ حقيقي"

import {
  createPaperOrder,
  approvePaperOrder,
  submitPaperOrder,
  fillPaperOrder,
  failFillPaperOrder,
  getPaperOrders,
  type PaperOrder,
} from "./paperOrders";
import { logExecutionAudit, getExecutionAuditLog } from "./executionAudit";
import { getRealFillPrice } from "./realPriceFill";

// Track last known prices per symbol for fallback fills
const _lastKnownPrices = new Map<string, number>();

export async function processPaperCycleOrders(
  proposedOrders: Array<{
    symbol: string;
    side: "buy" | "sell";
    notional: number;
    targetWeight: number;
    oldWeight: number;
    reason: string;
  }>,
  cycleId: string,
  confidence: number,
): Promise<PaperOrder[]> {
  const filled: PaperOrder[] = [];

  for (const o of proposedOrders) {
    const order = createPaperOrder({
      ...o,
      aiDecisionRef: cycleId,
      confidence,
      source: "genesis100-ai",
    });

    logExecutionAudit({
      orderId: order.id,
      symbol: order.symbol,
      action: "create",
      status: "proposed",
      source: "genesis100-ai",
      aiDecisionRef: cycleId,
      details: `Proposed ${o.side} ${o.symbol} notional $${o.notional}`,
    });

    const approved = approvePaperOrder(order.id);
    if (!approved) continue;

    logExecutionAudit({
      orderId: order.id,
      symbol: order.symbol,
      action: "approve",
      status: "approved",
      source: "auto",
      aiDecisionRef: cycleId,
      details: "Auto-approved for paper execution",
    });

    const submitted = submitPaperOrder(order.id);
    if (!submitted) continue;

    logExecutionAudit({
      orderId: order.id,
      symbol: order.symbol,
      action: "submit",
      status: "paper_submitted",
      source: "paper_engine",
      aiDecisionRef: cycleId,
      details: "Submitted to paper execution engine",
    });

    // Phase C: use real market price instead of Math.random()
    const { price: realPrice, provider, reliable } = await getRealFillPrice(o.symbol);

    if (realPrice !== null) {
      // Apply ±0.1% slippage simulation
      const slipDirection = Math.random() > 0.5 ? 1 : -1;
      const slippage = 1 + slipDirection * 0.001;
      const fillPrice = Math.round(realPrice * slippage * 10000) / 10000;

      _lastKnownPrices.set(o.symbol, realPrice);

      const filledOrder = fillPaperOrder(order.id, fillPrice, reliable ? "live" : "last_known");
      if (filledOrder) {
        logExecutionAudit({
          orderId: order.id,
          symbol: order.symbol,
          action: "fill",
          status: "simulated_fill",
          source: "paper_engine",
          aiDecisionRef: cycleId,
          details: `Real fill at ${fillPrice} via ${provider ?? "unknown"} (±0.1% slippage)`,
        });
        filled.push(filledOrder);
      }
    } else {
      // Fallback: use last known price if we have it
      const fallbackPrice = _lastKnownPrices.get(o.symbol);
      if (fallbackPrice !== null && fallbackPrice !== undefined) {
        const fillPrice = Math.round(fallbackPrice * 10000) / 10000;
        const filledOrder = fillPaperOrder(order.id, fillPrice, "last_known");
        if (filledOrder) {
          logExecutionAudit({
            orderId: order.id,
            symbol: order.symbol,
            action: "fill",
            status: "simulated_fill",
            source: "paper_engine",
            aiDecisionRef: cycleId,
            details: `Last-known price fill at ${fillPrice} (live price unavailable)`,
          });
          filled.push(filledOrder);
        }
      } else {
        // No price available — mark as fill_failed
        failFillPaperOrder(order.id);
        logExecutionAudit({
          orderId: order.id,
          symbol: order.symbol,
          action: "fill_failed",
          status: "fill_failed",
          source: "paper_engine",
          aiDecisionRef: cycleId,
          details: "No market price available — order marked fill_failed",
        });
      }
    }
  }

  return filled;
}

export function getExecutionStatus() {
  const orders = getPaperOrders(100);
  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }
  return {
    totalOrders: orders.length,
    byStatus,
    recentOrders: orders.slice(0, 10),
    auditLog: getExecutionAuditLog(20),
    liveExecutionEnabled: false,
    executionMode: "paper_only",
  };
}

export function getExecutionHistory(limit = 50) {
  return {
    orders: getPaperOrders(limit),
    auditLog: getExecutionAuditLog(limit),
    liveExecutionEnabled: false,
    executionMode: "paper_only",
  };
}

export { getPaperOrders, getExecutionAuditLog };
