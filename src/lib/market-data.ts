// Free market data aggregator. Runs server-side via TanStack server functions.
import { createServerFn } from "@tanstack/react-start";

export type AssetCategory = "currencies" | "metals" | "oil" | "crypto" | "stocks";

export interface AssetQuote {
  symbol: string;
  name: string;
  category: AssetCategory;
  price: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume: number;
  history: { t: number; p: number }[]; // 24h price points
}

const CRYPTO_IDS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
];

async function fetchCrypto(): Promise<AssetQuote[]> {
  const ids = CRYPTO_IDS.map((c) => c.id).join(",");
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
  );
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{
    id: string; current_price: number; price_change_percentage_24h: number;
    high_24h: number; low_24h: number; total_volume: number;
  }>;
  // Fetch 24h history for each (sparkline endpoint per coin)
  const results: AssetQuote[] = [];
  for (const coin of data) {
    const meta = CRYPTO_IDS.find((c) => c.id === coin.id)!;
    let history: AssetQuote["history"] = [];
    try {
      const hr = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=1`,
      );
      if (hr.ok) {
        const hd = (await hr.json()) as { prices: [number, number][] };
        history = hd.prices.map(([t, p]) => ({ t, p }));
      }
    } catch { /* ignore */ }
    results.push({
      symbol: meta.symbol,
      name: meta.name,
      category: "crypto",
      price: coin.current_price,
      changePct: coin.price_change_percentage_24h ?? 0,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      volume: coin.total_volume,
      history,
    });
  }
  return results;
}

const FX_PAIRS = [
  { from: "EUR", to: "USD", symbol: "EUR/USD", name: "Euro / US Dollar" },
  { from: "GBP", to: "USD", symbol: "GBP/USD", name: "Pound / US Dollar" },
  { from: "USD", to: "JPY", symbol: "USD/JPY", name: "Dollar / Yen" },
  { from: "USD", to: "SAR", symbol: "USD/SAR", name: "Dollar / Saudi Riyal" },
];

async function fetchFX(): Promise<AssetQuote[]> {
  // Use Frankfurter (free, no key) for FX history
  const out: AssetQuote[] = [];
  for (const p of FX_PAIRS) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yest = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const r = await fetch(
        `https://api.frankfurter.dev/v1/${yest}..${today}?base=${p.from}&symbols=${p.to}`,
      );
      if (!r.ok) continue;
      const d = (await r.json()) as { rates: Record<string, Record<string, number>> };
      const points = Object.entries(d.rates)
        .map(([date, rate]) => ({ t: new Date(date).getTime(), p: rate[p.to] }))
        .sort((a, b) => a.t - b.t);
      if (points.length === 0) continue;
      const price = points[points.length - 1].p;
      const first = points[0].p;
      const change = ((price - first) / first) * 100;
      const prices = points.map((x) => x.p);
      out.push({
        symbol: p.symbol,
        name: p.name,
        category: "currencies",
        price,
        changePct: change,
        high24h: Math.max(...prices),
        low24h: Math.min(...prices),
        volume: 0,
        history: points,
      });
    } catch { /* skip */ }
  }
  return out;
}

// Metals via CoinGecko tokenized assets
const METAL_IDS = [
  { id: "pax-gold", symbol: "XAU", name: "Gold (PAXG)" },
  { id: "kinesis-silver", symbol: "XAG", name: "Silver (KAG)" },
];
async function fetchMetals(): Promise<AssetQuote[]> {
  try {
    const ids = METAL_IDS.map((m) => m.id).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
    );
    if (!r.ok) return [];
    const data = (await r.json()) as Array<{
      id: string; current_price: number; price_change_percentage_24h: number;
      high_24h: number; low_24h: number; total_volume: number;
    }>;
    const out: AssetQuote[] = [];
    for (const coin of data) {
      const meta = METAL_IDS.find((m) => m.id === coin.id)!;
      let history: AssetQuote["history"] = [];
      try {
        const hr = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=1`,
        );
        if (hr.ok) {
          const hd = (await hr.json()) as { prices: [number, number][] };
          history = hd.prices.map(([t, p]) => ({ t, p }));
        }
      } catch { /* ignore */ }
      out.push({
        symbol: meta.symbol,
        name: meta.name,
        category: "metals",
        price: coin.current_price,
        changePct: coin.price_change_percentage_24h ?? 0,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        volume: coin.total_volume,
        history,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export const getMarketData = createServerFn({ method: "GET" }).handler(async () => {
  const [crypto, fx, metals] = await Promise.all([fetchCrypto(), fetchFX(), fetchMetals()]);
  return { assets: [...crypto, ...metals, ...fx], fetchedAt: Date.now() };
});

// ===== Technical indicators =====
export function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function calcSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function deriveSignal(prices: number[]): {
  signal: "buy" | "sell" | "hold";
  rsi: number | null;
  sma: number | null;
  reason: string;
} {
  const rsi = calcRSI(prices);
  const sma = calcSMA(prices, Math.min(20, prices.length));
  const last = prices[prices.length - 1];
  if (rsi === null) return { signal: "hold", rsi, sma, reason: "Not enough data" };
  if (rsi < 30 && sma !== null && last < sma) return { signal: "buy", rsi, sma, reason: "Oversold (RSI<30) below SMA" };
  if (rsi > 70 && sma !== null && last > sma) return { signal: "sell", rsi, sma, reason: "Overbought (RSI>70) above SMA" };
  return { signal: "hold", rsi, sma, reason: "Neutral momentum" };
}
