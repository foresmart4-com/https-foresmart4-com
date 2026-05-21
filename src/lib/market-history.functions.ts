// Multi-day historical market data for the Archive page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

type Category = AssetHistory["category"];

const YAHOO_MAP: Record<Category, Record<string, { ticker: string; name: string }>> = {
  crypto: {
    BTC: { ticker: "BTC-USD", name: "Bitcoin" },
    ETH: { ticker: "ETH-USD", name: "Ethereum" },
    SOL: { ticker: "SOL-USD", name: "Solana" },
    BNB: { ticker: "BNB-USD", name: "BNB" },
  },
  metals: {
    XAU: { ticker: "GC=F", name: "Gold Futures" },
    XAG: { ticker: "SI=F", name: "Silver Futures" },
  },
  currencies: {
    "EUR/USD": { ticker: "EURUSD=X", name: "Euro / US Dollar" },
    "GBP/USD": { ticker: "GBPUSD=X", name: "Pound / US Dollar" },
    "USD/JPY": { ticker: "JPY=X", name: "Dollar / Yen" },
    "USD/SAR": { ticker: "SAR=X", name: "Dollar / Saudi Riyal" },
  },
  stocks: {
    AAPL: { ticker: "AAPL", name: "Apple" },
    MSFT: { ticker: "MSFT", name: "Microsoft" },
    NVDA: { ticker: "NVDA", name: "NVIDIA" },
    TSLA: { ticker: "TSLA", name: "Tesla" },
    "2222.SR": { ticker: "2222.SR", name: "Saudi Aramco" },
    "1120.SR": { ticker: "1120.SR", name: "Al Rajhi Bank" },
    "2010.SR": { ticker: "2010.SR", name: "SABIC" },
  },
};

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
  const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : days <= 365 ? "1y" : days <= 730 ? "2y" : "5y";
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

export interface TopGainer {
  symbol: string;
  name: string;
  image?: string;
  price: number;
  changePct24h: number;
  marketCap?: number;
}

export const getTopGainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(data ?? {}))
  .handler(async ({ data }): Promise<TopGainer[]> => {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=${data.limit}&page=1&price_change_percentage=24h`,
      );
      if (!r.ok) return [];
      const arr = (await r.json()) as Array<{
        symbol: string; name: string; image: string; current_price: number;
        price_change_percentage_24h: number; market_cap: number;
      }>;
      return arr.map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        price: c.current_price,
        changePct24h: c.price_change_percentage_24h ?? 0,
        marketCap: c.market_cap,
      }));
    } catch (error) {
      console.error("Top gainers fetch failed", error);
      return [];
    }
  });

export interface TopStockGainer {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  currency: string;
  market: "us" | "saudi";
}

const STOCK_UNIVERSE: { symbol: string; name: string; market: "us" | "saudi" }[] = [
  { symbol: "AAPL", name: "Apple", market: "us" },
  { symbol: "MSFT", name: "Microsoft", market: "us" },
  { symbol: "NVDA", name: "NVIDIA", market: "us" },
  { symbol: "GOOGL", name: "Alphabet", market: "us" },
  { symbol: "AMZN", name: "Amazon", market: "us" },
  { symbol: "TSLA", name: "Tesla", market: "us" },
  { symbol: "META", name: "Meta", market: "us" },
  { symbol: "JPM", name: "JPMorgan", market: "us" },
  { symbol: "XOM", name: "ExxonMobil", market: "us" },
  { symbol: "LMT", name: "Lockheed Martin", market: "us" },
  { symbol: "2222.SR", name: "Saudi Aramco", market: "saudi" },
  { symbol: "1120.SR", name: "Al Rajhi Bank", market: "saudi" },
  { symbol: "2010.SR", name: "SABIC", market: "saudi" },
  { symbol: "7010.SR", name: "STC", market: "saudi" },
  { symbol: "1180.SR", name: "Saudi National Bank", market: "saudi" },
  { symbol: "2280.SR", name: "Almarai", market: "saudi" },
];

async function fetchStockQuote(symbol: string): Promise<{ price: number; changePct: number; currency: string } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { chart: { result?: Array<{ meta: { regularMarketPrice: number; chartPreviousClose: number; currency: string } }> } };
    const m = j.chart.result?.[0]?.meta;
    if (!m) return null;
    const price = m.regularMarketPrice;
    const prev = m.chartPreviousClose || price;
    return { price, changePct: prev ? ((price - prev) / prev) * 100 : 0, currency: m.currency || "USD" };
  } catch {
    return null;
  }
}

export const getTopStockGainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      market: z.enum(["all", "us", "saudi"]).default("all"),
      limit: z.number().int().min(1).max(30).default(10),
    }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<TopStockGainer[]> => {
    const list = data.market === "all" ? STOCK_UNIVERSE : STOCK_UNIVERSE.filter((s) => s.market === data.market);
    const results = await Promise.all(
      list.map(async (s) => {
        const q = await fetchStockQuote(s.symbol);
        if (!q) return null;
        return { symbol: s.symbol, name: s.name, market: s.market, price: q.price, changePct: q.changePct, currency: q.currency };
      }),
    );
    return results
      .filter((x): x is TopStockGainer => x !== null)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, data.limit);
  });

export const getAssetHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      symbol: z.string().min(1),
      category: z.enum(["crypto", "metals", "currencies", "stocks"]),
      days: z.number().int().min(7).max(1095).default(30),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<AssetHistory> => {
    const { symbol, category, days } = data;
    const yahooMeta = YAHOO_MAP[category]?.[symbol];
    if (yahooMeta) {
      try {
        const yahoo = await fetchYahooHistory(yahooMeta.ticker, days);
        if (yahoo.points.length > 0) {
          return { symbol, name: yahooMeta.name, category, currency: yahoo.currency, points: yahoo.points };
        }
      } catch (error) {
        console.error("Yahoo history fallback failed", error);
      }
    }

    if (category === "crypto" || category === "metals") {
      const meta = CRYPTO_MAP[symbol];
      if (!meta) return { symbol, name: symbol, category, currency: "USD", points: [] };
      const points = await fetchCryptoHistory(meta.id, days).catch((error) => {
        console.error("CoinGecko history failed", error);
        return [];
      });
      return { symbol, name: meta.name, category, currency: "USD", points };
    }
    if (category === "currencies") {
      const meta = FX_MAP[symbol];
      if (!meta) return { symbol, name: symbol, category, currency: "USD", points: [] };
      const points = await fetchFxHistory(meta.from, meta.to, days).catch((error) => {
        console.error("FX history failed", error);
        return [];
      });
      return { symbol, name: meta.name, category, currency: meta.to, points };
    }
    // stocks
    const r = await fetchYahooHistory(symbol, days).catch((error) => {
      console.error("Stock history failed", error);
      return { name: symbol, currency: "USD", points: [] };
    });
    return { symbol, name: r.name, category, currency: r.currency, points: r.points };
  });
