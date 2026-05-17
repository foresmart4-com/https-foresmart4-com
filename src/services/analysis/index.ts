// Aggregator: pulls quotes → news → sentiment → signals → AI summary + brain layer.
import { fetchAllQuotes, type AssetKey, type MarketQuote } from "@/services/market/marketData";
import { generateSignals, type Signal } from "@/services/signals/signalEngine";
import { buildSummary, type MarketSummary } from "@/services/ai/marketSummary";
import { fetchNews, type NewsItem } from "@/services/news/newsImpact";
import { calculateMarketSentiment, type MarketSentimentScore } from "@/services/analysis/marketSentiment";
import { generateMarketInsight, type AIInsight } from "@/services/ai/openaiAnalysis";
import { classifyEvents, type MarketEvent } from "@/services/events/eventImpactEngine";
import { computeCorrelations, type CorrelationPair } from "@/services/correlation/correlationEngine";
import { scanOpportunities, type Opportunity } from "@/services/opportunities/opportunityScanner";
import { generateReasoning, type ReasoningNote } from "@/services/reasoning/reasoningEngine";
import { generateAlerts, type SmartAlert } from "@/services/brain/alertEngine";

export interface MarketIntel {
  quotes: MarketQuote[];
  signals: Signal[];
  summary: MarketSummary;
  sentiment: MarketSentimentScore;
  insight: AIInsight;
  news: NewsItem[];
  // Brain layer
  events: MarketEvent[];
  correlations: CorrelationPair[];
  opportunities: Opportunity[];
  reasoning: ReasoningNote[];
  alerts: SmartAlert[];
  generatedAt: number;
}

export async function getMarketIntel(keys?: AssetKey[]): Promise<MarketIntel> {
  const [quotes, news] = await Promise.all([fetchAllQuotes(keys), fetchNews(6)]);
  const sentiment = calculateMarketSentiment(quotes, news);
  const signals = generateSignals(quotes, news, sentiment);
  const summary = buildSummary(quotes, signals);
  const insight = await generateMarketInsight(quotes, signals, news, sentiment);

  const events = classifyEvents(news);
  const correlations = computeCorrelations(quotes);
  const opportunities = scanOpportunities(quotes, signals, sentiment);
  const reasoning = generateReasoning(quotes, signals, sentiment);
  const alerts = generateAlerts(quotes, signals, events, opportunities, sentiment);

  return {
    quotes, signals, summary, sentiment, insight, news,
    events, correlations, opportunities, reasoning, alerts,
    generatedAt: Date.now(),
  };
}
