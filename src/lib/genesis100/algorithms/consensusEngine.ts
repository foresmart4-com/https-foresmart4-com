import type { MacroContext, AssetContext } from "./economicFramework";
import type { AllSchoolsAnalysis } from "./economicSchools";

export interface ConsensusWeights {
  keynesian: number;
  monetarist: number;
  austrian: number;
  behavioral: number;
  valueInvesting: number;
  globalMacro: number;
}

export interface ConsensusResult {
  weightedScore: number;
  adjustedScore: number;
  agreementLevel: "strong" | "moderate" | "weak" | "conflicted";
  dominantSchool: string;
  conflictingSchools: string[];
  weights: ConsensusWeights;
  schoolScores: Record<string, number>;
  arabicSummary: string;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(
    values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) /
      values.length,
  );
}

export function getDynamicWeights(
  macro: MacroContext,
  asset: AssetContext,
): ConsensusWeights {
  let w: ConsensusWeights = {
    keynesian: 0.15,
    monetarist: 0.20,
    austrian: 0.10,
    behavioral: 0.15,
    valueInvesting: 0.20,
    globalMacro: 0.20,
  };

  if (
    macro.monetaryEnvironment === "ultra_tight" ||
    macro.monetaryEnvironment === "tight"
  ) {
    w = { keynesian: 0.10, monetarist: 0.30, austrian: 0.10, behavioral: 0.10, valueInvesting: 0.25, globalMacro: 0.15 };
  }

  if (
    macro.debtCyclePhase === "depression" ||
    macro.debtCyclePhase === "recession"
  ) {
    w = { keynesian: 0.10, monetarist: 0.15, austrian: 0.20, behavioral: 0.20, valueInvesting: 0.05, globalMacro: 0.30 };
  }

  if (
    (asset.assetClass === "us_stock" ||
      asset.assetClass === "saudi_stock") &&
    macro.riskRegime === "risk_on"
  ) {
    w = { keynesian: 0.20, monetarist: 0.20, austrian: 0.05, behavioral: 0.10, valueInvesting: 0.30, globalMacro: 0.15 };
  }

  if (asset.assetClass === "crypto") {
    w = { keynesian: 0.05, monetarist: 0.20, austrian: 0.15, behavioral: 0.30, valueInvesting: 0.05, globalMacro: 0.25 };
  }

  if (asset.assetClass === "metal") {
    w = { keynesian: 0.05, monetarist: 0.20, austrian: 0.30, behavioral: 0.10, valueInvesting: 0.05, globalMacro: 0.30 };
  }

  // Normalize
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const keys = Object.keys(w) as (keyof ConsensusWeights)[];
  keys.forEach((k) => { w[k] = w[k] / total; });

  return w;
}

export function buildConsensus(
  schools: AllSchoolsAnalysis,
  weights: ConsensusWeights,
  asset: AssetContext,
): ConsensusResult {
  const weighted =
    schools.keynesian.score * weights.keynesian +
    schools.monetarist.score * weights.monetarist +
    schools.austrian.score * weights.austrian +
    schools.behavioral.score * weights.behavioral +
    schools.valueInvesting.score * weights.valueInvesting +
    schools.globalMacro.score * weights.globalMacro;

  const scores = [
    schools.keynesian.score,
    schools.monetarist.score,
    schools.austrian.score,
    schools.behavioral.score,
    schools.valueInvesting.score,
    schools.globalMacro.score,
  ];

  const sd = stdDev(scores);
  const agreementLevel: ConsensusResult["agreementLevel"] =
    sd < 8 ? "strong" :
    sd < 15 ? "moderate" :
    sd < 25 ? "weak" : "conflicted";

  const confidenceMultiplier =
    agreementLevel === "strong" ? 1.15 :
    agreementLevel === "moderate" ? 1.0 :
    agreementLevel === "weak" ? 0.88 : 0.72;

  const adjustedScore = Math.max(0, Math.min(100, weighted * confidenceMultiplier));

  const entries = [
    { name: "كينزية", score: schools.keynesian.score, weight: weights.keynesian },
    { name: "نقدية", score: schools.monetarist.score, weight: weights.monetarist },
    { name: "نمساوية", score: schools.austrian.score, weight: weights.austrian },
    { name: "سلوكية", score: schools.behavioral.score, weight: weights.behavioral },
    { name: "قيمة", score: schools.valueInvesting.score, weight: weights.valueInvesting },
    { name: "ماكرو", score: schools.globalMacro.score, weight: weights.globalMacro },
  ];

  const dominant = entries.reduce((a, b) =>
    a.score * a.weight > b.score * b.weight ? a : b,
  );

  const conflicting = entries
    .filter((s) => Math.abs(s.score - weighted) > 20)
    .map((s) => s.name);

  const actionAr =
    adjustedScore >= 82 ? "شراء قوي" :
    adjustedScore >= 68 ? "شراء" :
    adjustedScore >= 57 ? "تجميع تدريجي" :
    adjustedScore >= 43 ? "احتفاظ" :
    adjustedScore >= 32 ? "تخفيض" :
    adjustedScore >= 20 ? "بيع" : "خروج فوري";

  const arabicSummary =
    `${asset.symbol}: ${actionAr} — درجة التوافق: ${agreementLevel === "strong" ? "قوي" : agreementLevel === "moderate" ? "معتدل" : agreementLevel === "weak" ? "ضعيف" : "متعارض"} — المدرسة المهيمنة: ${dominant.name}` +
    (conflicting.length > 0 ? ` — تعارض مع: ${conflicting.join("، ")}` : "") +
    ` — هذا تحليل استشاري وليس ضمانًا للأرباح.`;

  return {
    weightedScore: weighted,
    adjustedScore,
    agreementLevel,
    dominantSchool: dominant.name,
    conflictingSchools: conflicting,
    weights,
    schoolScores: {
      keynesian: schools.keynesian.score,
      monetarist: schools.monetarist.score,
      austrian: schools.austrian.score,
      behavioral: schools.behavioral.score,
      valueInvesting: schools.valueInvesting.score,
      globalMacro: schools.globalMacro.score,
    },
    arabicSummary,
  };
}
