// Multi-day historical market data for the Archive page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface AssetHistory {
  symbol: string;
  name: string;
  category: "crypto" | "metals" | "currencies" | "stocks";
  currency: string;
  points: HistoryPoint[];
}

const CRYPTO_MAP: Record<string, { id: string; name: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin" },
  ETH: { id: "ethereum", name: "Ethereum" },
  SOL: { id: "solana", name: "Solana" },
  BNB: { id: "binancecoin", name: "BNB" },
  XAU: { id: "pax-gold", name: "Gold (PAXG)" },
  XAG: { id: "kinesis-silver", name: "Silver (KAG)" },
};

const FX_MAP: Record<string, { from: string; to: string; name: string }> = {
  "EUR/USD": { from: "EUR", to: "USD", name: "Euro / US Dollar" },
  "GBP/USD": { from: "GBP", to: "USD", name: "Pound / US Dollar" },
  "USD/JPY": { from: "USD", to: "JPY", name: "Dollar / Yen" },
  "USD/SAR": { from: "USD", to: "SAR", name: "Dollar / Saudi Riyal" },
};

async function fetchCryptoHistory(coinId: string, days: number): Promise<HistoryPoint[]> {
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
  );
  if (!r.ok) return [];
  const d = (await r.json()) as { prices: [number, number][]; total_volumes?: [number, number][] };
  const volMap = new Map((d.total_volumes ?? []).map(([t, v]) => [new Date(t).toISOString().slice(0, 10), v]));
  const byDay = new Map<string, number>();
  for (const [t, p] of d.prices) {
    const k = new Date(t).toISOString().slice(0, 10);
    byDay.set(k, p);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close, volume: volMap.get(date) }));
}

async function fetchFxHistory(from: string, to: string, days: number): Promise<HistoryPoint[]> {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const r = await fetch(`https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=${from}&symbols=${to}`);
  if (!r.ok) return [];
  const d = (await r.json()) as { rates: Record<string, Record<string, number>> };
  return Object.entries(d.rates)
    .map(([date, rate]) => ({ date, close: rate[to] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchYahooHistory(symbol: string, days: number): Promise<{ name: string; currency: string; points: HistoryPoint[] }> {
  const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : "1y";
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  if (!r.ok) return { name: symbol, currency: "USD", points: [] };
  const j = (await r.json()) as {
    chart: {
      result?: Array<{
        meta: { currency: string; symbol: string; longName?: string; shortName?: string };
        timestamp: number[];
        indicators: {
          quote: Array<{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }>;
        };
      }>;
    };
  };
  const res = j.chart.result?.[0];
  if (!res) return { name: symbol, currency: "USD", points: [] };
  const q = res.indicators.quote[0];
  const points: HistoryPoint[] = res.timestamp.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: q.open[i] ?? undefined,
    high: q.high[i] ?? undefined,
    low: q.low[i] ?? undefined,
    close: q.close[i] ?? 0,
    volume: q.volume[i] ?? undefined,
  })).filter((p) => p.close);
  return {
    name: res.meta.longName || res.meta.shortName || symbol,
    currency: res.meta.currency || "USD",
    points,
  };
}

export const getAssetHistory = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({
      symbol: z.string().min(1),
      category: z.enum(["crypto", "metals", "currencies", "stocks"]),
      days: z.number().int().min(7).max(365).default(30),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<AssetHistory> => {
    const { symbol, category, days } = data;
    if (category === "crypto" || category === "metals") {
      const meta = CRYPTO_MAP[symbol];
      if (!meta) return { symbol, name: symbol, category, currency: "USD", points: [] };
      const points = await fetchCryptoHistory(meta.id, days);
      return { symbol, name: meta.name, category, currency: "USD", points };
    }
    if (category === "currencies") {
      const meta = FX_MAP[symbol];
      if (!meta) return { symbol, name: symbol, category, currency: "USD", points: [] };
      const points = await fetchFxHistory(meta.from, meta.to, days);
      return { symbol, name: meta.name, category, currency: meta.to, points };
    }
    // stocks
    const r = await fetchYahooHistory(symbol, days);
    return { symbol, name: r.name, category, currency: r.currency, points: r.points };
  });
