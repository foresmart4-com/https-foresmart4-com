// Tactical Trade Planner — fuses entry, exit, sizing, timing and regime
// into an institutional-style trade plan per asset.
import type { AssetKey, MarketQuote } from "@/services/market/marketData";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { EntryZone } from "./entryZoneEngine";
import type { ExitPlan } from "./exitEngine";
import type { PositionSizing } from "./positionSizing";
import type { TimingReport } from "./timingEngine";

export type RiskProfile = "defensive" | "balanced" | "opportunistic" | "stand-aside";

export interface TradePlan {
  asset: AssetKey;
  assetName: string;
  bias: "long" | "short" | "neutral";
  regimeContext: string;
  entry: EntryZone;
  exit: ExitPlan;
  sizing: PositionSizing;
  timing: TimingReport;
  riskProfile: RiskProfile;
  confidence: number;       // 0-100
  reasoning: string;
}

export function buildTradePlan(
  q: MarketQuote,
  sig: CalibratedSignal | undefined,
  regime: RegimeReport,
  entry: EntryZone,
  exit: ExitPlan,
  sizing: PositionSizing,
  timing: TimingReport,
): TradePlan {
  const bias = entry.bias;

  let riskProfile: RiskProfile = "balanced";
  if (timing.recommendation === "stand-aside" || sizing.exposureWarning === "critical") riskProfile = "stand-aside";
  else if (sizing.exposureWarning === "elevated" || regime.regime === "Panic") riskProfile = "defensive";
  else if (entry.quality === "excellent" && timing.recommendation === "execute-now") riskProfile = "opportunistic";

  const confidence = Math.max(15, Math.min(95, Math.round(
    entry.confidence * 0.35 + (sig?.calibratedConfidence ?? 40) * 0.3
    + timing.executionQuality * 0.2 + (100 - sizing.cautionScore) * 0.15,
  )));

  const regimeContext = `${regime.regime} (${regime.confidence}% conviction) — ${regime.strategyHint}`;

  const directional = bias === "neutral" ? "No directional conviction"
    : `${bias === "long" ? "Constructive long" : "Tactical short"} setup`;
  const sizingLine = sizing.suggestedSizePct === 0
    ? "Position sizing recommends staying flat."
    : `Suggested sleeve ${sizing.riskAdjustedPct}% (raw ${sizing.suggestedSizePct}%).`;
  const reasoning = [
    `${directional} on ${q.name}.`,
    `Entry plan: ${entry.rangeLow}–${entry.rangeHigh} (${entry.quality} timing).`,
    `Exit framework: TP ${exit.takeProfit.join(" / ")}; stop ${exit.defensiveStop}.`,
    `Execution timing ${timing.executionQuality}/100 — ${timing.recommendation.replace("-", " ")}.`,
    sizingLine,
    `Regime: ${regimeContext}.`,
  ].join(" ");

  return {
    asset: q.key, assetName: q.name, bias,
    regimeContext, entry, exit, sizing, timing,
    riskProfile, confidence, reasoning,
  };
}

export function buildAllTradePlans(
  quotes: MarketQuote[],
  signals: CalibratedSignal[],
  regime: RegimeReport,
  entries: EntryZone[],
  exits: ExitPlan[],
  sizings: PositionSizing[],
  timings: TimingReport[],
): TradePlan[] {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  const eMap = new Map(entries.map((e) => [e.asset, e]));
  const xMap = new Map(exits.map((x) => [x.asset, x]));
  const pMap = new Map(sizings.map((p) => [p.asset, p]));
  const tMap = new Map(timings.map((t) => [t.asset, t]));
  return quotes
    .map((q) => {
      const e = eMap.get(q.key); const x = xMap.get(q.key);
      const p = pMap.get(q.key); const t = tMap.get(q.key);
      if (!e || !x || !p || !t) return null;
      return buildTradePlan(q, sigMap.get(q.key), regime, e, x, p, t);
    })
    .filter((v): v is TradePlan => v !== null)
    .sort((a, b) => b.confidence - a.confidence);
}
