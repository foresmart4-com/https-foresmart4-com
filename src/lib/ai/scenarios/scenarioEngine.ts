import { getGenesisAllocations } from "@/lib/genesis100/engine";
import { routeQuote } from "@/lib/market/router";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

export type ScenarioId =
  | "oil_spike"
  | "oil_crash"
  | "fed_rate_hike"
  | "fed_rate_cut"
  | "dollar_strength"
  | "dollar_weakness"
  | "liquidity_crisis"
  | "recession"
  | "inflation_shock"
  | "crypto_crash"
  | "saudi_market_stress"
  | "geopolitical_risk";

export interface ScenarioDefinition {
  id: ScenarioId;
  nameAr: string;
  affectedAssets: string[];
  expectedImpactPercent: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  hedgeCandidates: string[];
}

export interface ScenarioResult extends ScenarioDefinition {
  portfolioDrawdownEstimate: number;
  assetsAtRisk: string[];
  recommendedActionAr: string;
  confidencePercent: number;
}

export const SCENARIOS: ScenarioDefinition[] = [
  { id: "oil_spike", nameAr: "ارتفاع حاد في النفط", affectedAssets: ["WTI", "BRENT", "XOM", "2222.SR"], expectedImpactPercent: 8, riskLevel: "high", hedgeCandidates: ["XAUUSD", "cash", "US10Y"] },
  { id: "oil_crash", nameAr: "هبوط حاد في النفط", affectedAssets: ["WTI", "BRENT", "XOM", "2222.SR"], expectedImpactPercent: -10, riskLevel: "high", hedgeCandidates: ["SPY", "QQQ", "cash"] },
  { id: "fed_rate_hike", nameAr: "رفع فائدة أمريكي", affectedAssets: ["AAPL", "QQQ", "BTCUSDT", "XAUUSD"], expectedImpactPercent: -5, riskLevel: "high", hedgeCandidates: ["DXY", "cash", "US10Y"] },
  { id: "fed_rate_cut", nameAr: "خفض فائدة أمريكي", affectedAssets: ["SPY", "QQQ", "BTCUSDT", "XAUUSD"], expectedImpactPercent: 5, riskLevel: "medium", hedgeCandidates: ["cash"] },
  { id: "dollar_strength", nameAr: "قوة الدولار", affectedAssets: ["EURUSD", "XAUUSD", "BTCUSDT"], expectedImpactPercent: -4, riskLevel: "medium", hedgeCandidates: ["DXY", "cash"] },
  { id: "dollar_weakness", nameAr: "ضعف الدولار", affectedAssets: ["EURUSD", "XAUUSD", "WTI", "BTCUSDT"], expectedImpactPercent: 4, riskLevel: "medium", hedgeCandidates: ["SPY"] },
  { id: "liquidity_crisis", nameAr: "أزمة سيولة", affectedAssets: ["AAPL", "QQQ", "BTCUSDT", "2222.SR"], expectedImpactPercent: -12, riskLevel: "critical", hedgeCandidates: ["cash", "US10Y", "XAUUSD"] },
  { id: "recession", nameAr: "ركود اقتصادي", affectedAssets: ["AAPL", "MSFT", "XOM", "WTI"], expectedImpactPercent: -9, riskLevel: "critical", hedgeCandidates: ["cash", "US10Y", "XAUUSD"] },
  { id: "inflation_shock", nameAr: "صدمة تضخم", affectedAssets: ["XAUUSD", "WTI", "BRENT", "SPY"], expectedImpactPercent: -6, riskLevel: "high", hedgeCandidates: ["XAUUSD", "commodities", "cash"] },
  { id: "crypto_crash", nameAr: "انهيار العملات الرقمية", affectedAssets: ["BTCUSDT", "ETHUSDT"], expectedImpactPercent: -25, riskLevel: "critical", hedgeCandidates: ["cash", "XAUUSD"] },
  { id: "saudi_market_stress", nameAr: "ضغط السوق السعودي", affectedAssets: ["2222.SR", "1120.SR", "2010.SR"], expectedImpactPercent: -7, riskLevel: "high", hedgeCandidates: ["cash", "SPY", "XAUUSD"] },
  { id: "geopolitical_risk", nameAr: "مخاطر جيوسياسية", affectedAssets: ["WTI", "BRENT", "XAUUSD", "2222.SR"], expectedImpactPercent: -6, riskLevel: "high", hedgeCandidates: ["XAUUSD", "cash", "US10Y"] },
];

function findScenario(id: string | null): ScenarioDefinition {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

function currentAllocations() {
  return getGenesisAllocations().allocations ?? [];
}

export function listScenarios() {
  return {
    scenarioEngineVersion: "scenario-engine-v1",
    scenarios: SCENARIOS,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runScenario(id: string | null): Promise<ScenarioResult & typeof AI_SAFETY_FLAGS> {
  const scenario = findScenario(id);
  const allocations = currentAllocations();
  const exposed = allocations.filter((allocation) => scenario.affectedAssets.includes(allocation.symbol));
  const exposureWeight = exposed.reduce((sum, allocation) => sum + (allocation.targetWeight ?? 0), 0);
  const quoteReads = await Promise.all(scenario.affectedAssets.map((symbol) => safeRead(() => routeQuote(symbol), null)));
  const macro = await safeRead(() => getMacroFeed(), null);
  const knowledge = await safeRead(() => applyKnowledge(scenario.affectedAssets[0] ?? "AAPL"), null);
  const dataConfidence = quoteReads.filter((quote) => quote?.success).length / Math.max(1, quoteReads.length);
  const portfolioDrawdownEstimate = Number(Math.abs(exposureWeight * scenario.expectedImpactPercent).toFixed(2));
  const confidencePercent = Math.round(Math.min(90, 35 + dataConfidence * 35 + (macro?.confidencePercent ?? 0) * 0.2));

  return {
    ...scenario,
    portfolioDrawdownEstimate,
    assetsAtRisk: exposed.length ? exposed.map((allocation) => allocation.symbol) : scenario.affectedAssets,
    recommendedActionAr: `راقب سيناريو ${scenario.nameAr}. خفف المخاطر تدريجياً عند ارتفاع التعرض، واستخدم المرشحات الدفاعية: ${scenario.hedgeCandidates.join(", ")}. ${knowledge?.decisionSupportAr ?? ""}`,
    confidencePercent,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runPortfolioStress() {
  const results = await Promise.all(SCENARIOS.map((scenario) => runScenario(scenario.id)));
  const worst = results.reduce((a, b) => a.portfolioDrawdownEstimate > b.portfolioDrawdownEstimate ? a : b);
  return {
    scenarioEngineVersion: "scenario-engine-v1",
    scenarioCount: results.length,
    worstScenario: worst.id,
    worstDrawdownEstimate: worst.portfolioDrawdownEstimate,
    results,
    summaryAr: `أعلى ضغط مقدر على المحفظة يأتي من سيناريو ${worst.nameAr} بتراجع تقديري ${worst.portfolioDrawdownEstimate}%.`,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runScenarioFromRequest(request: Request) {
  const body = await request.json().catch(() => ({})) as { scenario?: string };
  return runScenario(body.scenario ?? new URL(request.url).searchParams.get("scenario"));
}
