// Global stocks aggregator — fetches quotes from Yahoo Finance (free, no key).
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
}

interface CompanyDef {
  symbol: string;
  name: string;
  sector: string;
}

const COMPANIES: Record<StockRegion, CompanyDef[]> = {
  us: [
    { symbol: "AAPL", name: "Apple", sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft", sector: "Technology" },
    { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
    { symbol: "GOOGL", name: "Alphabet", sector: "Technology" },
    { symbol: "AMZN", name: "Amazon", sector: "E-commerce" },
    { symbol: "TSLA", name: "Tesla", sector: "Automotive" },
    { symbol: "META", name: "Meta Platforms", sector: "Social Media" },
    { symbol: "JPM", name: "JPMorgan Chase", sector: "Banking" },
    { symbol: "XOM", name: "ExxonMobil", sector: "Energy" },
    { symbol: "LMT", name: "Lockheed Martin", sector: "Defense" },
  ],
  eu: [
    { symbol: "MC.PA", name: "LVMH", sector: "Luxury" },
    { symbol: "ASML.AS", name: "ASML", sector: "Semiconductors" },
    { symbol: "SAP.DE", name: "SAP", sector: "Software" },
    { symbol: "SIE.DE", name: "Siemens", sector: "Industrial" },
    { symbol: "TTE.PA", name: "TotalEnergies", sector: "Energy" },
    { symbol: "AIR.PA", name: "Airbus", sector: "Aerospace" },
  ],
  uk: [
    { symbol: "SHEL.L", name: "Shell", sector: "Energy" },
    { symbol: "AZN.L", name: "AstraZeneca", sector: "Pharma" },
    { symbol: "HSBA.L", name: "HSBC", sector: "Banking" },
    { symbol: "BP.L", name: "BP", sector: "Energy" },
    { symbol: "ULVR.L", name: "Unilever", sector: "Consumer" },
  ],
  japan: [
    { symbol: "7203.T", name: "Toyota", sector: "Automotive" },
    { symbol: "6758.T", name: "Sony", sector: "Electronics" },
    { symbol: "9984.T", name: "SoftBank", sector: "Telecom" },
    { symbol: "6861.T", name: "Keyence", sector: "Industrial" },
    { symbol: "8306.T", name: "Mitsubishi UFJ", sector: "Banking" },
  ],
  china: [
    { symbol: "BABA", name: "Alibaba", sector: "E-commerce" },
    { symbol: "JD", name: "JD.com", sector: "E-commerce" },
    { symbol: "PDD", name: "PDD Holdings", sector: "E-commerce" },
    { symbol: "NIO", name: "NIO", sector: "Automotive" },
    { symbol: "BIDU", name: "Baidu", sector: "Technology" },
  ],
  uae: [
    { symbol: "EMAAR.AE", name: "Emaar Properties", sector: "Real Estate" },
    { symbol: "EAND.AE", name: "e&", sector: "Telecom" },
    { symbol: "FAB.AE", name: "First Abu Dhabi Bank", sector: "Banking" },
    { symbol: "DEWA.AE", name: "DEWA", sector: "Utilities" },
    { symbol: "ADNOCDIST.AE", name: "ADNOC Distribution", sector: "Energy" },
  ],
  saudi: [
    { symbol: "2222.SR", name: "Saudi Aramco", sector: "Energy" },
    { symbol: "1120.SR", name: "Al Rajhi Bank", sector: "Banking" },
    { symbol: "2010.SR", name: "SABIC", sector: "Petrochemicals" },
    { symbol: "7010.SR", name: "STC", sector: "Telecom" },
    { symbol: "1180.SR", name: "Saudi National Bank", sector: "Banking" },
    { symbol: "2280.SR", name: "Almarai", sector: "Food" },
  ],
};

async function fetchYahooQuote(c: CompanyDef, region: StockRegion): Promise<StockQuote | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
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
    const prev = res.meta.chartPreviousClose || closes[0] || price;
    return {
      symbol: c.symbol,
      name: c.name,
      region,
      sector: c.sector,
      price,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      high: res.meta.regularMarketDayHigh ?? price,
      low: res.meta.regularMarketDayLow ?? price,
      currency: res.meta.currency,
      history: closes,
    };
  } catch {
    return null;
  }
}

export const getStocksData = createServerFn({ method: "GET" }).handler(async () => {
  const tasks: Promise<StockQuote | null>[] = [];
  (Object.keys(COMPANIES) as StockRegion[]).forEach((region) => {
    COMPANIES[region].forEach((c) => tasks.push(fetchYahooQuote(c, region)));
  });
  const results = (await Promise.all(tasks)).filter((x): x is StockQuote => x !== null);
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
