// AI Priority Engine — ranks only highest-value insights into tiers.
import type { TradePlan } from "@/services/execution/tradePlanner";
import type { FilteredSignal } from "./signalQualityFilter";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { AssetKey } from "@/services/market/marketData";

export type PriorityLevel = "P1" | "P2" | "P3";
export type OpportunityTier = "premium" | "standard" | "scout" | "skip";
export type UrgencyQuality = "imminent" | "soon" | "patient" | "monitor";

export interface PriorityItem {
  asset: AssetKey;
  assetName: string;
  level: PriorityLevel;
  tier: OpportunityTier;
  urgency: UrgencyQuality;
  score: number; // 0-100
  headline: string;
}

export function rankPriorities(
  plans: TradePlan[],
  filtered: FilteredSignal[],
  regime: RegimeReport,
): PriorityItem[] {
  const filtMap = new Map(filtered.map((f) => [f.asset, f]));

  return plans.map((p) => {
    const f = filtMap.get(p.asset);
    const instConf = f?.institutionalConfidence ?? p.confidence;
    const noise = f?.noiseScore ?? 50;

    const regimeAlign =
      (p.bias === "long" && (regime.regime === "Trending Bullish" || regime.regime === "Risk-On")) ||
      (p.bias === "short" && (regime.regime === "Trending Bearish" || regime.regime === "Risk-Off"))
        ? 12 : p.bias === "neutral" ? -6 : 0;

    const timingBoost =
      p.timing.recommendation === "execute-now" ? 14 :
      p.timing.recommendation === "scale-in"    ?  6 :
      p.timing.recommendation === "stand-aside" ? -25 : -8;

    const rrBoost = p.entry.quality === "excellent" ? 8 : p.entry.quality === "good" ? 4 : 0;

    const score = Math.max(0, Math.min(100, Math.round(
      instConf * 0.55 + p.timing.executionQuality * 0.2
      - noise * 0.2 + regimeAlign + timingBoost + rrBoost,
    )));

    const level: PriorityLevel = score >= 75 ? "P1" : score >= 55 ? "P2" : "P3";
    const tier: OpportunityTier =
      score >= 78 && (f?.grade === "A" || f?.grade === "B") ? "premium" :
      score >= 60 ? "standard" :
      score >= 42 ? "scout" : "skip";
    const urgency: UrgencyQuality =
      p.timing.recommendation === "execute-now" ? "imminent" :
      p.timing.recommendation === "scale-in" ? "soon" :
      p.timing.recommendation === "wait" ? "patient" : "monitor";

    const headline = tier === "skip"
      ? `${p.asset} below institutional threshold — monitor only.`
      : `${p.asset} ${p.bias} · ${tier} ${level} — ${p.timing.recommendation.replace("-", " ")}.`;

    return { asset: p.asset, assetName: p.assetName, level, tier, urgency, score, headline };
  })
    .filter((x) => x.tier !== "skip")
    .sort((a, b) => b.score - a.score);
}
