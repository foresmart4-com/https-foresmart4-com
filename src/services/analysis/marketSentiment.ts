// Composite market sentiment (Fear & Greed style) derived from BTC momentum,
// cross-asset volatility, news sentiment and correlations.
import type { MarketQuote } from "@/services/market/marketData";
import type { NewsItem } from "@/services/news/newsImpact";

export type FearGreedZone = "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed";

export interface MarketSentimentScore {
  score: number; // 0-100
  zone: FearGreedZone;
  drivers: { label: string; value: number }[];
}

function newsScore(news: NewsItem[]): number {
  if (!news.length) return 50;
  let s = 0, w = 0;
  for (const n of news) {
    const weight = (n.impactScore || 50) / 100;
    const pol = n.sentiment === "positive" ? 1 : n.sentiment === "negative" ? -1 : 0;
    s += pol * weight;
    w += weight;
  }
  // map [-1..1] → [0..100]
  const norm = w > 0 ? s / w : 0;
  return Math.round(50 + norm * 40);
}

function momentumScore(quotes: MarketQuote[]): number {
  const btc = quotes.find((q) => q.key === "BTC");
  const avgMom = quotes.reduce((sum, q) => sum + q.momentum, 0) / Math.max(1, quotes.length);
  const composite = (btc?.momentum ?? 0) * 0.5 + avgMom * 0.5;
  return Math.round(Math.max(0, Math.min(100, 50 + composite * 6)));
}

function volatilityScore(quotes: MarketQuote[]): number {
  const avgVol = quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, quotes.length);
  // High vol → fear
  return Math.round(Math.max(0, Math.min(100, 100 - avgVol)));
}

function correlationScore(quotes: MarketQuote[]): number {
  // Risk-on vs risk-off divergence: stocks up + gold/DXY down = greed, inverse = fear
  const spx = quotes.find((q) => q.key === "SPX")?.changePct ?? 0;
  const ndx = quotes.find((q) => q.key === "NDX")?.changePct ?? 0;
  const xau = quotes.find((q) => q.key === "XAU")?.changePct ?? 0;
  const dxy = quotes.find((q) => q.key === "DXY")?.changePct ?? 0;
  const riskOn = (spx + ndx) / 2;
  const riskOff = (xau + dxy) / 2;
  const diff = riskOn - riskOff;
  return Math.round(Math.max(0, Math.min(100, 50 + diff * 10)));
}

export function calculateMarketSentiment(quotes: MarketQuote[], news: NewsItem[]): MarketSentimentScore {
  const drivers = [
    { label: "Momentum", value: momentumScore(quotes) },
    { label: "Volatility", value: volatilityScore(quotes) },
    { label: "News", value: newsScore(news) },
    { label: "Correlation", value: correlationScore(quotes) },
  ];
  const score = Math.round(drivers.reduce((s, d) => s + d.value, 0) / drivers.length);
  const zone: FearGreedZone =
    score >= 80 ? "Extreme Greed" :
    score >= 60 ? "Greed" :
    score >= 40 ? "Neutral" :
    score >= 20 ? "Fear" : "Extreme Fear";
  return { score, zone, drivers };
}
