// Aggregator: pulls quotes → signals → summary → news in one call.
import { fetchAllQuotes, type AssetKey, type MarketQuote } from "@/services/market/marketData";
import { generateSignals, type Signal } from "@/services/signals/signalEngine";
import { buildSummary, type MarketSummary } from "@/services/ai/marketSummary";
import { fetchNews, type NewsItem } from "@/services/news/newsImpact";

export interface MarketIntel {
  quotes: MarketQuote[];
  signals: Signal[];
  summary: MarketSummary;
  news: NewsItem[];
  generatedAt: number;
}

export async function getMarketIntel(keys?: AssetKey[]): Promise<MarketIntel> {
  const [quotes, news] = await Promise.all([fetchAllQuotes(keys), fetchNews(5)]);
  const signals = generateSignals(quotes);
  const summary = buildSummary(quotes, signals);
  return { quotes, signals, summary, news, generatedAt: Date.now() };
}
