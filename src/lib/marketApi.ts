// Market data services
// CoinGecko: live crypto (no API key required for public endpoints)
// Stocks/commodities: placeholders — to be wired later via Twelve Data / Alpha Vantage / Finnhub
// or a Saudi market data provider when available.

export type CryptoQuote = {
  id: string;
  symbol: string;
  name_en: string;
  name_ar: string;
  price: number;
  change24h: number;
  marketCap?: number;
  source: "live" | "mock";
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

const MOCK_CRYPTO: CryptoQuote[] = [
  { id: "bitcoin",     symbol: "BTC", name_en: "Bitcoin",  name_ar: "بتكوين",      price: 64800, change24h: -0.74, marketCap: 1_270_000_000_000, source: "mock", updatedAt: Date.now() },
  { id: "ethereum",    symbol: "ETH", name_en: "Ethereum", name_ar: "إيثيريوم",    price: 3120,  change24h: -0.42, marketCap: 375_000_000_000,   source: "mock", updatedAt: Date.now() },
  { id: "solana",      symbol: "SOL", name_en: "Solana",   name_ar: "سولانا",      price: 148,   change24h: 1.21,  marketCap: 67_000_000_000,    source: "mock", updatedAt: Date.now() },
  { id: "binancecoin", symbol: "BNB", name_en: "BNB",      name_ar: "بينانس كوين", price: 588,   change24h: 0.34,  marketCap: 86_000_000_000,    source: "mock", updatedAt: Date.now() },
  { id: "ripple",      symbol: "XRP", name_en: "XRP",      name_ar: "ريبل",        price: 0.52,  change24h: -1.08, marketCap: 29_000_000_000,    source: "mock", updatedAt: Date.now() },
];

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

// ===== Placeholders for future integration =====
// TODO: wire to Twelve Data / Alpha Vantage / Finnhub
export async function fetchSaudiMarketData() {
  return {
    source: "mock" as const,
    updatedAt: Date.now(),
    items: [
      { symbol: "2222.SR", name_ar: "أرامكو السعودية", name_en: "Saudi Aramco", price: 28.40, change: 1.42 },
      { symbol: "1120.SR", name_ar: "الراجحي",          name_en: "Al Rajhi",      price: 92.10, change: 0.35 },
      { symbol: "TASI",    name_ar: "تاسي",              name_en: "TASI",          price: 11820, change: 0.62 },
    ],
  };
}

// TODO: wire to Alpha Vantage / Finnhub / Polygon
export async function fetchUSMarketData() {
  return {
    source: "mock" as const,
    updatedAt: Date.now(),
    items: [
      { symbol: "S&P 500", name_ar: "ستاندرد آند بورز", name_en: "S&P 500", price: 5870,  change: -0.18 },
      { symbol: "NASDAQ",  name_ar: "ناسداك",            name_en: "Nasdaq",  price: 19240, change: 0.42 },
      { symbol: "NVDA",    name_ar: "إنفيديا",           name_en: "NVIDIA",  price: 142.20, change: 2.18 },
    ],
  };
}

// TODO: wire to Metals-API / TradingEconomics
export async function fetchCommodityData() {
  return {
    source: "mock" as const,
    updatedAt: Date.now(),
    items: [
      { symbol: "XAU", name_ar: "الذهب", name_en: "Gold (oz)",     price: 2418, change: 0.94 },
      { symbol: "WTI", name_ar: "النفط", name_en: "Crude Oil WTI", price: 78.20, change: -1.21 },
    ],
  };
}
