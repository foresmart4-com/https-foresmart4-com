import type { MarketQuote, AssetKey } from "@/services/market/marketData";

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface Signal {
  asset: AssetKey;
  assetName: string;
  action: SignalAction;
  confidence: number; // 0-100
  risk: number; // 0-100
  trendStrength: number; // 0-100
  rsi: number;
  macd: number;
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

export function generateSignal(q: MarketQuote): Signal {
  const r = rsi(q.history);
  const m = macd(q.history);
  const mom = q.momentum;
  const trendStrength = Math.min(100, Math.round(Math.abs(mom) * 25 + Math.abs(m) * 50));

  let action: SignalAction = "HOLD";
  let reason = "Mixed signals — waiting for confirmation.";

  if (r < 35 && mom > -1) {
    action = "BUY";
    reason = `Oversold (RSI ${r}) with stabilizing momentum — accumulation zone.`;
  } else if (r > 70 && mom < 1) {
    action = "SELL";
    reason = `Overbought (RSI ${r}) with fading momentum — distribution risk.`;
  } else if (m > 0 && mom > 0.3 && r < 65) {
    action = "BUY";
    reason = `MACD positive (${m.toFixed(3)}) and upward momentum — trend continuation.`;
  } else if (m < 0 && mom < -0.3 && r > 35) {
    action = "SELL";
    reason = `MACD negative (${m.toFixed(3)}) with weakening price action.`;
  }

  const confidence = Math.max(40, Math.min(96, Math.round(trendStrength * 0.6 + (100 - Math.abs(50 - r)) * 0.4)));
  const risk = Math.max(10, Math.min(90, Math.round(q.volatility * 0.7 + Math.abs(50 - r) * 0.3)));

  return {
    asset: q.key, assetName: q.name, action, confidence, risk, trendStrength,
    rsi: r, macd: m, reason, timestamp: Date.now(),
  };
}

export function generateSignals(quotes: MarketQuote[]): Signal[] {
  return quotes.map(generateSignal);
}
