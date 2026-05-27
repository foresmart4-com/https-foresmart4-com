/**
 * Server-only quote resolver shared between universal-quote and alert evaluation.
 * Mirrors the routing logic in universal-quote.functions.ts so both stay aligned.
 */
export type ResolverCategory =
  | "us_stock" | "sa_stock" | "crypto" | "metal" | "commodity" | "etf_bond";

export type ResolverMode = "live" | "delayed" | "manual" | "mock";

export interface ResolvedQuote {
  price: number;
  changePct: number;
  high24h?: number;
  low24h?: number;
  source: string;
  mode: ResolverMode;
}

async function fromCoinGecko(sym: string): Promise<Partial<ResolvedQuote> | null> {
  const map: Record<string, string> = {
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
    return { price: Number(md.current_price.usd), changePct: Number(md.price_change_percentage_24h ?? 0), source: "CoinGecko", mode: "live" };
  } catch { return null; }
}

async function fromBinance(sym: string): Promise<Partial<ResolvedQuote> | null> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym.toUpperCase()}USDT`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.lastPrice);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, changePct: Number(j.priceChangePercent ?? 0), source: "Binance", mode: "live" };
  } catch { return null; }
}

async function fromFinnhub(sym: string): Promise<Partial<ResolvedQuote> | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.c);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, changePct: Number(j.dp ?? 0), source: "Finnhub", mode: "live" };
  } catch { return null; }
}

async function fromTwelveData(sym: string): Promise<Partial<ResolvedQuote> | null> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${key}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = Number(j.close ?? j.price);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, changePct: Number(j.percent_change ?? 0), source: "TwelveData", mode: "delayed" };
  } catch { return null; }
}

async function fromAlphaVantage(sym: string): Promise<Partial<ResolvedQuote> | null> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${key}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const q = j["Global Quote"] || {};
    const p = Number(q["05. price"]);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, changePct: Number(String(q["10. change percent"] ?? "0").replace("%","")), source: "AlphaVantage", mode: "delayed" };
  } catch { return null; }
}

export async function resolveQuote(category: ResolverCategory, symbol: string): Promise<ResolvedQuote> {
  const S = symbol.toUpperCase();
  let q: Partial<ResolvedQuote> | null = null;
  if (category === "crypto") {
    q = (await fromCoinGecko(S)) || (await fromBinance(S));
  } else if (category === "us_stock" || category === "etf_bond") {
    q = (await fromFinnhub(S)) || (await fromTwelveData(S)) || (await fromAlphaVantage(S));
  } else if (category === "sa_stock") {
    q = (await fromTwelveData(S)) || (await fromAlphaVantage(S));
  } else if (category === "metal" || category === "commodity") {
    q = (await fromTwelveData(S)) || (await fromAlphaVantage(S)) || (await fromFinnhub(S));
  }
  return {
    price: Number(q?.price ?? 0),
    changePct: Number(q?.changePct ?? 0),
    source: String(q?.source ?? "unavailable"),
    mode: (q?.mode as ResolverMode) ?? "mock",
  };
}

const ASSET_TYPE_MAP: Record<string, ResolverCategory> = {
  US_STOCK: "us_stock",
  SAUDI_STOCK: "sa_stock",
  CRYPTO: "crypto",
  METAL: "metal",
  COMMODITY: "commodity",
  BOND: "etf_bond",
  ETF: "etf_bond",
};

export function assetTypeToCategory(assetType: string): ResolverCategory | null {
  return ASSET_TYPE_MAP[assetType] ?? null;
}
