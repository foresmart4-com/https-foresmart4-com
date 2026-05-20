// Risk Guard for stock orders.
// - Max order notional in USD.
// - Daily realized loss limit (per user, from execution_history pnl).
// - Emergency stop via risk_events.category='EMERGENCY_STOP' with no resolved_at.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PlaceOrderInput } from "./types";

export interface StockRiskConfig {
  maxOrderNotionalUsd: number;
  dailyLossLimitUsd: number;
}

export const DEFAULT_STOCK_RISK: StockRiskConfig = {
  maxOrderNotionalUsd: Number(process.env.STOCK_MAX_ORDER_USD ?? 5_000),
  dailyLossLimitUsd: Number(process.env.STOCK_DAILY_LOSS_USD ?? 1_000),
};

export interface RiskEvaluation {
  allowed: boolean;
  reason?: string;
  notionalUsd: number;
  dailyPnlUsd: number;
  config: StockRiskConfig;
  emergencyStopActive: boolean;
}

export async function isStockEmergencyStopActive(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("risk_events")
    .select("id")
    .eq("user_id", userId)
    .eq("category", "EMERGENCY_STOP")
    .is("resolved_at", null)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export async function getDailyRealizedPnl(userId: string): Promise<number> {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("execution_history")
    .select("pnl, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  return (data ?? []).reduce((sum, row: { pnl: number | null }) => sum + (Number(row.pnl) || 0), 0);
}

export async function evaluateStockOrderRisk(params: {
  userId: string;
  order: PlaceOrderInput;
  refPrice: number;
  config?: Partial<StockRiskConfig>;
}): Promise<RiskEvaluation> {
  const cfg: StockRiskConfig = { ...DEFAULT_STOCK_RISK, ...(params.config ?? {}) };
  const notionalUsd = Math.abs(params.order.qty * params.refPrice);
  const [stopActive, dailyPnl] = await Promise.all([
    isStockEmergencyStopActive(params.userId),
    getDailyRealizedPnl(params.userId),
  ]);

  if (stopActive) {
    return { allowed: false, reason: "Emergency stop is active.", notionalUsd, dailyPnlUsd: dailyPnl, config: cfg, emergencyStopActive: true };
  }
  if (notionalUsd > cfg.maxOrderNotionalUsd) {
    return { allowed: false, reason: `Order notional $${notionalUsd.toFixed(2)} exceeds max $${cfg.maxOrderNotionalUsd}.`, notionalUsd, dailyPnlUsd: dailyPnl, config: cfg, emergencyStopActive: false };
  }
  if (dailyPnl < 0 && Math.abs(dailyPnl) >= cfg.dailyLossLimitUsd) {
    return { allowed: false, reason: `Daily loss limit reached ($${Math.abs(dailyPnl).toFixed(2)}).`, notionalUsd, dailyPnlUsd: dailyPnl, config: cfg, emergencyStopActive: false };
  }
  return { allowed: true, notionalUsd, dailyPnlUsd: dailyPnl, config: cfg, emergencyStopActive: false };
}

export async function recordStockRiskEvent(userId: string, severity: "info" | "warning" | "critical", category: string, message: string, context: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabaseAdmin.from("risk_events").insert({
      user_id: userId, severity, category, message, context,
    } as never);
  } catch {
    // best-effort audit
  }
}
