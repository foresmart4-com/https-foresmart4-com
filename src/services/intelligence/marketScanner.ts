// Advanced Market Intelligence Engine — deterministic demo data + indicators.
// Falls back to synthetic series if real feeds are unavailable. Pure client code.

export type AssetClass = "stocks" | "crypto" | "gold" | "forex" | "oil";

export interface ScannedAsset {
  symbol: string;
  name: string;
  klass: AssetClass;
  price: number;
  changePct: number;
  series: number[];
  trend: "bullish" | "bearish" | "neutral";
  rsi: number;
  macd: { macd: number; signal: number; hist: number };
  volumeSpike: number; // 1 = normal, >1.5 = spike
  volatility: number; // annualized %
  momentum: number; // -100..100
  support: number;
  resistance: number;
  confidence: number; // 0-100
  sentiment: number; // -100..100
}

const UNIVERSE: { symbol: string; name: string; klass: AssetClass; base: number }[] = [
  { symbol: "AAPL", name: "Apple", klass: "stocks", base: 215 },
  { symbol: "MSFT", name: "Microsoft", klass: "stocks", base: 430 },
  { symbol: "NVDA", name: "NVIDIA", klass: "stocks", base: 138 },
  { symbol: "TSLA", name: "Tesla", klass: "stocks", base: 258 },
  { symbol: "BTC", name: "Bitcoin", klass: "crypto", base: 68500 },
  { symbol: "ETH", name: "Ethereum", klass: "crypto", base: 3450 },
  { symbol: "SOL", name: "Solana", klass: "crypto", base: 168 },
  { symbol: "XAU", name: "Gold", klass: "gold", base: 2580 },
  { symbol: "EURUSD", name: "EUR/USD", klass: "forex", base: 1.0825 },
  { symbol: "USDJPY", name: "USD/JPY", klass: "forex", base: 151.4 },
  { symbol: "GBPUSD", name: "GBP/USD", klass: "forex", base: 1.268 },
  { symbol: "WTI", name: "WTI Oil", klass: "oil", base: 78.4 },
  { symbol: "BRENT", name: "Brent Oil", klass: "oil", base: 82.1 },
];

// Seeded PRNG for deterministic demo fallback per symbol+bucket
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function generateSeries(symbol: string, base: number, n = 120): number[] {
  const bucket = Math.floor(Date.now() / (5 * 60_000)); // refresh every 5m
  const r = seededRand(hash(symbol + ":" + bucket));
  const out: number[] = [];
  let v = base * (0.95 + r() * 0.1);
  const drift = (r() - 0.5) * 0.002;
  for (let i = 0; i < n; i++) {
    const shock = (r() - 0.5) * base * 0.012;
    v = Math.max(base * 0.6, v + shock + v * drift);
    out.push(+v.toFixed(4));
  }
  return out;
}

// ---------- indicators ----------
export function rsi(series: number[], period = 14): number {
  if (series.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = series.length - period; i < series.length; i++) {
    const diff = series[i] - series[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function ema(series: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = series[0];
  for (let i = 0; i < series.length; i++) {
    prev = i === 0 ? series[0] : series[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macd(series: number[]) {
  const e12 = ema(series, 12);
  const e26 = ema(series, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signal = ema(macdLine, 9);
  const m = +macdLine[macdLine.length - 1].toFixed(4);
  const s = +signal[signal.length - 1].toFixed(4);
  return { macd: m, signal: s, hist: +(m - s).toFixed(4) };
}

export function volatility(series: number[]): number {
  if (series.length < 2) return 0;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) rets.push(Math.log(series[i] / series[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2);
}

export function momentum(series: number[], lookback = 20): number {
  if (series.length < lookback + 1) return 0;
  const now = series[series.length - 1];
  const then = series[series.length - 1 - lookback];
  return +(((now - then) / then) * 100).toFixed(2);
}

export function supportResistance(series: number[]): { support: number; resistance: number } {
  const tail = series.slice(-60);
  return {
    support: +Math.min(...tail).toFixed(4),
    resistance: +Math.max(...tail).toFixed(4),
  };
}

function volumeSpikeFor(symbol: string): number {
  const r = seededRand(hash(symbol + ":v:" + Math.floor(Date.now() / 300_000)));
  // mostly 0.7-1.3, occasional spike up to 3x
  const base = 0.7 + r() * 0.6;
  return r() > 0.85 ? +(base + r() * 2).toFixed(2) : +base.toFixed(2);
}

function sentimentFor(symbol: string, momentumPct: number, rsiVal: number): number {
  const r = seededRand(hash(symbol + ":s:" + Math.floor(Date.now() / 600_000)));
  const noise = (r() - 0.5) * 30;
  const base = momentumPct * 2 + (rsiVal - 50) * 0.8;
  return Math.max(-100, Math.min(100, +(base + noise).toFixed(1)));
}

export function scanAsset(u: typeof UNIVERSE[number]): ScannedAsset {
  const series = generateSeries(u.symbol, u.base);
  const price = series[series.length - 1];
  const prev = series[series.length - 2] ?? price;
  const changePct = +(((price - prev) / prev) * 100).toFixed(2);
  const r = rsi(series);
  const m = macd(series);
  const vol = volatility(series);
  const mom = momentum(series);
  const sr = supportResistance(series);
  const vSpike = volumeSpikeFor(u.symbol);
  const sent = sentimentFor(u.symbol, mom, r);

  const bullishFactors =
    (m.hist > 0 ? 1 : 0) +
    (r > 50 && r < 70 ? 1 : 0) +
    (mom > 0 ? 1 : 0) +
    (sent > 0 ? 1 : 0);
  const bearishFactors =
    (m.hist < 0 ? 1 : 0) +
    (r < 50 && r > 30 ? 1 : 0) +
    (mom < 0 ? 1 : 0) +
    (sent < 0 ? 1 : 0);
  let trend: ScannedAsset["trend"] = "neutral";
  if (bullishFactors >= 3) trend = "bullish";
  else if (bearishFactors >= 3) trend = "bearish";

  const confidence = Math.min(
    99,
    Math.max(
      35,
      Math.round(
        40 +
          Math.abs(mom) * 0.8 +
          Math.abs(m.hist) * 4 +
          (vSpike > 1.5 ? 10 : 0) +
          Math.abs(sent) * 0.15,
      ),
    ),
  );

  return {
    symbol: u.symbol,
    name: u.name,
    klass: u.klass,
    price,
    changePct,
    series,
    trend,
    rsi: r,
    macd: m,
    volumeSpike: vSpike,
    volatility: vol,
    momentum: mom,
    support: sr.support,
    resistance: sr.resistance,
    confidence,
    sentiment: sent,
  };
}

export function scanAll(): ScannedAsset[] {
  try {
    return UNIVERSE.map(scanAsset);
  } catch {
    // Fallback minimal demo set
    return UNIVERSE.slice(0, 4).map((u) => ({
      symbol: u.symbol, name: u.name, klass: u.klass,
      price: u.base, changePct: 0, series: [u.base],
      trend: "neutral", rsi: 50,
      macd: { macd: 0, signal: 0, hist: 0 },
      volumeSpike: 1, volatility: 0, momentum: 0,
      support: u.base * 0.95, resistance: u.base * 1.05,
      confidence: 50, sentiment: 0,
    }));
  }
}

export function scanByClass(klass: AssetClass): ScannedAsset[] {
  return scanAll().filter((a) => a.klass === klass);
}
