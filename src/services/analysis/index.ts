// Aggregator: pulls quotes → news → sentiment → signals → AI summary in one call.
import { fetchAllQuotes, type AssetKey, type MarketQuote } from "@/services/market/marketData";
import { generateSignals, type Signal } from "@/services/signals/signalEngine";
import { buildSummary, type MarketSummary } from "@/services/ai/marketSummary";
import { fetchNews, type NewsItem } from "@/services/news/newsImpact";
import { calculateMarketSentiment, type MarketSentimentScore } from "@/services/analysis/marketSentiment";
import { generateMarketInsight, type AIInsight } from "@/services/ai/openaiAnalysis";

export interface MarketIntel {
  quotes: MarketQuote[];
  signals: Signal[];
  summary: MarketSummary;
  sentiment: MarketSentimentScore;
  insight: AIInsight;
  news: NewsItem[];
  generatedAt: number;
}

export async function getMarketIntel(keys?: AssetKey[]): Promise<MarketIntel> {
  const [quotes, news] = await Promise.all([fetchAllQuotes(keys), fetchNews(6)]);
  const sentiment = calculateMarketSentiment(quotes, news);
  const signals = generateSignals(quotes, news, sentiment);
  const summary = buildSummary(quotes, signals);
  const insight = await generateMarketInsight(quotes, signals, news, sentiment);
  return { quotes, signals, summary, sentiment, insight, news, generatedAt: Date.now() };
}
