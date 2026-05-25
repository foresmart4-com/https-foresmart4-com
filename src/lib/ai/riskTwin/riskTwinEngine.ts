import { getGenesisAllocations } from "@/lib/genesis100/engine";
import { getRouterDiagnostics } from "@/lib/market/router";
import { runPortfolioStress, runScenario } from "@/lib/ai/scenarios/scenarioEngine";
import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";

interface RiskTwinDecisionInput {
  symbol?: string;
  action?: string;
  targetWeight?: number;
  confidencePercent?: number;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function currentAllocations() {
  return getGenesisAllocations().allocations ?? [];
}

export async function testRiskTwinDecision(input: RiskTwinDecisionInput = {}) {
  const symbol = (input.symbol || "AAPL").toUpperCase();
  const targetWeight = Number(input.targetWeight ?? 0);
  const confidence = clamp(Number(input.confidencePercent ?? 50));
  const allocations = currentAllocations();
  const existing = allocations.find((item) => item.symbol.toUpperCase() === symbol);
  const totalWeight = allocations.reduce((sum, item) => sum + (item.targetWeight ?? 0), 0);
  const projectedWeight = Math.max(0, targetWeight || existing?.targetWeight || 0);
  const concentration = projectedWeight > 0.08 ? 30 : projectedWeight > 0.05 ? 15 : 5;
  const scenario = await safeRead(() => runScenario("liquidity_crisis"), null);
  const provider = await safeRead(() => getRouterDiagnostics(), null);
  const market = await safeRead(() => new MarketIntelligenceAgent().analyze(), null);
  const sourceCredibility = getSourceCredibilityReport();
  const providerFailures = provider?.metrics ? Object.values(provider.metrics).filter((m: any) => m.errors > m.successes).length : 0;

  const drawdownImpact = Math.min(40, Math.abs(projectedWeight * (scenario?.expectedImpactPercent ?? -10)) * 10);
  const correlationShock = totalWeight > 0.8 ? 15 : 5;
  const liquidityShock = scenario?.riskLevel === "critical" ? 20 : 10;
  const volatility = market?.riskLevel === "high" ? 20 : 10;
  const providerFailure = Math.min(20, providerFailures * 4);
  const macroStress = scenario?.riskLevel === "critical" ? 18 : 8;
  const concentrationRisk = concentration;
  const correlationRisk = correlationShock;
  const liquidityRisk = liquidityShock;
  const riskPenalty = drawdownImpact + concentration + correlationShock + liquidityShock + volatility + providerFailure + macroStress;
  const riskTwinScore = clamp(confidence - riskPenalty / 2 + 35);
  const maxExpectedDrawdown = Number(Math.min(100, drawdownImpact + macroStress + concentration).toFixed(2));
  const failurePoints = [
    ...(concentration >= 30 ? ["concentration"] : []),
    ...(liquidityShock >= 20 ? ["liquidity_shock"] : []),
    ...(providerFailure >= 10 ? ["provider_failure"] : []),
    ...(macroStress >= 18 ? ["macro_stress"] : []),
    ...(confidence < 51 ? ["low_confidence"] : []),
  ];
  const hardBlockers = failurePoints.filter((point) => ["concentration", "low_confidence"].includes(point));
  const riskTwinApproved = riskTwinScore >= 55 && hardBlockers.length === 0;

  return {
    riskTwinVersion: "risk-twin-v1",
    symbol,
    action: input.action ?? "watch",
    riskTwinApproved,
    riskTwinScore,
    maxDrawdown: maxExpectedDrawdown,
    maxExpectedDrawdown,
    liquidityRisk,
    correlationRisk,
    concentrationRisk,
    failurePoints,
    approvalReasonAr: riskTwinApproved ? "قرار مقبول للمراقبة أو التداول الورقي ضمن حدود المخاطر." : null,
    rejectionReasonAr: riskTwinApproved ? null : "القرار مرفوض أو يحتاج مراجعة بسبب مخاطر التركيز أو السيولة أو ضعف الثقة.",
    tests: {
      drawdownImpact,
      concentration,
      correlationShock,
      liquidityShock,
      volatility,
      providerFailure,
      macroStress,
    },
    sourceCredibilityAverage: sourceCredibility.averageCredibility,
    ...AI_SAFETY_FLAGS,
  };
}

export async function getRiskTwinStatus() {
  const allocations = currentAllocations();
  const stress = await safeRead(() => runPortfolioStress(), null);
  return {
    riskTwinVersion: "risk-twin-v1",
    ready: true,
    allocationCount: allocations.length,
    lastStressSummaryAr: stress?.summaryAr ?? "لا توجد بيانات ضغط كافية بعد.",
    monitoredRisks: ["drawdown", "concentration", "correlation_shock", "liquidity_shock", "volatility", "provider_failure", "macro_stress"],
    ...AI_SAFETY_FLAGS,
  };
}

export async function getRiskTwinReport() {
  const allocations = currentAllocations();
  const stress = await safeRead(() => runPortfolioStress(), null);
  const sampleTests = await Promise.all(allocations.slice(0, 5).map((item) =>
    testRiskTwinDecision({ symbol: item.symbol, targetWeight: item.targetWeight, confidencePercent: item.decisionConfidencePercent }),
  ));
  return {
    riskTwinVersion: "risk-twin-v1",
    portfolioDrawdownEstimate: stress?.worstDrawdownEstimate ?? 0,
    worstScenario: stress?.worstScenario ?? null,
    testedAllocations: sampleTests,
    approvedCount: sampleTests.filter((item) => item.riskTwinApproved).length,
    rejectedCount: sampleTests.filter((item) => !item.riskTwinApproved).length,
    reportAr: sampleTests.length ? "تم اختبار عينة من قرارات Genesis ضد توأم المخاطر." : "لا توجد تخصيصات Genesis كافية لاختبار تقرير كامل.",
    ...AI_SAFETY_FLAGS,
  };
}
