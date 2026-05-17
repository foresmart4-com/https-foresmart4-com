// Institutional scoring — composite per-asset rating in clean tiers.
import type { AssetKey } from "@/services/market/marketData";
import type { TradePlan } from "@/services/execution/tradePlanner";
import type { FilteredSignal } from "./signalQualityFilter";
import type { NoiseReport } from "./noiseReduction";
import type { RegimeReport } from "@/services/quant/regimeDetection";

export type InstitutionalRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C";
export type ExecutionGrade = "Excellent" | "Strong" | "Acceptable" | "Weak" | "Skip";

export interface InstitutionalScore {
  asset: AssetKey;
  assetName: string;
  rating: InstitutionalRating;
  executionGrade: ExecutionGrade;
  edgeQuality: number;       // 0-100
  components: {
    signal: number;
    timing: number;
    regime: number;
    opportunity: number;
    execution: number;
    riskAdjusted: number;
  };
}

function rate(score: number): InstitutionalRating {
  if (score >= 88) return "AAA";
  if (score >= 80) return "AA";
  if (score >= 72) return "A";
  if (score >= 62) return "BBB";
  if (score >= 52) return "BB";
  if (score >= 40) return "B";
  return "C";
}

function grade(execution: number, edge: number): ExecutionGrade {
  const v = (execution + edge) / 2;
  if (v >= 78) return "Excellent";
  if (v >= 65) return "Strong";
  if (v >= 50) return "Acceptable";
  if (v >= 35) return "Weak";
  return "Skip";
}

export function scorePlan(
  plan: TradePlan,
  filtered: FilteredSignal | undefined,
  noise: NoiseReport | undefined,
  regime: RegimeReport,
): InstitutionalScore {
  const signal = filtered?.institutionalConfidence ?? plan.confidence;
  const timing = plan.timing.executionQuality;
  const regimeQ = regime.confidence;
  const stability = 100 - (noise?.noiseLevel ?? 40);
  const opportunity = plan.entry.confidence;
  const execution = Math.max(0, Math.min(100, Math.round(timing * 0.6 + stability * 0.4)));
  const riskAdjusted = Math.max(0, Math.min(100, Math.round(
    signal * 0.5 + (100 - plan.sizing.cautionScore) * 0.35 + opportunity * 0.15,
  )));

  const edgeQuality = Math.round(
    signal * 0.32 + timing * 0.18 + opportunity * 0.18
    + regimeQ * 0.12 + stability * 0.1 + riskAdjusted * 0.1,
  );

  return {
    asset: plan.asset, assetName: plan.assetName,
    rating: rate(edgeQuality),
    executionGrade: grade(execution, edgeQuality),
    edgeQuality,
    components: { signal, timing, regime: regimeQ, opportunity, execution, riskAdjusted },
  };
}

export function scoreAllPlans(
  plans: TradePlan[],
  filtered: FilteredSignal[],
  noise: NoiseReport[],
  regime: RegimeReport,
): InstitutionalScore[] {
  const fMap = new Map(filtered.map((f) => [f.asset, f]));
  const nMap = new Map(noise.map((n) => [n.asset, n]));
  return plans
    .map((p) => scorePlan(p, fMap.get(p.asset), nMap.get(p.asset), regime))
    .sort((a, b) => b.edgeQuality - a.edgeQuality);
}
