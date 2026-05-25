// Free market data aggregator. Runs server-side via TanStack server functions.
import { createServerFn } from "@tanstack/react-start";

export type AssetCategory = "currencies" | "metals" | "oil" | "crypto" | "stocks" | "bonds";

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
  source: "live" | "delayed" | "simulated" | "unavailable";
}

const CRYPTO_IDS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", baseline: 102000 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", baseline: 3900 },
  { id: "solana", symbol: "SOL", name: "Solana", baseline: 185 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", baseline: 690 },
];

function syntheticCrypto(meta: (typeof CRYPTO_IDS)[number]): AssetQuote {
  const seed = meta.symbol.charCodeAt(0) + meta.symbol.charCodeAt(meta.symbol.length - 1);
  const hourKey = Math.floor(Date.now() / 3600000);
  const rand = (n: number) => { const x = Math.sin(seed * 9301 + hourKey * 49297 + n * 233280) * 10000; return x - Math.floor(x); };
  const history: { t: number; p: number }[] = [];
  let p = meta.baseline * (0.96 + rand(0) * 0.08);
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    p *= 1 + (rand(i + 1) - 0.5) * 0.025;
    history.push({ t: now - (23 - i) * 3600000, p });
  }
  const price = history[history.length - 1].p;
  const prev = history[history.length - 2]?.p ?? price;
  return {
    symbol: meta.symbol, name: meta.name, category: "crypto",
    price, changePct: prev ? ((price - prev) / prev) * 100 : 0,
    high24h: Math.max(...history.map((x) => x.p)),
    low24h: Math.min(...history.map((x) => x.p)),
    volume: 0, history,
    source: "simulated" as const,
  };
}

async function fetchCrypto(): Promise<AssetQuote[]> {
  try {
    const ids = CRYPTO_IDS.map((c) => c.id).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
    );
    if (!r.ok) return CRYPTO_IDS.map(syntheticCrypto);
    const data = (await r.json()) as Array<{
      id: string; current_price: number; price_change_percentage_24h: number;
      high_24h: number; low_24h: number; total_volume: number;
    }>;
    // Fetch 24h history for each (sparkline endpoint per coin)
    const results: AssetQuote[] = [];
    for (const coin of data) {
      const meta = CRYPTO_IDS.find((c) => c.id === coin.id);
      if (!meta) continue;
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
        source: "live" as const,
      });
      }
    return results.length ? results : CRYPTO_IDS.map(syntheticCrypto);
  } catch (error) {
    console.error("fetchCrypto failed", error);
    return CRYPTO_IDS.map(syntheticCrypto);
  }
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
        source: "live" as const,
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
        source: "live" as const,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Metal investment funds via Yahoo Finance (real ETFs)
const METAL_FUNDS = [
  { symbol: "GLD", name: "SPDR Gold Shares (صندوق الذهب)", baseline: 305 },
  { symbol: "IAU", name: "iShares Gold Trust (صندوق الذهب)", baseline: 62 },
  { symbol: "GLDM", name: "SPDR Gold MiniShares (صندوق الذهب الصغير)", baseline: 67 },
  { symbol: "SLV", name: "iShares Silver Trust (صندوق الفضة)", baseline: 36 },
  { symbol: "SIVR", name: "abrdn Physical Silver (صندوق الفضة)", baseline: 38 },
];

function syntheticAsset(meta: { symbol: string; name: string; baseline: number }, category: AssetCategory): AssetQuote {
  const seed = (meta.symbol.charCodeAt(0) + meta.symbol.charCodeAt(meta.symbol.length - 1)) % 100;
  const dayKey = Math.floor(Date.now() / 86400000);
  const rand = (n: number) => { const x = Math.sin(seed * 9301 + dayKey * 49297 + n * 233280) * 10000; return x - Math.floor(x); };
  const history: { t: number; p: number }[] = [];
  let p = meta.baseline * (0.97 + rand(0) * 0.06);
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    p = p * (1 + (rand(i + 1) - 0.5) * 0.01);
    history.push({ t: now - (29 - i) * 86400000, p });
  }
  const price = history[history.length - 1].p;
  const prev = history[history.length - 2].p;
  return {
    symbol: meta.symbol, name: meta.name, category,
    price, changePct: ((price - prev) / prev) * 100,
    high24h: Math.max(...history.slice(-5).map((x) => x.p)),
    low24h: Math.min(...history.slice(-5).map((x) => x.p)),
    volume: 0, history,
    source: "simulated" as const,
  };
}

