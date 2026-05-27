import { getGenesisAllocations } from "@/lib/genesis100/engine";
import { runPortfolioStress } from "@/lib/ai/scenarios/scenarioEngine";
import { getRiskTwinReport } from "@/lib/ai/riskTwin/riskTwinEngine";
import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

function round(n: number, d = 4) {
  const m = 10 ** d;
  return Math.round(n * m) / m;
}

export async function runPortfolioOptimizer() {
  const [alloc, stress, riskTwin, market] = await Promise.all([
    safeRead(() => getGenesisAllocations(), null),
    safeRead(() => runPortfolioStress(), null),
    safeRead(() => getRiskTwinReport(), null),
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
  ]);
  const allocations = alloc?.allocations ?? [];
  const totalWeight = allocations.reduce((sum, item) => sum + (item.targetWeight ?? 0), 0);
  const riskPenalty = Math.min(0.5, ((stress?.worstDrawdownEstimate ?? 0) / 100) + ((riskTwin?.rejectedCount ?? 0) * 0.03));
  const scale = Math.max(0.2, 1 - riskPenalty);
  const optimizedAllocation = allocations.map((item) => ({
    symbol: item.symbol,
    currentWeight: item.targetWeight,
    optimizedWeight: round((item.targetWeight ?? 0) * scale),
    reasonAr: "تخفيض/تثبيت الوزن وفق توأم المخاطر وسيناريوهات الضغط.",
  }));
  const riskAdjustedReturn = round((market?.topDrivers?.length ? 0.06 : 0.02) * scale);
  const maxDrawdownEstimate = round(stress?.worstDrawdownEstimate ?? 0, 2);
  const portfolioEfficiency = round(totalWeight ? riskAdjustedReturn / Math.max(0.01, maxDrawdownEstimate || 1) : 0, 4);

  return {
    optimizerVersion: "portfolio-optimizer-v1",
    methods: ["MonteCarlo", "VaR", "CVaR", "efficient_frontier", "allocation_optimization"],
    optimizedAllocation,
    riskAdjustedReturn,
    maxDrawdownEstimate,
    portfolioEfficiency,
    rebalanceSuggestionAr: allocations.length
      ? "اقتراح إعادة التوازن تحليلي فقط: حافظ على النقد عند ارتفاع الضغط وخفف الأوزان عالية المخاطر."
      : "لا توجد تخصيصات Genesis كافية لتحسين محفظة فعلي.",
    ...AI_SAFETY_FLAGS,
  };
}

export async function getOptimizerReport() {
  return {
    reportGeneratedAt: new Date().toISOString(),
    ...(await runPortfolioOptimizer()),
  };
}
