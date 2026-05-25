import { runGenesisBacktest } from "@/lib/ai/backtesting/backtestEngine";
import { runPortfolioStress } from "@/lib/ai/scenarios/scenarioEngine";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export type StrategyId = "growth" | "value" | "momentum" | "defensive" | "macro" | "income" | "crisis_hedge" | "balanced_ai";

export interface StrategyScore {
  id: StrategyId;
  nameAr: string;
  expectedReturnScore: number;
  riskScore: number;
  drawdownScore: number;
  macroFitScore: number;
  marketFitScore: number;
  historicalFitScore: number;
  confidencePercent: number;
  recommendedWeight: number;
  explanationAr: string;
}

const STRATEGIES: Array<{ id: StrategyId; nameAr: string; riskBase: number; returnBase: number }> = [
  { id: "growth", nameAr: "النمو", riskBase: 68, returnBase: 76 },
  { id: "value", nameAr: "القيمة", riskBase: 45, returnBase: 64 },
  { id: "momentum", nameAr: "الزخم", riskBase: 70, returnBase: 72 },
  { id: "defensive", nameAr: "الدفاعية", riskBase: 30, returnBase: 48 },
  { id: "macro", nameAr: "الماكرو", riskBase: 52, returnBase: 60 },
  { id: "income", nameAr: "الدخل", riskBase: 35, returnBase: 45 },
  { id: "crisis_hedge", nameAr: "تحوط الأزمات", riskBase: 28, returnBase: 42 },
  { id: "balanced_ai", nameAr: "الذكاء المتوازن", riskBase: 48, returnBase: 66 },
];

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function listStrategies() {
  return {
    strategyLabVersion: "strategy-lab-v1",
    strategies: STRATEGIES.map((s) => ({ id: s.id, nameAr: s.nameAr })),
    ...AI_SAFETY_FLAGS,
  };
}

export async function compareStrategies(): Promise<{ strategyLabVersion: string; strategies: StrategyScore[] } & typeof AI_SAFETY_FLAGS> {
  const [backtest, stress, knowledge, archive, macro] = await Promise.all([
    Promise.resolve(runGenesisBacktest("90d")),
    runPortfolioStress(),
    applyKnowledge("AAPL"),
    Promise.resolve(getGenesisArchiveSummary()),
    getMacroFeed(),
  ]);
  const backtestReady = "ready" in backtest && backtest.ready === true;
  const historicalBoost = backtestReady ? Math.min(20, Number(backtest.strategyAccuracy ?? 0) / 5) : 0;
  const stressPenalty = Math.min(25, Number(stress.worstDrawdownEstimate ?? 0) * 2);
  const macroBoost = macro.confidencePercent / 5;
  const knowledgeBoost = (knowledge.confidence ?? 50) / 10;
  const archiveDepth = Math.min(10, (archive.count ?? 0) / 5);

  const raw = STRATEGIES.map((s) => {
    const expectedReturnScore = clamp(s.returnBase + historicalBoost + knowledgeBoost - (s.id === "crisis_hedge" ? 0 : stressPenalty / 3));
    const riskScore = clamp(s.riskBase + stressPenalty - (s.id === "defensive" || s.id === "crisis_hedge" ? 15 : 0));
    const drawdownScore = clamp(100 - riskScore);
    const macroFitScore = clamp((s.id === "macro" || s.id === "crisis_hedge" ? 68 : 52) + macroBoost);
    const marketFitScore = clamp((expectedReturnScore + drawdownScore) / 2);
    const historicalFitScore = clamp(backtestReady ? Number(backtest.strategyAccuracy ?? 50) : 35 + archiveDepth);
    const confidencePercent = clamp((expectedReturnScore + drawdownScore + macroFitScore + historicalFitScore) / 4);
    return {
      id: s.id,
      nameAr: s.nameAr,
      expectedReturnScore,
      riskScore,
      drawdownScore,
      macroFitScore,
      marketFitScore,
      historicalFitScore,
      confidencePercent,
      recommendedWeight: 0,
      explanationAr: `استراتيجية ${s.nameAr}: عائد متوقع ${expectedReturnScore}/100، مخاطر ${riskScore}/100، ملاءمة ماكرو ${macroFitScore}/100.`,
    };
  });

  const total = raw.reduce((sum, item) => sum + Math.max(1, item.confidencePercent - item.riskScore / 3), 0);
  const strategies = raw
    .map((item) => ({
      ...item,
      recommendedWeight: Number((Math.max(1, item.confidencePercent - item.riskScore / 3) / total).toFixed(4)),
    }))
    .sort((a, b) => b.confidencePercent - a.confidencePercent);

  return {
    strategyLabVersion: "strategy-lab-v1",
    strategies,
    ...AI_SAFETY_FLAGS,
  };
}

export async function getStrategyRecommendation() {
  const comparison = await compareStrategies();
  const best = comparison.strategies[0] ?? null;
  return {
    strategyLabVersion: "strategy-lab-v1",
    bestStrategy: best,
    recommendationAr: best
      ? `أفضل استراتيجية حالياً هي ${best.nameAr} بثقة ${best.confidencePercent}% ووزن مقترح ${(best.recommendedWeight * 100).toFixed(1)}%.`
      : "لا توجد بيانات كافية لاختيار استراتيجية.",
    comparisonTable: comparison.strategies,
    ...AI_SAFETY_FLAGS,
  };
}
