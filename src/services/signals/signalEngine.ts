// Advanced signal engine — combines RSI, MACD, momentum, trend, volatility,
// news sentiment and overall market sentiment to produce BUY / SELL / HOLD
// with confidence, risk, explanation and urgency.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { NewsItem } from "@/services/news/newsImpact";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface Signal {
  asset: AssetKey;
  assetName: string;
  action: SignalAction;
  confidence: number; // 0-100
  risk: number; // 0-100
  urgency: number; // 0-100
  trendStrength: number; // 0-100
  rsi: number;
  macd: number;
  newsBias: number; // -100..100
  reason: string;
  timestamp: number;
}

function rsi(history: number[]): number {
  if (history.length < 2) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i < history.length; i++) {
    const d = history[i] - history[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgG = gains / history.length;
  const avgL = losses / history.length || 1e-9;
  const rs = avgG / avgL;
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

function ema(arr: number[], period: number): number {
  const k = 2 / (period + 1);
  return arr.reduce((p, v, i) => (i === 0 ? v : v * k + p * (1 - k)), 0);
}

function macd(history: number[]): number {
  if (history.length < 12) return 0;
  return +(ema(history, 12) - ema(history, 26)).toFixed(4);
}

function newsBiasFor(asset: AssetKey, news: NewsItem[]): number {
  const relevant = news.filter((n) => n.asset === asset);
  if (!relevant.length) return 0;
  let s = 0, w = 0;
  for (const n of relevant) {
    const weight = (n.impactScore || 50) / 100;
    const pol = n.sentiment === "positive" ? 1 : n.sentiment === "negative" ? -1 : 0;
    s += pol * weight; w += weight;
  }
  return Math.round((w > 0 ? s / w : 0) * 100);
}

export function generateSignal(
  q: MarketQuote,
  news: NewsItem[] = [],
  sentiment?: MarketSentimentScore,
): Signal {
  const r = rsi(q.history);
  const m = macd(q.history);
  const mom = q.momentum;
  const trendStrength = Math.min(100, Math.round(Math.abs(mom) * 25 + Math.abs(m) * 50));
  const newsBias = newsBiasFor(q.key, news);
  const macroBias = sentiment ? sentiment.score - 50 : 0; // -50..50

  // Composite bias score
  const techBias = (m > 0 ? 1 : -1) * Math.min(1, Math.abs(m) * 5) * 30 + mom * 8;
  const composite = techBias + newsBias * 0.4 + macroBias * 0.6;

  let action: SignalAction = "HOLD";
  let reason = "Mixed signals — waiting for confirmation.";

  if (r < 35 && mom > -1 && composite > -10) {
    action = "BUY";
    reason = `Oversold (RSI ${r}) with stabilizing momentum and ${newsBias >= 0 ? "supportive" : "neutral"} news flow.`;
  } else if (r > 70 && mom < 1 && composite < 10) {
    action = "SELL";
    reason = `Overbought (RSI ${r}); momentum fading, distribution risk.`;
  } else if (composite > 25 && r < 70) {
    action = "BUY";
    reason = `Trend + news alignment: MACD ${m.toFixed(3)}, news bias ${newsBias > 0 ? "+" : ""}${newsBias}, macro ${sentiment?.zone ?? "n/a"}.`;
  } else if (composite < -25 && r > 30) {
    action = "SELL";
    reason = `Negative confluence: MACD ${m.toFixed(3)}, news bias ${newsBias}, macro ${sentiment?.zone ?? "n/a"}.`;
  }

  const confidence = Math.max(40, Math.min(96, Math.round(
    trendStrength * 0.5 + (100 - Math.abs(50 - r)) * 0.25 + Math.abs(composite) * 0.4,
  )));
  const risk = Math.max(10, Math.min(95, Math.round(
    q.volatility * 0.55 + Math.abs(50 - r) * 0.2 + (sentiment ? Math.abs(sentiment.score - 50) * 0.3 : 0),
  )));
  const urgency = Math.max(0, Math.min(100, Math.round(
    Math.abs(composite) * 0.6 + (action === "HOLD" ? 0 : 25) + q.volatility * 0.2,
  )));

  return {
    asset: q.key, assetName: q.name, action, confidence, risk, urgency, trendStrength,
    rsi: r, macd: m, newsBias, reason, timestamp: Date.now(),
  };
}

export function generateSignals(
  quotes: MarketQuote[],
  news: NewsItem[] = [],
  sentiment?: MarketSentimentScore,
): Signal[] {
  return quotes.map((q) => generateSignal(q, news, sentiment));
}
