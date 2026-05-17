// Opportunity ranking — fuses momentum, confidence, breakout, regime,
// liquidity flow and whale behavior into an institutional opportunity score.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { EarlyMomentumReport } from "./earlyMomentumEngine";
import type { BreakoutReport } from "./breakoutPrediction";
import type { LiquidityFlowReport } from "./liquidityFlow";
import type { WhaleReport, WhaleSignal } from "./whaleTracker";

export interface RankedOpportunity {
  rank: number;
  asset: AssetKey;
  assetName: string;
  score: number;          // 0-100 institutional score
  timingQuality: number;  // 0-100
  riskReward: number;     // 0-100
  direction: "long" | "short" | "neutral";
  rationale: string;
}

const SECTOR_FOR_ASSET: Record<AssetKey, string> = {
  BTC: "Crypto", ETH: "Crypto", SPX: "Equities", NDX: "Equities",
  XAU: "Safe Haven", DXY: "Dollar", OIL: "Energy",
};

export function rankOpportunities(
  quotes: MarketQuote[],
  signals: Signal[],
  calibrated: CalibratedSignal[],
  regime: RegimeReport,
  early: EarlyMomentumReport[],
  breakouts: BreakoutReport[],
  liquidity: LiquidityFlowReport,
  whales: WhaleReport,
): RankedOpportunity[] {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  const calMap = new Map(calibrated.map((s) => [s.asset, s]));
  const earlyMap = new Map(early.map((e) => [e.asset, e]));
  const brkMap = new Map(breakouts.map((b) => [b.asset, b]));
  const whaleMap = new Map<AssetKey, WhaleSignal>(whales.signals.map((w) => [w.asset, w]));
  const sectorFlow = new Map(liquidity.sectors.map((s) => [s.sector, s.flowScore]));

  const items = quotes.map((q) => {
    const s = sigMap.get(q.key);
    const c = calMap.get(q.key);
    const e = earlyMap.get(q.key);
    const b = brkMap.get(q.key);
    const w = whaleMap.get(q.key);
    const sectorBias = sectorFlow.get(SECTOR_FOR_ASSET[q.key]) ?? 0;

    const conf = c?.calibratedConfidence ?? s?.confidence ?? 40;
    const momentumScore = Math.min(100, Math.abs(q.momentum) * 25);
    const earlyScore = e?.score ?? 0;
    const breakoutScore = b?.confidence ?? 0;
    const regimeAlign = regime.bias === "bullish" && q.changePct > 0 ? 15
      : regime.bias === "bearish" && q.changePct < 0 ? 15
      : regime.bias === "neutral" ? 5 : 0;
    const liquidityAlign = Math.min(20, Math.abs(sectorBias) * 0.25);
    const whalePenalty = (w?.manipulationRisk ?? 0) > 60 ? -10 : 0;
    const volPenalty = q.volatility > 75 ? -8 : 0;

    const score = Math.max(0, Math.min(100, Math.round(
      conf * 0.32 + momentumScore * 0.18 + earlyScore * 0.18 + breakoutScore * 0.18
      + regimeAlign + liquidityAlign + whalePenalty + volPenalty,
    )));

    const timingQuality = Math.max(0, Math.min(100, Math.round(
      (b?.squeeze ?? 0) * 0.4 + earlyScore * 0.4 + (e?.warning === "imminent" ? 20 : e?.warning === "watch" ? 10 : 0),
    )));

    const riskReward = Math.max(0, Math.min(100, Math.round(
      score - q.volatility * 0.35 - (w?.manipulationRisk ?? 0) * 0.2 + 30,
    )));

    let direction: RankedOpportunity["direction"] = "neutral";
    const actionDir = s?.action === "BUY" ? "long" : s?.action === "SELL" ? "short" : null;
    const brkDir = b?.direction === "up" ? "long" : b?.direction === "down" ? "short" : null;
    if (actionDir && brkDir && actionDir === brkDir) direction = actionDir;
    else if (actionDir) direction = actionDir;
    else if (brkDir) direction = brkDir;

    const rationale = [
      `Conf ${conf}`,
      e ? `Early ${e.score}` : null,
      b && b.direction !== "neutral" ? `Breakout ${b.direction} ${b.confidence}` : null,
      `Regime ${regime.bias}`,
      sectorBias ? `${SECTOR_FOR_ASSET[q.key]} flow ${sectorBias > 0 ? "+" : ""}${Math.round(sectorBias)}` : null,
      w && w.severity !== "info" ? `Whale ${w.severity}` : null,
    ].filter(Boolean).join(" · ");

    return {
      rank: 0,
      asset: q.key,
      assetName: q.name,
      score, timingQuality, riskReward, direction,
      rationale,
    } as RankedOpportunity;
  });

  items.sort((a, b) => b.score - a.score);
  items.forEach((it, i) => (it.rank = i + 1));
  return items;
}
