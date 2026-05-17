// AI analysis layer — secure architecture.
// All model calls go through Lovable AI Gateway via server functions; the OpenAI
// API key is NEVER read on the client. These functions provide a typed surface
// the UI can call today (returning deterministic insights) and can be wired to a
// server function later without changing any callers.
import type { MarketQuote } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { NewsItem } from "@/services/news/newsImpact";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export interface AIInsight {
  title: string;
  body: string;
  generatedAt: number;
  model: "local-heuristic" | "lovable-ai";
}

function pickTopMovers(quotes: MarketQuote[], n = 3): MarketQuote[] {
  return [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, n);
}

export async function summarizeMarket(
  quotes: MarketQuote[],
  sentiment: MarketSentimentScore,
): Promise<AIInsight> {
  const movers = pickTopMovers(quotes, 3);
  const moverLine = movers.map((m) => `${m.name} ${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(2)}%`).join(", ");
  const tone =
    sentiment.zone === "Extreme Greed" ? "Risk appetite is stretched — selective profit-taking warranted." :
    sentiment.zone === "Greed" ? "Bulls remain in control with healthy breadth." :
    sentiment.zone === "Neutral" ? "Markets are balanced — wait for a catalyst before sizing up." :
    sentiment.zone === "Fear" ? "Defensive flows dominate; quality and duration outperform." :
    "Capitulation conditions — historically high reward-to-risk for patient capital.";
  return {
    title: `Market Snapshot — ${sentiment.zone}`,
    body: `${tone} Top movers: ${moverLine}. Composite sentiment score ${sentiment.score}/100.`,
    generatedAt: Date.now(),
    model: "local-heuristic",
  };
}

export async function explainSignal(signal: Signal): Promise<AIInsight> {
  const dir = signal.action === "BUY" ? "long" : signal.action === "SELL" ? "short" : "wait";
  return {
    title: `${signal.assetName}: ${signal.action}`,
    body: `${signal.reason} Suggested stance: ${dir}. Confidence ${signal.confidence}%, risk ${signal.risk}/100 (RSI ${signal.rsi}, MACD ${signal.macd}).`,
    generatedAt: Date.now(),
    model: "local-heuristic",
  };
}

export async function analyzeNewsImpact(item: NewsItem): Promise<AIInsight> {
  return {
    title: `${item.asset} · ${item.impact} impact`,
    body: `${item.analysis} Sentiment: ${item.sentiment}. Urgency ${item.urgency}/100.`,
    generatedAt: Date.now(),
    model: "local-heuristic",
  };
}

export async function generateMarketInsight(
  quotes: MarketQuote[],
  signals: Signal[],
  news: NewsItem[],
  sentiment: MarketSentimentScore,
): Promise<AIInsight> {
  const topSig = [...signals].sort((a, b) => b.confidence - a.confidence)[0];
  const topNews = [...news].sort((a, b) => b.impactScore - a.impactScore)[0];
  const movers = pickTopMovers(quotes, 2).map((m) => m.name).join(" & ");
  const lines = [
    `Composite sentiment: ${sentiment.zone} (${sentiment.score}/100).`,
    topSig ? `Highest-conviction setup: ${topSig.assetName} ${topSig.action} @ ${topSig.confidence}%.` : "",
    topNews ? `Top catalyst: "${topNews.headline}" (${topNews.impact} impact on ${topNews.asset}).` : "",
    movers ? `Watch ${movers} for follow-through.` : "",
  ].filter(Boolean);
  return {
    title: "AI Market Insight",
    body: lines.join(" "),
    generatedAt: Date.now(),
    model: "local-heuristic",
  };
}
