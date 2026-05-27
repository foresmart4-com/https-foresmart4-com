import { createPaperOrder, approvePaperOrder, submitPaperOrder, fillPaperOrder, getPaperOrders, type PaperOrder } from "./paperOrders";
import { logExecutionAudit, getExecutionAuditLog } from "./executionAudit";

export function processPaperCycleOrders(proposedOrders: Array<{
  symbol: string;
  side: "buy" | "sell";
  notional: number;
  targetWeight: number;
  oldWeight: number;
  reason: string;
}>, cycleId: string, confidence: number): PaperOrder[] {
  const filled: PaperOrder[] = [];
  for (const o of proposedOrders) {
    const order = createPaperOrder({
      ...o,
      aiDecisionRef: cycleId,
      confidence,
      source: "genesis100-ai",
    });

    logExecutionAudit({ orderId: order.id, symbol: order.symbol, action: "create", status: "proposed", source: "genesis100-ai", aiDecisionRef: cycleId, details: `Proposed ${o.side} ${o.symbol} notional ${o.notional}` });

    const approved = approvePaperOrder(order.id);
    if (approved) {
      logExecutionAudit({ orderId: order.id, symbol: order.symbol, action: "approve", status: "approved", source: "auto", aiDecisionRef: cycleId, details: "Auto-approved for paper execution" });

      const submitted = submitPaperOrder(order.id);
      if (submitted) {
        logExecutionAudit({ orderId: order.id, symbol: order.symbol, action: "submit", status: "paper_submitted", source: "paper_engine", aiDecisionRef: cycleId, details: "Submitted to paper execution engine" });

        const simulatedPrice = Math.round((100 + Math.random() * 400) * 100) / 100;
        const filledOrder = fillPaperOrder(order.id, simulatedPrice);
        if (filledOrder) {
          logExecutionAudit({ orderId: order.id, symbol: order.symbol, action: "fill", status: "simulated_fill", source: "paper_engine", aiDecisionRef: cycleId, details: `Simulated fill at ${simulatedPrice}` });
          filled.push(filledOrder);
        }
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
