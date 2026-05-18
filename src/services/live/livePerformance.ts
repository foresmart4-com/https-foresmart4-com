// Live performance analytics — Sharpe-like, max drawdown, win-rate, regime breakdown.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PerformanceReport {
  totalTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  pnlTotal: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeLike: number;
  maxDrawdownPct: number;
  bestTrade: number;
  worstTrade: number;
  regimeBreakdown: Record<string, { trades: number; pnl: number; winRate: number }>;
}

export async function computePerformance(userId: string): Promise<PerformanceReport> {
  const { data: trades } = await supabaseAdmin
    .from("execution_history").select("pnl, metadata, created_at, status")
    .eq("user_id", userId).order("created_at", { ascending: true });
  const rows = (trades ?? []) as Array<{ pnl: number | null; metadata: Record<string, unknown> | null }>;
  const pnls = rows.map((r) => Number(r.pnl) || 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const total = pnls.reduce((s, n) => s + n, 0);
  const avgWin = wins.length ? wins.reduce((s, n) => s + n, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, n) => s + n, 0) / losses.length : 0;
  const profitFactor = losses.length && Math.abs(avgLoss) > 0
    ? (wins.reduce((s, n) => s + n, 0)) / Math.abs(losses.reduce((s, n) => s + n, 0))
    : wins.length ? 99 : 0;

  // Sharpe-like: mean / stdev of trade returns
  const mean = pnls.length ? total / pnls.length : 0;
  const variance = pnls.length
    ? pnls.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / pnls.length : 0;
  const stdev = Math.sqrt(variance);
  const sharpe = stdev > 0 ? (mean / stdev) * Math.sqrt(252) : 0;

  // Max drawdown on cumulative equity curve
  let peak = 0; let cum = 0; let maxDd = 0;
  for (const p of pnls) {
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? ((peak - cum) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  // Regime breakdown from metadata
  const regimes: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const r of rows) {
    const reg = (r.metadata as { regime?: string } | null)?.regime ?? "unknown";
    const p = Number(r.pnl) || 0;
    if (!regimes[reg]) regimes[reg] = { trades: 0, pnl: 0, wins: 0 };
    regimes[reg].trades++;
    regimes[reg].pnl += p;
    if (p > 0) regimes[reg].wins++;
  }
  const regimeBreakdown: PerformanceReport["regimeBreakdown"] = {};
  for (const [k, v] of Object.entries(regimes)) {
    regimeBreakdown[k] = { trades: v.trades, pnl: v.pnl, winRate: v.trades ? (v.wins / v.trades) * 100 : 0 };
  }

  return {
    totalTrades: pnls.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: pnls.length ? (wins.length / pnls.length) * 100 : 0,
    pnlTotal: total,
    avgWin, avgLoss, profitFactor, sharpeLike: sharpe,
    maxDrawdownPct: maxDd,
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    regimeBreakdown,
  };
}
