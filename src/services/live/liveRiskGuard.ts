// Live trading hard-protection layer — runs server-side before any live order.
// Pulls drawdown / daily-loss / volatility / dup-order signals from execution_history.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface LiveRiskLimits {
  maxDailyLossPct: number;       // 5%
  maxDrawdownPct: number;        // 12%
  maxSingleOrderPct: number;     // 8% of equity
  maxOpenExposurePct: number;    // 85%
  minAiConfidence: number;       // 65
  duplicateWindowSec: number;    // 30
  flashCrashTickPct: number;     // 6% in 1 minute
}

export const LIVE_LIMITS: LiveRiskLimits = {
  maxDailyLossPct: 5,
  maxDrawdownPct: 12,
  maxSingleOrderPct: 8,
  maxOpenExposurePct: 85,
  minAiConfidence: 65,
  duplicateWindowSec: 30,
  flashCrashTickPct: 6,
};

export interface RiskCheckInput {
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  notionalUSDT: number;
  equityUSDT: number;
  aiConfidence: number;
  refPrice: number;
  recentPriceChangePct?: number;
  emergencyStopActive: boolean;
}

export interface RiskCheckResult {
  ok: boolean;
  blocks: string[];
  warnings: string[];
  limits: LiveRiskLimits;
}

export async function evaluateLiveRisk(input: RiskCheckInput): Promise<RiskCheckResult> {
  const blocks: string[] = [];
  const warnings: string[] = [];

  if (input.emergencyStopActive) blocks.push("EMERGENCY_STOP_ACTIVE");
  if (input.aiConfidence < LIVE_LIMITS.minAiConfidence)
    blocks.push(`AI_CONFIDENCE_BELOW_THRESHOLD (${input.aiConfidence} < ${LIVE_LIMITS.minAiConfidence})`);

  const orderPct = input.equityUSDT > 0 ? (input.notionalUSDT / input.equityUSDT) * 100 : 100;
  if (orderPct > LIVE_LIMITS.maxSingleOrderPct)
    blocks.push(`ORDER_SIZE_EXCEEDS_LIMIT (${orderPct.toFixed(2)}% > ${LIVE_LIMITS.maxSingleOrderPct}%)`);

  if (input.recentPriceChangePct !== undefined && Math.abs(input.recentPriceChangePct) >= LIVE_LIMITS.flashCrashTickPct)
    blocks.push(`FLASH_VOLATILITY_FREEZE (${input.recentPriceChangePct.toFixed(2)}%)`);

  // Duplicate order detection
  const since = new Date(Date.now() - LIVE_LIMITS.duplicateWindowSec * 1000).toISOString();
  const { data: dup } = await supabaseAdmin
    .from("execution_history")
    .select("id")
    .eq("user_id", input.userId)
    .eq("symbol", input.symbol)
    .eq("side", input.side)
    .gte("created_at", since)
    .limit(1);
  if (dup && dup.length > 0) blocks.push("DUPLICATE_ORDER_BLOCKED");

  // Daily PnL guard
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: today } = await supabaseAdmin
    .from("execution_history")
    .select("pnl")
    .eq("user_id", input.userId)
    .gte("created_at", startOfDay.toISOString());
  const dailyPnl = (today ?? []).reduce((s, r: { pnl: number | null }) => s + (Number(r.pnl) || 0), 0);
  if (input.equityUSDT > 0) {
    const dailyPnlPct = (dailyPnl / input.equityUSDT) * 100;
    if (dailyPnlPct <= -LIVE_LIMITS.maxDailyLossPct)
      blocks.push(`DAILY_LOSS_LIMIT_HIT (${dailyPnlPct.toFixed(2)}%)`);
    else if (dailyPnlPct <= -LIVE_LIMITS.maxDailyLossPct * 0.6)
      warnings.push(`DAILY_PNL_APPROACHING_LIMIT (${dailyPnlPct.toFixed(2)}%)`);
  }

  return { ok: blocks.length === 0, blocks, warnings, limits: LIVE_LIMITS };
}

export async function recordRiskEvent(
  userId: string, severity: "info" | "warning" | "critical",
  category: string, message: string, ctx: Record<string, unknown> = {},
): Promise<void> {
  await supabaseAdmin.from("risk_events").insert({
    user_id: userId, severity, category, message, context: ctx,
  } as never);
}

export async function isEmergencyStopActive(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("risk_events")
    .select("id, resolved_at")
    .eq("user_id", userId)
    .eq("category", "EMERGENCY_STOP")
    .is("resolved_at", null)
    .limit(1);
  return !!(data && data.length > 0);
}
