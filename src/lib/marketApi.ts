// Market data services
// CoinGecko: live crypto (no API key — browser-safe, called directly from client components)
// Saudi / US / Commodity: server-side only via provider adapters (SAHMK / Finnhub / TwelveData / AlphaVantage)

import { createServerFn } from "@tanstack/react-start";

// "mock" retained for backward compatibility with AIDecisionPanel isMock check.
export type CryptoSource = "live" | "mock" | "delayed" | "simulated" | "unavailable";

export type CryptoQuote = {
  id: string;
  symbol: string;
  name_en: string;
  name_ar: string;
  price: number;
  change24h: number;
  marketCap?: number;
  source: CryptoSource;
  updatedAt: number;
};

const COINGECKO_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"] as const;

const SYMBOL_MAP: Record<string, { sym: string; name_en: string; name_ar: string }> = {
  bitcoin:     { sym: "BTC", name_en: "Bitcoin",  name_ar: "بتكوين" },
  ethereum:    { sym: "ETH", name_en: "Ethereum", name_ar: "إيثيريوم" },
  solana:      { sym: "SOL", name_en: "Solana",   name_ar: "سولانا" },
  binancecoin: { sym: "BNB", name_en: "BNB",      name_ar: "بينانس كوين" },
  ripple:      { sym: "XRP", name_en: "XRP",      name_ar: "ريبل" },
};

// Fallback keeps source "mock" so AIDecisionPanel.isMock check stays correct.
const MOCK_CRYPTO: CryptoQuote[] = [
  { id: "bitcoin",     symbol: "BTC", name_en: "Bitcoin",  name_ar: "بتكوين",      price: 64800, change24h: -0.74, marketCap: 1_270_000_000_000, source: "mock", updatedAt: Date.now() },
  { id: "ethereum",    symbol: "ETH", name_en: "Ethereum", name_ar: "إيثيريوم",    price: 3120,  change24h: -0.42, marketCap: 375_000_000_000,   source: "mock", updatedAt: Date.now() },
  { id: "solana",      symbol: "SOL", name_en: "Solana",   name_ar: "سولانا",      price: 148,   change24h: 1.21,  marketCap: 67_000_000_000,    source: "mock", updatedAt: Date.now() },
  { id: "binancecoin", symbol: "BNB", name_en: "BNB",      name_ar: "بينانس كوين", price: 588,   change24h: 0.34,  marketCap: 86_000_000_000,    source: "mock", updatedAt: Date.now() },
  { id: "ripple",      symbol: "XRP", name_en: "XRP",      name_ar: "ريبل",        price: 0.52,  change24h: -1.08, marketCap: 29_000_000_000,    source: "mock", updatedAt: Date.now() },
];

