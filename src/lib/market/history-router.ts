/**
 * Historical Market Archive Engine (Phase 11) — server-only.
 *
 * Routes a (symbol, range, interval) request through provider chains per
 * asset class, with memory cache + Supabase persistent cache. Returns a
 * unified candle schema.
 *
 * Provider chains:
 *   US stocks / ETFs / Bonds : TwelveData -> AlphaVantage -> Finnhub
 *   Crypto                   : CoinGecko  -> Binance
 *   Saudi                    : TwelveData -> (none)
 *   Metals / Commodities / FX: TwelveData -> AlphaVantage
 *
 * NEVER imported by client code. Reads API keys from process.env only.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAsset, type AssetClass, type ProviderId } from "@/lib/market/router";

// ---------- Public types ----------

export type Range = "24h" | "7d" | "30d" | "90d" | "1y" | "3y";
export type Interval = "1m" | "5m" | "15m" | "1h" | "1d";
export type DataMode = "live" | "cached" | "stale" | "mock";

export interface Candle {
  symbol: string;
  assetClass: AssetClass;
  provider: ProviderId | "archive";
  mode: DataMode;
  interval: Interval;
  timestamp: number; // ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface HistoryResult {
  success: boolean;
  symbol: string;
  assetClass: AssetClass;
  provider: ProviderId | "archive" | null;
  mode: DataMode;
  interval: Interval;
  range: Range;
  candles: Candle[];
  attempted: ProviderId[];
  fallbackUsed: boolean;
  coverage: {
    count: number;
    firstAt: number | null;
    lastAt: number | null;
  };
  error?: string;
  supported: boolean;
}

// ---------- Provider routing tables ----------

const CHAINS: Record<AssetClass, ProviderId[]> = {
  us_stock:    ["twelvedata", "alphavantage", "finnhub"],
  etf:         ["twelvedata", "alphavantage", "finnhub"],
  bond:        ["twelvedata", "alphavantage", "finnhub"],
  saudi_stock: ["twelvedata"],
  crypto:      ["coingecko", "binance"],
  metal:       ["twelvedata", "alphavantage"],
  commodity:   ["twelvedata", "alphavantage"],
  forex:       ["twelvedata", "alphavantage"],
  unknown:     ["twelvedata", "alphavantage"],
};

// ---------- Memory cache ----------

interface CacheEntry { ts: number; ttl: number; data: HistoryResult }
const MEM = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<HistoryResult>>();

function cacheKey(symbol: string, range: Range, interval: Interval) {
  return `hist:${symbol}:${range}:${interval}`;
}

function ttlFor(range: Range, interval: Interval): number {
  if (interval === "1m" || interval === "5m") return 60_000;
  if (interval === "15m" || interval === "1h") return 5 * 60_000;
  if (range === "24h" || range === "7d") return 10 * 60_000;
  return 60 * 60_000;
}

// ---------- Cooldown (per provider) ----------

const COOLDOWN = new Map<ProviderId, number>();
function coolDown(p: ProviderId, ms = 60_000) { COOLDOWN.set(p, Date.now() + ms); }
function isCool(p: ProviderId) { const t = COOLDOWN.get(p); return !!t && t > Date.now(); }

// ---------- Provider call logging ----------

export interface ProviderCallLog {
  provider: ProviderId;
  symbol: string;
  range: Range;
  interval: Interval;
  latencyMs: number;
  success: boolean;
  fallbackUsed: boolean;
  error?: string;
  at: number;
}
const CALL_LOG: ProviderCallLog[] = [];
const CALL_LOG_MAX = 200;
function log(entry: ProviderCallLog) {
  CALL_LOG.unshift(entry);
  if (CALL_LOG.length > CALL_LOG_MAX) CALL_LOG.length = CALL_LOG_MAX;
}
export function recentHistoryCalls(): ProviderCallLog[] { return CALL_LOG.slice(); }

// ---------- Range / interval helpers ----------

function rangeToMs(r: Range): number {
  switch (r) {
    case "24h": return 24 * 3600_000;
    case "7d":  return 7 * 86400_000;
    case "30d": return 30 * 86400_000;
    case "90d": return 90 * 86400_000;
    case "1y":  return 365 * 86400_000;
    case "3y":  return 3 * 365 * 86400_000;
  }
}

function tdInterval(i: Interval): string {
  return { "1m":"1min","5m":"5min","15m":"15min","1h":"1h","1d":"1day" }[i];
}

function avInterval(i: Interval): { fn: string; interval?: string } {
  if (i === "1d") return { fn: "TIME_SERIES_DAILY" };
  return { fn: "TIME_SERIES_INTRADAY", interval: { "1m":"1min","5m":"5min","15m":"15min","1h":"60min" }[i] };
}

function binanceInterval(i: Interval): string {
  return { "1m":"1m","5m":"5m","15m":"15m","1h":"1h","1d":"1d" }[i];
}

function coingeckoDays(range: Range): string {
  return { "24h":"1","7d":"7","30d":"30","90d":"90","1y":"365","3y":"max" }[range];
}

function rangeOutputSize(range: Range, interval: Interval): number {
  const totalMs = rangeToMs(range);
  const stepMs = { "1m":60_000, "5m":300_000, "15m":900_000, "1h":3600_000, "1d":86400_000 }[interval];
  return Math.min(5000, Math.max(50, Math.ceil(totalMs / stepMs)));
}

// ---------- Provider adapters ----------

async function fetchTwelveData(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("missing_key");
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", tdInterval(interval));
  url.searchParams.set("outputsize", String(rangeOutputSize(range, interval)));
  url.searchParams.set("apikey", key);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`twelvedata_http_${r.status}`);
  const j = await r.json() as { status?: string; code?: number; message?: string; values?: Array<{datetime: string; open: string; high: string; low: string; close: string; volume?: string}> };
  if (j.status === "error" || j.code) throw new Error(j.message || "twelvedata_error");
  return (j.values ?? []).map((v) => ({
    symbol, assetClass: "unknown" as AssetClass, provider: "twelvedata" as const,
    mode: "live" as DataMode, interval,
    timestamp: new Date(v.datetime.replace(" ", "T") + "Z").getTime(),
    open: +v.open, high: +v.high, low: +v.low, close: +v.close,
    volume: v.volume ? +v.volume : null,
  })).reverse();
}

async function fetchAlphaVantage(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) throw new Error("missing_key");
  const { fn, interval: avI } = avInterval(interval);
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", fn);
  url.searchParams.set("symbol", symbol);
  if (avI) url.searchParams.set("interval", avI);
  url.searchParams.set("outputsize", "full");
  url.searchParams.set("apikey", key);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`alphavantage_http_${r.status}`);
  const j = await r.json() as Record<string, unknown>;
  if ((j as any).Note || (j as any).Information) throw new Error("alphavantage_rate_limited");
  const seriesKey = Object.keys(j).find((k) => k.toLowerCase().includes("time series")) as string | undefined;
  if (!seriesKey) throw new Error("alphavantage_no_series");
  const series = j[seriesKey] as Record<string, Record<string, string>>;
  const cutoff = Date.now() - rangeToMs(range);
  const out: Candle[] = [];
  for (const [t, v] of Object.entries(series)) {
    const ts = new Date(t.replace(" ", "T") + "Z").getTime();
    if (ts < cutoff) continue;
    out.push({
      symbol, assetClass: "unknown", provider: "alphavantage", mode: "live", interval,
      timestamp: ts,
      open: +v["1. open"], high: +v["2. high"], low: +v["3. low"], close: +v["4. close"],
      volume: v["5. volume"] ? +v["5. volume"] : null,
    });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchFinnhub(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("missing_key");
  const res = { "1m":"1","5m":"5","15m":"15","1h":"60","1d":"D" }[interval];
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.floor(rangeToMs(range) / 1000);
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${res}&from=${from}&to=${to}&token=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`finnhub_http_${r.status}`);
  const j = await r.json() as { s: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] };
  if (j.s !== "ok" || !j.t) throw new Error("finnhub_no_data");
  return j.t.map((ts, i) => ({
    symbol, assetClass: "unknown" as AssetClass, provider: "finnhub" as const,
    mode: "live" as DataMode, interval,
    timestamp: ts * 1000,
    open: j.o![i], high: j.h![i], low: j.l![i], close: j.c![i],
    volume: j.v ? j.v[i] : null,
  }));
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", BTCUSDT: "bitcoin", ETH: "ethereum", ETHUSDT: "ethereum",
  SOL: "solana", SOLUSDT: "solana", BNB: "binancecoin", BNBUSDT: "binancecoin",
  XRP: "ripple", XRPUSDT: "ripple", ADA: "cardano", ADAUSDT: "cardano",
  DOGE: "dogecoin", DOGEUSDT: "dogecoin", AVAX: "avalanche-2", AVAXUSDT: "avalanche-2",
  MATIC: "matic-network", MATICUSDT: "matic-network", DOT: "polkadot", DOTUSDT: "polkadot",
  LTC: "litecoin", LTCUSDT: "litecoin", LINK: "chainlink", LINKUSDT: "chainlink",
};

async function fetchCoinGecko(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
  const id = COINGECKO_IDS[symbol.toUpperCase()] ?? COINGECKO_IDS[symbol.replace(/USDT?$/, "").toUpperCase()];
  if (!id) throw new Error("coingecko_unknown_symbol");
  const days = coingeckoDays(range);
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`;
  const r = await fetch(url);
  if (r.status === 429) throw new Error("coingecko_rate_limited");
  if (!r.ok) throw new Error(`coingecko_http_${r.status}`);
  const arr = await r.json() as Array<[number, number, number, number, number]>;
  return arr.map(([t, o, h, l, c]) => ({
    symbol, assetClass: "crypto" as AssetClass, provider: "coingecko" as const,
    mode: "live" as DataMode, interval,
    timestamp: t, open: o, high: h, low: l, close: c, volume: null,
  }));
}

async function fetchBinance(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
  const sym = /USDT?$/i.test(symbol) ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const limit = rangeOutputSize(range, interval);
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${binanceInterval(interval)}&limit=${Math.min(1000, limit)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`binance_http_${r.status}`);
  const arr = await r.json() as Array<[number, string, string, string, string, string, ...unknown[]]>;
  return arr.map(([t, o, h, l, c, v]) => ({
    symbol, assetClass: "crypto" as AssetClass, provider: "binance" as const,
    mode: "live" as DataMode, interval,
    timestamp: t, open: +o, high: +h, low: +l, close: +c, volume: +v,
  }));
}

const PROVIDERS: Record<ProviderId, undefined | ((s: string, r: Range, i: Interval) => Promise<Candle[]>)> = {
  twelvedata: fetchTwelveData,
  alphavantage: fetchAlphaVantage,
  finnhub: fetchFinnhub,
  coingecko: fetchCoinGecko,
  binance: fetchBinance,
  alpaca: undefined,
};

// ---------- Supabase persistent cache ----------

async function loadFromDb(symbol: string, assetClass: AssetClass, interval: Interval, range: Range): Promise<Candle[]> {
  const since = new Date(Date.now() - rangeToMs(range)).toISOString();
  const { data, error } = await supabaseAdmin
    .from("market_price_candles")
    .select("symbol,asset_class,provider,interval,timestamp,open,high,low,close,volume,data_mode")
    .eq("symbol", symbol).eq("asset_class", assetClass).eq("interval", interval)
    .gte("timestamp", since).order("timestamp", { ascending: true }).limit(5000);
  if (error || !data) return [];
  return data.map((d) => ({
    symbol: d.symbol, assetClass: d.asset_class as AssetClass,
    provider: d.provider as ProviderId, mode: (d.data_mode as DataMode) || "cached",
    interval: d.interval as Interval, timestamp: new Date(d.timestamp).getTime(),
    open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close),
    volume: d.volume === null ? null : Number(d.volume),
  }));
}

async function saveToDb(candles: Candle[]) {
  if (!candles.length) return;
  const rows = candles.map((c) => ({
    symbol: c.symbol, asset_class: c.assetClass,
    provider: c.provider === "archive" ? "cache" : c.provider,
    interval: c.interval, timestamp: new Date(c.timestamp).toISOString(),
    open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
    data_mode: c.mode,
  }));
  await supabaseAdmin.from("market_price_candles").upsert(rows, { onConflict: "symbol,asset_class,interval,timestamp" });
}

// ---------- Public API ----------

export async function getHistoricalCandles(symbolRaw: string, range: Range, interval: Interval): Promise<HistoryResult> {
  const symbol = symbolRaw.trim().toUpperCase();
  const key = cacheKey(symbol, range, interval);
  const now = Date.now();
  const hit = MEM.get(key);
  if (hit && now - hit.ts < hit.ttl) return hit.data;
  if (INFLIGHT.has(key)) return INFLIGHT.get(key)!;
  const p = (async () => {
    const result = await routeAndFetch(symbol, range, interval);
    MEM.set(key, { ts: Date.now(), ttl: ttlFor(range, interval), data: result });
    INFLIGHT.delete(key);
    return result;
  })();
  INFLIGHT.set(key, p);
  return p;
}

export async function refreshHistoricalCandles(symbol: string, range: Range, interval: Interval): Promise<HistoryResult> {
  MEM.delete(cacheKey(symbol.toUpperCase(), range, interval));
  return getHistoricalCandles(symbol, range, interval);
}

export async function getArchiveCoverage(symbolRaw: string): Promise<Array<{ interval: Interval; count: number; firstAt: number | null; lastAt: number | null }>> {
  const symbol = symbolRaw.trim().toUpperCase();
  const intervals: Interval[] = ["1m", "5m", "15m", "1h", "1d"];
  const out: Array<{ interval: Interval; count: number; firstAt: number | null; lastAt: number | null }> = [];
  for (const iv of intervals) {
    const { data, error } = await supabaseAdmin
      .from("market_price_candles")
      .select("timestamp", { count: "exact" })
      .eq("symbol", symbol).eq("interval", iv)
      .order("timestamp", { ascending: true }).limit(1);
    if (error) { out.push({ interval: iv, count: 0, firstAt: null, lastAt: null }); continue; }
    const firstAt = data?.[0]?.timestamp ? new Date(data[0].timestamp).getTime() : null;
    const { data: last } = await supabaseAdmin
      .from("market_price_candles")
      .select("timestamp").eq("symbol", symbol).eq("interval", iv)
      .order("timestamp", { ascending: false }).limit(1);
    const { count } = await supabaseAdmin.from("market_price_candles")
      .select("id", { count: "exact", head: true }).eq("symbol", symbol).eq("interval", iv);
    out.push({
      interval: iv, count: count ?? 0, firstAt,
      lastAt: last?.[0]?.timestamp ? new Date(last[0].timestamp).getTime() : null,
    });
  }
  return out;
}

async function routeAndFetch(symbol: string, range: Range, interval: Interval): Promise<HistoryResult> {
  const resolved = resolveAsset(symbol);
  const assetClass = resolved.assetClass;
  const chain = CHAINS[assetClass];
  const attempted: ProviderId[] = [];
  let lastError: string | undefined;
  let fallbackUsed = false;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const fn = PROVIDERS[provider];
    if (!fn) continue;
    if (isCool(provider)) { lastError = `${provider}_cooling`; continue; }
    attempted.push(provider);
    const t0 = Date.now();
    try {
      const candles = await fn(resolved.normalized, range, interval);
      const latency = Date.now() - t0;
      if (i > 0) fallbackUsed = true;
      log({ provider, symbol, range, interval, latencyMs: latency, success: true, fallbackUsed, at: Date.now() });
      const stamped = candles.map((c) => ({ ...c, assetClass, symbol, provider, mode: "live" as DataMode }));
      // Persist asynchronously — don't block response on cache write
      saveToDb(stamped).catch(() => {});
      return {
        success: true, symbol, assetClass, provider, mode: "live", interval, range,
        candles: stamped, attempted, fallbackUsed, supported: true,
        coverage: { count: stamped.length, firstAt: stamped[0]?.timestamp ?? null, lastAt: stamped[stamped.length-1]?.timestamp ?? null },
      };
    } catch (err) {
      const latency = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      const isRate = /rate|429|limit/i.test(msg);
      coolDown(provider, isRate ? 120_000 : 30_000);
      log({ provider, symbol, range, interval, latencyMs: latency, success: false, fallbackUsed: i > 0, error: msg, at: Date.now() });
    }
  }

  // Fall back to Supabase archive
  const archived = await loadFromDb(symbol, assetClass, interval, range);
  if (archived.length) {
    return {
      success: true, symbol, assetClass, provider: "archive", mode: "stale", interval, range,
      candles: archived, attempted, fallbackUsed: true, supported: true,
      coverage: { count: archived.length, firstAt: archived[0].timestamp, lastAt: archived[archived.length-1].timestamp },
      error: lastError,
    };
  }

  return {
    success: false, symbol, assetClass, provider: null, mode: "mock", interval, range,
    candles: [], attempted, fallbackUsed,
    supported: chain.some((p) => !!PROVIDERS[p]),
    coverage: { count: 0, firstAt: null, lastAt: null },
    error: lastError ?? "no_provider_available",
  };
}
