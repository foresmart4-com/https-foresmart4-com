// React Query hooks for the AI brain — provides caching, throttling,
// loading state and graceful error fallback to the dashboard.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  aiMarketAnalyst, aiMarketInsights, aiSignalExplainer, aiNewsAnalysis,
  type MarketAnalystOutput, type MarketInsightsOutput,
  type SignalExplanationOutput, type NewsAnalysisOutput,
} from "@/lib/ai-brain.functions";
import type { MarketIntel } from "@/services/analysis";

// Trim and serialize MarketIntel into the AI-friendly shape.
function buildContext(intel: MarketIntel, language: "ar" | "en") {
  return {
    language,
    quotes: intel.quotes.map((q) => ({
      key: q.key, name: q.name, price: q.price, changePct: q.changePct,
      momentum: q.momentum, volatility: q.volatility, trend: q.trend,
    })),
    sentiment: { score: intel.sentiment.score, zone: intel.sentiment.zone },
    news: intel.news.slice(0, 6).map((n) => ({
      headline: n.headline, asset: n.asset, sentiment: n.sentiment,
      impact: n.impact, impactScore: n.impactScore,
    })),
    correlations: intel.correlations.slice(0, 6).map((c) => ({
      a: c.a, b: c.b, coefficient: c.coefficient, kind: c.kind, strength: c.strength,
    })),
    opportunities: intel.opportunities.slice(0, 6).map((o) => ({
      asset: o.asset, assetName: o.assetName, kind: o.kind,
      score: o.score, entryBias: o.entryBias,
    })),
  };
}

// Stable cache key based on sentiment score + first quote price (changes when market moves).
function intelKey(intel: MarketIntel | undefined) {
  if (!intel) return "none";
  return `${intel.sentiment.score}-${intel.quotes[0]?.price.toFixed(0) ?? "x"}-${intel.news[0]?.id ?? "n"}`;
}

const FIVE_MIN = 5 * 60_000;

export function useAIMarketAnalyst(intel: MarketIntel | undefined, language: "ar" | "en") {
  const fn = useServerFn(aiMarketAnalyst);
  return useQuery({
    queryKey: ["ai", "analyst", language, intelKey(intel)],
    queryFn: () => fn({ data: buildContext(intel!, language) }),
    enabled: !!intel,
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAIMarketInsights(intel: MarketIntel | undefined, language: "ar" | "en") {
  const fn = useServerFn(aiMarketInsights);
  return useQuery({
    queryKey: ["ai", "insights", language, intelKey(intel)],
    queryFn: () => fn({ data: buildContext(intel!, language) }),
    enabled: !!intel,
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export type { MarketAnalystOutput, MarketInsightsOutput, SignalExplanationOutput, NewsAnalysisOutput };
export { aiSignalExplainer, aiNewsAnalysis };
