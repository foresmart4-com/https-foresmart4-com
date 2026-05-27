import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { runDailyResearchAgent } from "@/lib/ai/researchAgent/researchAgent";
import { queryKnowledgeGraph } from "@/lib/ai/knowledgeGraph/knowledgeGraphEngine";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

export async function runAltDataLayer() {
  const [macro, research, graph] = await Promise.all([
    safeRead(() => getMacroFeed(), null),
    safeRead(() => runDailyResearchAgent(), null),
    safeRead(() => queryKnowledgeGraph(), null),
  ]);
  const credibilityScore = Math.round(((macro?.sourceCredibilityAverage ?? 50) + (research?.sourceCredibilityAverage ?? 50) + (graph?.confidencePercent ?? 35)) / 3);
  return {
    altDataVersion: "altdata-v1",
    altSignals: [
      { source: "web_trends_framework", signal: "framework_ready", credibility: 45 },
      { source: "shipping_supply_framework", signal: "provider_pending", credibility: 40 },
      { source: "public_macro_stress", signal: macro?.riskImpact ?? "unknown", credibility: macro?.confidencePercent ?? 0 },
    ],
    stressIndicators: {
      macroRisk: macro?.riskImpact ?? "unknown",
      liquiditySignal: macro?.liquiditySignal ?? "unknown",
      researchRiskCount: research?.topRisks?.length ?? 0,
    },
    geopoliticalRisk: research?.topRisks?.some((risk: string) => /جيو|geopolitical/i.test(risk)) ? "elevated" : "watch",
    sentimentHeatmap: {
      market: "neutral",
      crypto: "watch",
      commodities: "watch",
      saudi: "neutral",
    },
    credibilityScore,
    summaryAr: "طبقة البيانات البديلة جاهزة بإشارات منخفضة/متوسطة الموثوقية ولا تهيمن على القرارات.",
    lowCredibilityCannotDominate: true,
    orchestratorConnected: true,
    ...AI_SAFETY_FLAGS,
  };
}

export function getAltDataStatus() {
  return {
    altDataVersion: "altdata-v1",
    configuredSources: ["public_macro_stress_indicators"],
    pendingSources: ["web_trends", "geopolitical_datasets", "shipping_supply_indicators", "market_sentiment_graphs"],
    ready: true,
    ...AI_SAFETY_FLAGS,
  };
}
