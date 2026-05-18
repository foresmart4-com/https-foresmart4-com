// AI Allocation Engine — converts plan + market intelligence into a target portfolio.
import type { PlanTemplate } from "./planEngine";

export interface AllocationInput {
  assetKey: string;
  bias: "long" | "short" | "neutral";
  confidence: number;        // 0-100
  momentum: number;          // -100..100
  volatility: number;        // 0-100
  liquidity: number;         // 0-100
  edgeScore: number;         // 0-100
  regimeAlignment: number;   // 0-100
}

export interface AllocationSlice {
  asset: string;
  weightPct: number;
  capitalUSDT: number;
  rationale: string;
  confidence: number;
}

export interface AllocationResult {
  slices: AllocationSlice[];
  cashReservePct: number;
  diversificationScore: number;
  aggregateConfidence: number;
}

export function generateAllocation(
  template: PlanTemplate,
  capitalUSDT: number,
  signals: AllocationInput[],
): AllocationResult {
  const universe = template.targetMarkets.length
    ? signals.filter((s) => template.targetMarkets.includes(s.assetKey))
    : signals;

  // Score each asset (weighted blend, neutral bias gets penalized).
  const scored = universe.map((s) => {
    const biasMul = s.bias === "neutral" ? 0.4 : 1;
    const score = (
      s.confidence * 0.32 +
      s.edgeScore * 0.22 +
      s.regimeAlignment * 0.18 +
      Math.max(0, s.momentum) * 0.12 +
      s.liquidity * 0.08 +
      (100 - s.volatility) * 0.08
    ) * biasMul;
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, template.riskLevel === "low" ? 3 : template.riskLevel === "high" ? 5 : 4);
  const totalScore = top.reduce((a, s) => a + s.score, 0) || 1;

  // Cash buffer scales with risk appetite.
  const cashReservePct =
    template.riskLevel === "low" ? 30 :
    template.riskLevel === "high" ? 5 :
    template.riskLevel === "adaptive" ? 12 : 20;

  const investablePct = 100 - cashReservePct;
  const slices: AllocationSlice[] = top.map((s) => {
    const weight = (s.score / totalScore) * investablePct;
    const capped = Math.min(weight, template.riskLevel === "high" ? 40 : 30);
    return {
      asset: s.assetKey,
      weightPct: +capped.toFixed(2),
      capitalUSDT: +(capitalUSDT * capped / 100).toFixed(2),
      rationale: `${s.bias.toUpperCase()} bias · conf ${s.confidence.toFixed(0)} · edge ${s.edgeScore.toFixed(0)}`,
      confidence: Math.round(s.confidence),
    };
  });

  const totalWeight = slices.reduce((a, x) => a + x.weightPct, 0);
  if (totalWeight > 0 && totalWeight !== investablePct) {
    const scale = investablePct / totalWeight;
    slices.forEach((s) => {
      s.weightPct = +(s.weightPct * scale).toFixed(2);
      s.capitalUSDT = +(capitalUSDT * s.weightPct / 100).toFixed(2);
    });
  }

  const aggregateConfidence = Math.round(
    slices.reduce((a, s) => a + s.confidence * s.weightPct, 0) / Math.max(1, investablePct),
  );
  const herfindahl = slices.reduce((a, s) => a + (s.weightPct / 100) ** 2, 0);
  const diversificationScore = Math.round((1 - herfindahl) * 100);

  return { slices, cashReservePct, diversificationScore, aggregateConfidence };
}