// Browser-callable — CoinGecko is a public API, no key needed.
export async function fetchCryptoLive(): Promise<CryptoQuote[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS.join(",")}&price_change_percentage=24h`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const json = (await res.json()) as Array<{
      id: string; symbol: string; current_price: number;
      price_change_percentage_24h: number | null; market_cap: number | null;
    }>;
    const now = Date.now();
    return json.map((c) => {
      const meta = SYMBOL_MAP[c.id] ?? { sym: c.symbol.toUpperCase(), name_en: c.id, name_ar: c.id };
      return {
        id: c.id,
        symbol: meta.sym,
        name_en: meta.name_en,
        name_ar: meta.name_ar,
        price: c.current_price,
        change24h: c.price_change_percentage_24h ?? 0,
        marketCap: c.market_cap ?? undefined,
        source: "live" as const,
        updatedAt: now,
      };
    });
  } catch (e) {
    console.warn("[marketApi] CoinGecko failed, using mock fallback:", e);
    return MOCK_CRYPTO.map((m) => ({ ...m, updatedAt: Date.now() }));
  }
}

// ===== Server-side market data via provider adapters =====

export type MarketDataItem = {
  symbol: string;
  name_ar: string;
  name_en: string;
  price: number;
  change: number;
};

export type MarketDataResult = {
  source: "live" | "delayed" | "unavailable";
  updatedAt: number;
  items: MarketDataItem[];
};

// Saudi market: SAHMK (live) → TwelveData (delayed) → unavailable
export const fetchSaudiMarketData = createServerFn({ method: "GET" })
  .handler(async (): Promise<MarketDataResult> => {
    const now = Date.now();
    const pairs = [
      { symbol: "2222.SR", name_ar: "أرامكو السعودية", name_en: "Saudi Aramco" },
      { symbol: "1120.SR", name_ar: "الراجحي",         name_en: "Al Rajhi Bank" },
    ];
    if (process.env.SAHMK_API_KEY) {
      try {
        const { getQuote } = await import("@/services/providers/sahmk");
        const settled = await Promise.allSettled(pairs.map((p) => getQuote(p.symbol)));
        const items: MarketDataItem[] = [];
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status === "fulfilled" && r.value.price) {
            items.push({ ...pairs[i], price: r.value.price, change: r.value.changePercent ?? 0 });
          }
        }
        if (items.length > 0) return { source: "live", updatedAt: now, items };
      } catch { /* fall through */ }
    }
    if (process.env.TWELVEDATA_API_KEY) {
      try {
        const { getQuote } = await import("@/services/providers/twelvedata");
        const settled = await Promise.allSettled(pairs.map((p) => getQuote(p.symbol)));
        const items: MarketDataItem[] = [];
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status === "fulfilled") {
            const price = parseFloat(r.value.close ?? "0");
            if (price) items.push({ ...pairs[i], price, change: parseFloat(r.value.percent_change ?? "0") });
          }
        }
        if (items.length > 0) return { source: "delayed", updatedAt: now, items };
      } catch { /* fall through */ }
    }
    return { source: "unavailable", updatedAt: now, items: [] };
  });

// US market: Finnhub (live) → TwelveData (delayed) → unavailable
export const fetchUSMarketData = createServerFn({ method: "GET" })
  .handler(async (): Promise<MarketDataResult> => {
    const now = Date.now();
    const pairs = [
      { symbol: "SPY",  name_ar: "ستاندرد آند بورز", name_en: "S&P 500 ETF" },
      { symbol: "QQQ",  name_ar: "ناسداك",            name_en: "Nasdaq 100 ETF" },
      { symbol: "NVDA", name_ar: "إنفيديا",           name_en: "NVIDIA" },
    ];
    if (process.env.FINNHUB_API_KEY) {
      try {
        const { getQuote } = await import("@/services/providers/finnhub");
        const settled = await Promise.allSettled(pairs.map((p) => getQuote(p.symbol)));
        const items: MarketDataItem[] = [];
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status === "fulfilled" && r.value.c) {
            items.push({ ...pairs[i], price: r.value.c, change: r.value.dp ?? 0 });
          }
        }
        if (items.length >= 2) return { source: "live", updatedAt: now, items };
      } catch { /* fall through */ }
    }
    if (process.env.TWELVEDATA_API_KEY) {
      try {
        const { getBatchQuotes } = await import("@/services/providers/twelvedata");
        const batch = await getBatchQuotes(pairs.map((p) => p.symbol));
        const items: MarketDataItem[] = [];
        for (const p of pairs) {
          const q = batch[p.symbol];
          if (!q) continue;
          const price = parseFloat(q.close ?? "0");
          if (price) items.push({ ...p, price, change: parseFloat(q.percent_change ?? "0") });
        }
        if (items.length >= 2) return { source: "delayed", updatedAt: now, items };
      } catch { /* fall through */ }
    }
    return { source: "unavailable", updatedAt: now, items: [] };
  });

// Commodities: AlphaVantage WTI/Brent (daily, delayed, cached 24h) → unavailable
export const fetchCommodityData = createServerFn({ method: "GET" })
  .handler(async (): Promise<MarketDataResult> => {
    const now = Date.now();
    if (!process.env.ALPHAVANTAGE_API_KEY) return { source: "unavailable", updatedAt: now, items: [] };
    try {
      const { getOilWti, getOilBrent, getGoldQuote } = await import("@/services/providers/alphavantage");
      const [wtiR, brentR, goldR] = await Promise.allSettled([getOilWti(), getOilBrent(), getGoldQuote()]);
      const items: MarketDataItem[] = [];
      if (wtiR.status === "fulfilled") {
        const rows = wtiR.value?.data ?? [];
        const price = parseFloat(rows[0]?.value ?? "0");
        const prev = parseFloat(rows[1]?.value ?? "0");
        if (price > 0) items.push({ symbol: "WTI", name_ar: "النفط الخام", name_en: "Crude Oil WTI", price, change: prev ? ((price - prev) / prev) * 100 : 0 });
      }
      if (brentR.status === "fulfilled") {
        const rows = brentR.value?.data ?? [];
        const price = parseFloat(rows[0]?.value ?? "0");
        const prev = parseFloat(rows[1]?.value ?? "0");
        if (price > 0) items.push({ symbol: "BRENT", name_ar: "نفط برنت", name_en: "Crude Oil Brent", price, change: prev ? ((price - prev) / prev) * 100 : 0 });
      }
      if (goldR.status === "fulfilled") {
        const gq = goldR.value?.["Global Quote"];
        if (gq) {
          const price = parseFloat(gq["05. price"] ?? "0");
          const changePct = parseFloat((gq["10. change percent"] ?? "0%").replace("%", ""));
          if (price > 0) items.push({ symbol: "GLD", name_ar: "صندوق الذهب (GLD)", name_en: "Gold ETF (GLD)", price, change: changePct });
        }
      }
      if (items.length > 0) return { source: "delayed", updatedAt: now, items };
    } catch { /* fall through */ }
    return { source: "unavailable", updatedAt: now, items: [] };
  });
