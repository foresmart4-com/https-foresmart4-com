import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntelDataMode = "live" | "delayed" | "manual" | "mock";
export type IntelCategoryServer =
  | "us_stock" | "sa_stock" | "crypto" | "metal" | "commodity" | "etf_bond";

export interface UniversalQuote {
  symbol: string;
  name: string;
  category: IntelCategoryServer;
  price: number;
  changePct: number;
  high24h?: number;
  low24h?: number;
  source: string;
  mode: IntelDataMode;
  fetchedAt: number;
}

const Input = z.object({
  category: z.enum(["us_stock","sa_stock","crypto","metal","commodity","etf_bond"]),
  symbol: z.string().trim().min(1).max(20).regex(/^[A-Z0-9./\-_]+$/i),
  name: z.string().trim().max(120).optional(),
});

// ---------- providers ----------
async function fromCoinGecko(sym: string): Promise<Partial<UniversalQuote> | null> {
  const map: Record<string,string> = {
    BTC:"bitcoin", ETH:"ethereum", BNB:"binancecoin", SOL:"solana", XRP:"ripple",
    ADA:"cardano", DOGE:"dogecoin", AVAX:"avalanche-2", LINK:"chainlink",
    DOT:"polkadot", MATIC:"matic-network", LTC:"litecoin", TRX:"tron",
    UNI:"uniswap", ATOM:"cosmos",
  };
  const id = map[sym.toUpperCase()];
  if (!id) return null;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const md = j.market_data;
    if (!md?.current_price?.usd) return null;
    return {
      price: Number(md.current_price.usd),
      changePct: Number(md.price_change_percentage_24h ?? 0),
      high24h: Number(md.high_24h?.usd),
      low24h: Number(md.low_24h?.usd),
      source: "CoinGecko",
      mode: "live",
    };
  } catch { return null; }
}

async function fromBinance(sym: string): Promise<Partial<UniversalQuote> | null> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym.toUpperCase()}USDT`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.lastPrice);
    if (!Number.isFinite(p) || p <= 0) return null;
    return {
      price: p,
      changePct: Number(j.priceChangePercent ?? 0),
      high24h: Number(j.highPrice),
      low24h: Number(j.lowPrice),
      source: "Binance",
      mode: "live",
    };
  } catch { return null; }
}

async function fromFinnhub(sym: string): Promise<Partial<UniversalQuote> | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.c);
    if (!Number.isFinite(p) || p <= 0) return null;
    return {
      price: p, changePct: Number(j.dp ?? 0),
      high24h: Number(j.h), low24h: Number(j.l),
      source: "Finnhub", mode: "live",
    };
  } catch { return null; }
}

async function fromTwelveData(sym: string): Promise<Partial<UniversalQuote> | null> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${key}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.close ?? j.price);
    if (!Number.isFinite(p) || p <= 0) return null;
    return {
      price: p,
      changePct: Number(j.percent_change ?? 0),
      high24h: Number(j.high),
      low24h: Number(j.low),
      source: "TwelveData", mode: "delayed",
    };
  } catch { return null; }
}

async function fromAlphaVantage(sym: string): Promise<Partial<UniversalQuote> | null> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${key}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const q = j["Global Quote"] || {};
    const p = Number(q["05. price"]);
    if (!Number.isFinite(p) || p <= 0) return null;
    return {
      price: p,
      changePct: Number(String(q["10. change percent"] ?? "0").replace("%","")),
      high24h: Number(q["03. high"]),
      low24h: Number(q["04. low"]),
      source: "AlphaVantage", mode: "delayed",
    };
  } catch { return null; }
}

async function resolveQuote(category: IntelCategoryServer, symbol: string): Promise<Partial<UniversalQuote>> {
  const S = symbol.toUpperCase();
  if (category === "crypto") {
    return (await fromCoinGecko(S)) || (await fromBinance(S)) ||
      { price: 0, changePct: 0, source: "unavailable", mode: "mock" };
  }
  if (category === "us_stock" || category === "etf_bond") {
    return (await fromFinnhub(S)) || (await fromTwelveData(S)) || (await fromAlphaVantage(S)) ||
      { price: 0, changePct: 0, source: "unavailable", mode: "mock" };
  }
  if (category === "sa_stock") {
    return (await fromTwelveData(S)) || (await fromAlphaVantage(S)) ||
      { price: 0, changePct: 0, source: "manual", mode: "manual" };
  }
  if (category === "metal" || category === "commodity") {
    return (await fromTwelveData(S)) || (await fromAlphaVantage(S)) || (await fromFinnhub(S)) ||
      { price: 0, changePct: 0, source: "manual", mode: "manual" };
  }
  return { price: 0, changePct: 0, source: "unavailable", mode: "mock" };
}

export const getUniversalQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<UniversalQuote> => {
    const q = await resolveQuote(data.category, data.symbol);
    return {
      symbol: data.symbol.toUpperCase(),
      name: data.name ?? data.symbol.toUpperCase(),
      category: data.category,
      price: Number(q.price ?? 0),
      changePct: Number(q.changePct ?? 0),
      high24h: q.high24h,
      low24h: q.low24h,
      source: String(q.source ?? "unavailable"),
      mode: (q.mode as IntelDataMode) ?? "mock",
      fetchedAt: Date.now(),
    };
  });