async function fetchYahooAsset(
  f: { symbol: string; name: string; baseline: number },
  category: AssetCategory,
): Promise<AssetQuote> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${f.symbol}?interval=1d&range=1mo`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: ctrl.signal,
      },
    ).finally(() => clearTimeout(timeout));
    if (!r.ok) return syntheticAsset(f, category);
    const j = (await r.json()) as {
      chart: {
        result?: Array<{
          meta: {
            regularMarketPrice: number;
            chartPreviousClose: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
          };
          timestamp?: number[];
          indicators: { quote: Array<{ close: (number | null)[] }> };
        }>;
      };
    };
    const res = j.chart.result?.[0];
    if (!res) return syntheticAsset(f, category);
    const closes = (res.indicators.quote[0]?.close ?? []).filter(
      (x): x is number => x != null,
    );
    const ts = res.timestamp ?? [];
    const price = res.meta.regularMarketPrice;
    if (!price) return syntheticAsset(f, category);
    const prev = res.meta.chartPreviousClose || closes[closes.length - 2] || price;
    const history = closes.map((p, i) => ({
      t: (ts[i] ?? Date.now() / 1000) * 1000,
      p,
    }));
    return {
      symbol: f.symbol,
      name: f.name,
      category,
      price,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      high24h: res.meta.regularMarketDayHigh ?? price,
      low24h: res.meta.regularMarketDayLow ?? price,
      volume: res.meta.regularMarketVolume ?? 0,
      history: history.length ? history : [{ t: Date.now(), p: price }],
      source: "delayed" as const,
    };
  } catch {
    return syntheticAsset(f, category);
  }
}

async function fetchMetalFunds(): Promise<AssetQuote[]> {
  return Promise.all(METAL_FUNDS.map((f) => fetchYahooAsset(f, "metals")));
}

// ===== Bonds (via Yahoo Finance bond ETFs) =====
const BOND_FUNDS = [
  { symbol: "TLT", name: "iShares 20+ Year Treasury (سندات أمريكية طويلة الأجل)", baseline: 88 },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury (سندات أمريكية متوسطة)", baseline: 95 },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury (سندات أمريكية قصيرة)", baseline: 82 },
  { symbol: "BND", name: "Vanguard Total Bond Market (سوق السندات الكلي)", baseline: 73 },
  { symbol: "AGG", name: "iShares Core US Aggregate (مجمع السندات)", baseline: 99 },
  { symbol: "LQD", name: "iShares Investment Grade Corp (سندات شركات)", baseline: 109 },
  { symbol: "HYG", name: "iShares High Yield Corp (سندات عالية العائد)", baseline: 80 },
  { symbol: "TIP", name: "iShares TIPS Bond (سندات محمية من التضخم)", baseline: 108 },
  { symbol: "EMB", name: "iShares Emerging Markets Bond (سندات الأسواق الناشئة)", baseline: 91 },
];

async function fetchBonds(): Promise<AssetQuote[]> {
  return Promise.all(BOND_FUNDS.map((f) => fetchYahooAsset(f, "bonds")));
}

// ===== US stocks: Finnhub (live) → TwelveData (delayed) → Yahoo Finance (delayed) =====
const US_STOCKS = [
  { symbol: "SPY",  name: "S&P 500 ETF",   baseline: 560 },
  { symbol: "QQQ",  name: "Nasdaq 100 ETF", baseline: 480 },
  { symbol: "NVDA", name: "NVIDIA",          baseline: 130 },
  { symbol: "MSFT", name: "Microsoft",       baseline: 420 },
];

async function fetchUSStocks(): Promise<AssetQuote[]> {
  const now = Date.now();
  if (process.env.FINNHUB_API_KEY) {
    try {
      const { getQuote } = await import("@/services/providers/finnhub");
      const settled = await Promise.allSettled(US_STOCKS.map((s) => getQuote(s.symbol)));
      const out: AssetQuote[] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const meta = US_STOCKS[i];
        if (r.status === "fulfilled" && r.value.c) {
          const q = r.value;
          out.push({
            symbol: meta.symbol, name: meta.name, category: "stocks",
            price: q.c, changePct: q.dp ?? 0,
            high24h: q.h, low24h: q.l, volume: 0,
            history: [{ t: now - 86_400_000, p: q.pc }, { t: now, p: q.c }],
            source: "live",
          });
        }
      }
      if (out.length >= 2) return out;
    } catch (e) { console.warn("[market-data] Finnhub stocks:", e); }
  }
  if (process.env.TWELVEDATA_API_KEY) {
    try {
      const { getBatchQuotes } = await import("@/services/providers/twelvedata");
      const batch = await getBatchQuotes(US_STOCKS.map((s) => s.symbol));
      const out: AssetQuote[] = [];
      for (const meta of US_STOCKS) {
        const q = batch[meta.symbol];
        if (!q) continue;
        const price = parseFloat(q.close ?? "0");
        if (!price) continue;
        out.push({
          symbol: meta.symbol, name: meta.name, category: "stocks",
          price, changePct: parseFloat(q.percent_change ?? "0"),
          high24h: parseFloat(q.high ?? String(price)),
          low24h: parseFloat(q.low ?? String(price)),
          volume: parseFloat(q.volume ?? "0"),
          history: [
            { t: now - 86_400_000, p: parseFloat(q.previous_close ?? String(price)) },
            { t: now, p: price },
          ],
          source: "delayed",
        });
      }
      if (out.length >= 2) return out;
    } catch (e) { console.warn("[market-data] TwelveData stocks:", e); }
  }
  // Yahoo Finance fallback (free, delayed, no key required)
  const yahooSettled = await Promise.allSettled(US_STOCKS.map((s) => fetchYahooAsset(s, "stocks")));
  const yahooOut = yahooSettled.flatMap((r) =>
    r.status === "fulfilled" && r.value.price > 0 ? [r.value] : [],
  );
  if (yahooOut.length >= 2) return yahooOut;
  return US_STOCKS.map((s) => ({
    symbol: s.symbol, name: s.name, category: "stocks" as AssetCategory,
    price: 0, changePct: 0, high24h: 0, low24h: 0, volume: 0, history: [],
    source: "unavailable" as const,
  }));
}

// ===== Saudi stocks: SAHMK (live) → TwelveData (delayed) =====
const SAUDI_STOCKS = [
  { symbol: "2222.SR", name: "Saudi Aramco" },
  { symbol: "1120.SR", name: "Al Rajhi Bank" },
];

async function fetchSaudiStocks(): Promise<AssetQuote[]> {
  const now = Date.now();
  if (process.env.SAHMK_API_KEY) {
    try {
      const { getQuote } = await import("@/services/providers/sahmk");
      const settled = await Promise.allSettled(SAUDI_STOCKS.map((s) => getQuote(s.symbol)));
      const out: AssetQuote[] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const meta = SAUDI_STOCKS[i];
        if (r.status === "fulfilled" && r.value.price) {
          const q = r.value;
          out.push({
            symbol: meta.symbol, name: meta.name, category: "stocks",
            price: q.price, changePct: q.changePercent ?? 0,
            high24h: q.price, low24h: q.price, volume: q.volume ?? 0,
            history: [{ t: now, p: q.price }],
            source: q.delayed ? "delayed" : "live",
          });
        }
      }
      if (out.length > 0) return out;
    } catch (e) { console.warn("[market-data] SAHMK:", e); }
  }
  if (process.env.TWELVEDATA_API_KEY) {
    try {
      const { getQuote: tdQ } = await import("@/services/providers/twelvedata");
      const settled = await Promise.allSettled(SAUDI_STOCKS.map((s) => tdQ(s.symbol)));
      const out: AssetQuote[] = [];
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const meta = SAUDI_STOCKS[i];
        if (r.status === "fulfilled") {
          const price = parseFloat(r.value.close ?? "0");
          if (!price) continue;
          out.push({
            symbol: meta.symbol, name: meta.name, category: "stocks",
            price, changePct: parseFloat(r.value.percent_change ?? "0"),
            high24h: parseFloat(r.value.high ?? String(price)),
            low24h: parseFloat(r.value.low ?? String(price)),
            volume: parseFloat(r.value.volume ?? "0"),
            history: [{ t: now, p: price }],
            source: "delayed",
          });
        }
      }
      if (out.length > 0) return out;
    } catch (e) { console.warn("[market-data] TwelveData Saudi:", e); }
  }
  return SAUDI_STOCKS.map((s) => ({
    symbol: s.symbol, name: s.name, category: "stocks" as AssetCategory,
    price: 0, changePct: 0, high24h: 0, low24h: 0, volume: 0, history: [],
    source: "unavailable" as const,
  }));
}

// ===== Oil: AlphaVantage WTI/Brent daily series (cached 24h — minimal quota cost) =====
async function fetchOil(): Promise<AssetQuote[]> {
  if (!process.env.ALPHAVANTAGE_API_KEY) return [];
  try {
    const { getOilWti, getOilBrent } = await import("@/services/providers/alphavantage");
    const [wtiR, brentR] = await Promise.allSettled([getOilWti(), getOilBrent()]);
    const out: AssetQuote[] = [];
    const parse = (
      r: PromiseSettledResult<{ data: Array<{ date: string; value: string }> }>,
      symbol: string,
      name: string,
    ): AssetQuote | null => {
      if (r.status !== "fulfilled") return null;
      const rows = r.value?.data ?? [];
      if (rows.length < 2) return null;
      const price = parseFloat(rows[0].value);
      const prev = parseFloat(rows[1].value);
      if (!price || price <= 0) return null;
      const history = rows.slice(0, 30).reverse()
        .map((d) => ({ t: new Date(d.date).getTime(), p: parseFloat(d.value) }))
        .filter((h) => h.p > 0);
      return {
        symbol, name, category: "oil",
        price, changePct: prev ? ((price - prev) / prev) * 100 : 0,
        high24h: price, low24h: price, volume: 0,
        history, source: "delayed",
      };
    };
    const wti = parse(wtiR, "WTI", "Crude Oil WTI");
    const brent = parse(brentR, "BRENT", "Crude Oil Brent");
    if (wti) out.push(wti);
    if (brent) out.push(brent);
    return out;
  } catch (e) {
    console.warn("[market-data] Oil fetch:", e);
    return [];
  }
}

export const getMarketData = createServerFn({ method: "GET" })
  .handler(async () => {
    const safe = async (loader: () => Promise<AssetQuote[]>, label: string) => {
      try {
        return await loader();
      } catch (error) {
        console.error(`Market loader failed: ${label}`, error);
        return [];
      }
    };
    const [crypto, fx, metals, metalFunds, bonds, usStocks, saudiStocks, oil] = await Promise.all([
      safe(fetchCrypto, "crypto"),
      safe(fetchFX, "fx"),
      safe(fetchMetals, "metals"),
      safe(fetchMetalFunds, "metal-funds"),
      safe(fetchBonds, "bonds"),
      safe(fetchUSStocks, "us-stocks"),
      safe(fetchSaudiStocks, "saudi-stocks"),
      safe(fetchOil, "oil"),
    ]);
    return {
      assets: [...crypto, ...metals, ...metalFunds, ...fx, ...bonds, ...usStocks, ...saudiStocks, ...oil],
      fetchedAt: Date.now(),
    };
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
