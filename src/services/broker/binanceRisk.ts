// Broker-side risk guardrails before submission to Binance.
import type { PlaceOrderInput } from "./binanceExecution";

export interface BrokerRiskLimits {
  maxOrderNotionalUSDT: number;
  maxQty: number;
  allowedSymbols?: string[];
}

export const DEFAULT_BROKER_LIMITS: BrokerRiskLimits = {
  maxOrderNotionalUSDT: 5_000,
  maxQty: 1_000,
};

export interface RiskCheckResult { ok: boolean; reasons: string[]; }

export function preflightRisk(
  order: PlaceOrderInput,
  refPrice: number,
  limits: BrokerRiskLimits = DEFAULT_BROKER_LIMITS,
): RiskCheckResult {
  const reasons: string[] = [];
  const notional = order.quantity * (order.price ?? refPrice);
  if (notional > limits.maxOrderNotionalUSDT) reasons.push(`Notional ${notional.toFixed(0)} > ${limits.maxOrderNotionalUSDT}`);
  if (order.quantity > limits.maxQty) reasons.push(`Quantity ${order.quantity} > ${limits.maxQty}`);
  if (limits.allowedSymbols && !limits.allowedSymbols.includes(order.symbol)) reasons.push(`Symbol ${order.symbol} not allowed`);
  return { ok: reasons.length === 0, reasons };
}
