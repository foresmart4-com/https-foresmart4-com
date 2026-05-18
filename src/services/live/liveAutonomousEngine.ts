// Live autonomous trading orchestrator — evaluates a candidate signal,
// runs risk guard, executes against Binance, logs decision + execution.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BinanceClient } from "@/services/broker/binanceRealConnector";
import { placeOrder } from "@/services/broker/binanceExecution";
import { getAccountInfo } from "@/services/broker/binanceAccount";
import { evaluateLiveRisk, isEmergencyStopActive, recordRiskEvent } from "./liveRiskGuard";

export interface AutonomousSignal {
  symbol: string;               // e.g. BTCUSDT
  side: "BUY" | "SELL";
  refPrice: number;
  aiConfidence: number;         // 0-100
  rationale: string;
  regime?: string;
  recentPriceChangePct?: number;
  targetAllocationPct?: number; // default 5%
}

export interface AutonomousResult {
  executed: boolean;
  status: string;
  orderId?: string | null;
  blocks: string[];
  warnings: string[];
  notionalUSDT: number;
  decisionId?: string;
}

export async function runAutonomousCycle(
  userId: string, client: BinanceClient,
  signal: AutonomousSignal,
): Promise<AutonomousResult> {
  const acct = await getAccountInfo(client);
  const equity = acct.equityUSDT;
  const allocPct = Math.min(signal.targetAllocationPct ?? 5, 8);
  const notional = (equity * allocPct) / 100;

  const stopActive = await isEmergencyStopActive(userId);
  const risk = await evaluateLiveRisk({
    userId,
    symbol: signal.symbol,
    side: signal.side,
    notionalUSDT: notional,
    equityUSDT: equity,
    aiConfidence: signal.aiConfidence,
    refPrice: signal.refPrice,
    recentPriceChangePct: signal.recentPriceChangePct,
    emergencyStopActive: stopActive,
  });

  // Log AI decision regardless of execution
  const { data: decision } = await supabaseAdmin
    .from("ai_decisions").insert({
      user_id: userId,
      asset: signal.symbol,
      action: risk.ok ? `EXECUTE_${signal.side}` : `BLOCKED_${signal.side}`,
      confidence: signal.aiConfidence,
      regime: signal.regime ?? null,
      rationale: signal.rationale,
      context: { risk, signal, equity, notional },
    } as never).select("id").single();

  if (!risk.ok) {
    if (risk.blocks.includes("EMERGENCY_STOP_ACTIVE") === false) {
      await recordRiskEvent(userId, "warning", "AUTONOMOUS_BLOCKED",
        `Blocked ${signal.side} ${signal.symbol}`, { blocks: risk.blocks });
    }
    return { executed: false, status: "BLOCKED", blocks: risk.blocks, warnings: risk.warnings, notionalUSDT: notional, decisionId: decision?.id };
  }

  // Quantize quantity from notional / refPrice; Binance handles LOT_SIZE rejection.
  const qty = Number((notional / signal.refPrice).toFixed(6));
  if (qty <= 0) {
    return { executed: false, status: "ZERO_QUANTITY", blocks: ["ZERO_QUANTITY"], warnings: risk.warnings, notionalUSDT: notional, decisionId: decision?.id };
  }

  try {
    const result = await placeOrder(client, {
      symbol: signal.symbol, side: signal.side, type: "MARKET",
      quantity: qty,
    });
    await supabaseAdmin.from("execution_history").insert({
      user_id: userId, broker: "binance", mode: client.mode,
      symbol: signal.symbol, side: signal.side, type: "MARKET",
      quantity: qty, price: result.avgPrice ?? signal.refPrice,
      status: result.status, order_id: result.orderId,
      metadata: { autonomous: true, regime: signal.regime, aiConfidence: signal.aiConfidence },
    } as never);
    return {
      executed: true, status: result.status, orderId: result.orderId,
      blocks: [], warnings: risk.warnings, notionalUSDT: notional, decisionId: decision?.id,
    };
  } catch (err) {
    const msg = (err as Error).message;
    await recordRiskEvent(userId, "critical", "AUTONOMOUS_EXECUTION_FAILED", msg, { signal });
    await supabaseAdmin.from("execution_history").insert({
      user_id: userId, broker: "binance", mode: client.mode,
      symbol: signal.symbol, side: signal.side, type: "MARKET",
      quantity: qty, price: signal.refPrice, status: "FAILED",
      metadata: { autonomous: true, error: msg },
    } as never);
    return { executed: false, status: "FAILED", blocks: [msg], warnings: risk.warnings, notionalUSDT: notional, decisionId: decision?.id };
  }
}
