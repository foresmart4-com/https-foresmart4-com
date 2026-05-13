// Global stocks aggregator — fetches quotes from Yahoo Finance with resilient fallback.
// If Yahoo is unreachable from the edge runtime, we synthesize a quote around a
// baseline reference price so the UI always renders meaningful data.
import { createServerFn } from "@tanstack/react-start";

export type StockRegion =
  | "us"
  | "eu"
  | "uk"
  | "japan"
  | "china"
  | "uae"
  | "saudi";

export interface StockQuote {
  symbol: string;
  name: string;
  region: StockRegion;
  sector: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
  currency: string;
  history: number[];
  isLive?: boolean;
}

interface CompanyDef {
  symbol: string;
  name: string;
  sector: string;
  baseline: number;
  currency: string;
}

const COMPANIES: Record<StockRegion, CompanyDef[]> = {
  us: [
    { symbol: "AAPL", name: "Apple", sector: "Technology", baseline: 290, currency: "USD" },
    { symbol: "MSFT", name: "Microsoft", sector: "Technology", baseline: 470, currency: "USD" },
    { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors", baseline: 175, currency: "USD" },
    { symbol: "GOOGL", name: "Alphabet", sector: "Technology", baseline: 200, currency: "USD" },
    { symbol: "AMZN", name: "Amazon", sector: "E-commerce", baseline: 230, currency: "USD" },
    { symbol: "TSLA", name: "Tesla", sector: "Automotive", baseline: 350, currency: "USD" },
    { symbol: "META", name: "Meta Platforms", sector: "Social Media", baseline: 620, currency: "USD" },
    { symbol: "JPM", name: "JPMorgan Chase", sector: "Banking", baseline: 245, currency: "USD" },
    { symbol: "XOM", name: "ExxonMobil", sector: "Energy", baseline: 118, currency: "USD" },
    { symbol: "LMT", name: "Lockheed Martin", sector: "Defense", baseline: 510, currency: "USD" },
  ],
  eu: [
    { symbol: "MC.PA", name: "LVMH", sector: "Luxury", baseline: 690, currency: "EUR" },
    { symbol: "ASML.AS", name: "ASML", sector: "Semiconductors", baseline: 720, currency: "EUR" },
    { symbol: "SAP.DE", name: "SAP", sector: "Software", baseline: 240, currency: "EUR" },
    { symbol: "SIE.DE", name: "Siemens", sector: "Industrial", baseline: 195, currency: "EUR" },
    { symbol: "TTE.PA", name: "TotalEnergies", sector: "Energy", baseline: 62, currency: "EUR" },
    { symbol: "AIR.PA", name: "Airbus", sector: "Aerospace", baseline: 175, currency: "EUR" },
  ],
  uk: [
    { symbol: "SHEL.L", name: "Shell", sector: "Energy", baseline: 2780, currency: "GBp" },
    { symbol: "AZN.L", name: "AstraZeneca", sector: "Pharma", baseline: 12100, currency: "GBp" },
    { symbol: "HSBA.L", name: "HSBC", sector: "Banking", baseline: 920, currency: "GBp" },
    { symbol: "BP.L", name: "BP", sector: "Energy", baseline: 410, currency: "GBp" },
    { symbol: "ULVR.L", name: "Unilever", sector: "Consumer", baseline: 4650, currency: "GBp" },
  ],
  japan: [
    { symbol: "7203.T", name: "Toyota", sector: "Automotive", baseline: 2850, currency: "JPY" },
    { symbol: "6758.T", name: "Sony", sector: "Electronics", baseline: 3400, currency: "JPY" },
    { symbol: "9984.T", name: "SoftBank", sector: "Telecom", baseline: 11200, currency: "JPY" },
    { symbol: "6861.T", name: "Keyence", sector: "Industrial", baseline: 64200, currency: "JPY" },
    { symbol: "8306.T", name: "Mitsubishi UFJ", sector: "Banking", baseline: 2150, currency: "JPY" },
  ],
  china: [
    { symbol: "BABA", name: "Alibaba", sector: "E-commerce", baseline: 135, currency: "USD" },
    { symbol: "JD", name: "JD.com", sector: "E-commerce", baseline: 38, currency: "USD" },
    { symbol: "PDD", name: "PDD Holdings", sector: "E-commerce", baseline: 125, currency: "USD" },
    { symbol: "NIO", name: "NIO", sector: "Automotive", baseline: 6.5, currency: "USD" },
    { symbol: "BIDU", name: "Baidu", sector: "Technology", baseline: 95, currency: "USD" },
  ],
  uae: [
    { symbol: "EMAAR.AE", name: "Emaar Properties", sector: "Real Estate", baseline: 13.4, currency: "AED" },
    { symbol: "EAND.AE", name: "e&", sector: "Telecom", baseline: 17.8, currency: "AED" },
    { symbol: "FAB.AE", name: "First Abu Dhabi Bank", sector: "Banking", baseline: 14.6, currency: "AED" },
    { symbol: "DEWA.AE", name: "DEWA", sector: "Utilities", baseline: 2.55, currency: "AED" },
    { symbol: "ADNOCDIST.AE", name: "ADNOC Distribution", sector: "Energy", baseline: 3.85, currency: "AED" },
  ],
  saudi: [
    { symbol: "2222.SR", name: "Saudi Aramco", sector: "Energy", baseline: 27.8, currency: "SAR" },
    { symbol: "1120.SR", name: "Al Rajhi Bank", sector: "Banking", baseline: 96, currency: "SAR" },
    { symbol: "2010.SR", name: "SABIC", sector: "Petrochemicals", baseline: 64, currency: "SAR" },
    { symbol: "7010.SR", name: "STC", sector: "Telecom", baseline: 41, currency: "SAR" },
    { symbol: "1180.SR", name: "Saudi National Bank", sector: "Banking", baseline: 35, currency: "SAR" },
    { symbol: "2280.SR", name: "Almarai", sector: "Food", baseline: 53, currency: "SAR" },
  ],
};

function syntheticQuote(c: CompanyDef, region: StockRegion): StockQuote {
  // Deterministic-ish daily walk based on date so values move slightly day to day.
  const seed = (c.symbol.charCodeAt(0) + c.symbol.charCodeAt(c.symbol.length - 1)) % 100;
  const dayKey = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const rand = (n: number) => {
    const x = Math.sin(seed * 9301 + dayKey * 49297 + n * 233280) * 10000;
    return x - Math.floor(x);
  };
  const history: number[] = [];
  let p = c.baseline * (0.97 + rand(0) * 0.06);
  for (let i = 0; i < 30; i++) {
    p = p * (1 + (rand(i + 1) - 0.5) * 0.012);
    history.push(p);
  }
  const price = history[history.length - 1];
  const prev = history[history.length - 2] ?? price;
  return {
    symbol: c.symbol,
    name: c.name,
    region,
    sector: c.sector,
    price,
    changePct: ((price - prev) / prev) * 100,
    high: Math.max(...history.slice(-5)),
    low: Math.min(...history.slice(-5)),
    currency: c.currency,
    history,
    isLive: false,
  };
}

async function fetchYahooQuote(c: CompanyDef, region: StockRegion): Promise<StockQuote | null> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}?interval=1d&range=1mo`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept": "application/json",
        },
        signal: ctrl.signal,
      },
    ).finally(() => clearTimeout(timeout));
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart: {
        result?: Array<{
          meta: {
            regularMarketPrice: number;
            chartPreviousClose: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            currency: string;
          };
          indicators: { quote: Array<{ close: (number | null)[] }> };
        }>;
      };
    };
    const res = j.chart.result?.[0];
    if (!res) return null;
    const closes = (res.indicators.quote[0]?.close ?? []).filter((x): x is number => x != null);
    const price = res.meta.regularMarketPrice;
    if (!price) return null;
    const prev = res.meta.chartPreviousClose || closes[closes.length - 2] || price;
    return {
      symbol: c.symbol,
      name: c.name,
      region,
      sector: c.sector,
      price,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      high: res.meta.regularMarketDayHigh ?? price,
      low: res.meta.regularMarketDayLow ?? price,
      currency: res.meta.currency || c.currency,
      history: closes.length ? closes : [price],
      isLive: true,
    };
  } catch {
    return null;
  }
}

export const getStocksData = createServerFn({ method: "GET" })
  .handler(async () => {
  const all: Array<{ region: StockRegion; def: CompanyDef }> = [];
  (Object.keys(COMPANIES) as StockRegion[]).forEach((region) => {
    COMPANIES[region].forEach((def) => all.push({ region, def }));
  });
  const tasks = all.map(({ region, def }) =>
    fetchYahooQuote(def, region).then((q) => q ?? syntheticQuote(def, region)),
  );
  const results = await Promise.all(tasks);
  return { stocks: results, fetchedAt: Date.now() };
});

export const REGION_LABELS: Record<StockRegion, { ar: string; en: string; flag: string }> = {
  us: { ar: "السوق الأمريكي", en: "United States", flag: "🇺🇸" },
  eu: { ar: "السوق الأوروبي", en: "Europe", flag: "🇪🇺" },
  uk: { ar: "السوق البريطاني", en: "United Kingdom", flag: "🇬🇧" },
  japan: { ar: "السوق الياباني", en: "Japan", flag: "🇯🇵" },
  china: { ar: "السوق الصيني", en: "China", flag: "🇨🇳" },
  uae: { ar: "السوق الإماراتي", en: "UAE", flag: "🇦🇪" },
  saudi: { ar: "السوق السعودي", en: "Saudi Arabia", flag: "🇸🇦" },
};
