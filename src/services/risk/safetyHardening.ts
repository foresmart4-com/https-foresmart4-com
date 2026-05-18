/**
 * Safety Hardening — cascading loss, revenge trading, rapid-loss freeze,
 * volatility shutdown, disconnect handling, anomaly + sanity checks.
 */

export interface RecentTrade { ts: number; pnl: number; symbol: string; }
export interface SafetyState {
  block: boolean;
  reasons: string[];
  cooldownMs: number;
}

export interface SafetyInput {
  trades: RecentTrade[];           // last N
  equity: number;
  startEquity: number;
  lastTickAgeMs: number;
  volatility: number;
  pendingOrderRate: number;        // orders per minute
  lastTradeSymbol?: string;
}

export function runSafetyChecks(input: SafetyInput): SafetyState {
  const reasons: string[] = [];
  let block = false;
  let cooldownMs = 0;
  const now = Date.now();
  const last10m = input.trades.filter((t) => now - t.ts < 10 * 60_000);
  const losses = last10m.filter((t) => t.pnl < 0);
  const totalLossPct =
    input.startEquity > 0
      ? Math.abs(last10m.reduce((s, t) => s + Math.min(0, t.pnl), 0)) / input.startEquity
      : 0;

  // Cascading loss
  if (losses.length >= 3 && totalLossPct > 0.02) {
    block = true; cooldownMs = 30 * 60_000;
    reasons.push("Cascading loss protection — 30m cooldown");
  }
  // Rapid loss freeze
  if (totalLossPct > 0.04) {
    block = true; cooldownMs = Math.max(cooldownMs, 60 * 60_000);
    reasons.push("Rapid loss — 1h freeze");
  }
  // Revenge trading: repeated entries on same symbol after a loss
  if (input.lastTradeSymbol) {
    const recentSame = last10m.filter((t) => t.symbol === input.lastTradeSymbol);
    const recentLossSame = recentSame.filter((t) => t.pnl < 0);
    if (recentLossSame.length >= 2 && recentSame.length >= 3) {
      block = true; cooldownMs = Math.max(cooldownMs, 15 * 60_000);
      reasons.push(`Revenge-trading guard on ${input.lastTradeSymbol}`);
    }
  }
  // Volatility shutdown
  if (input.volatility > 0.08) {
    block = true; cooldownMs = Math.max(cooldownMs, 20 * 60_000);
    reasons.push("Volatility shutdown");
  }
  // Disconnect
  if (input.lastTickAgeMs > 60_000) {
    block = true; cooldownMs = Math.max(cooldownMs, 5 * 60_000);
    reasons.push("Market data stale / disconnect");
  }
  // Order anomaly
  if (input.pendingOrderRate > 20) {
    block = true; cooldownMs = Math.max(cooldownMs, 10 * 60_000);
    reasons.push("Order anomaly — abnormal submission rate");
  }
  return { block, reasons, cooldownMs };
}

export interface SanityCheck { ok: boolean; reason?: string; }

export function aiSanityCheck(args: {
  proposedNotional: number;
  equity: number;
  confidence: number;
  stopDistancePct: number;
  takeProfitDistancePct: number;
}): SanityCheck {
  if (args.proposedNotional <= 0) return { ok: false, reason: "Zero notional" };
  if (args.proposedNotional > args.equity * 0.1)
    return { ok: false, reason: "Notional exceeds 10% equity" };
  if (args.confidence < 0.35) return { ok: false, reason: "Confidence too low" };
  if (args.stopDistancePct <= 0 || args.stopDistancePct > 0.1)
    return { ok: false, reason: "Stop distance out of band" };
  if (args.takeProfitDistancePct < args.stopDistancePct * 0.8)
    return { ok: false, reason: "Reward/risk asymmetry rejected" };
  return { ok: true };
}
