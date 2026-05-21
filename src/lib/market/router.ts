/**
 * Unified Market Router Engine (Phase 10).
 *
 * Server-only. Resolves an arbitrary symbol to an asset class, picks the
 * highest-priority healthy provider, and falls back through a chain when a
 * provider is rate-limited, cooled-down, or returns an error.
 *
 * Features:
 *   - Asset resolver (crypto, US stock, Saudi stock, metals, forex,
 *     commodities, ETFs, bonds).
 *   - Per-provider cooldown memory (30s normal error, 120s rate-limit).
 *   - In-memory TTL cache (crypto 15s, stocks 30s, macro 5m).
 *   - In-flight request dedup (same symbol = single upstream call).
 *   - EWMA latency + success-rate metrics, failover counter.
 *   - Stale-cache graceful degradation when every provider fails.
 *
 * LIVE_TRADING_ENABLED stays false — this layer is read-only quote routing.
 */

import { getQuote as fhQuote } from "@/services/providers/finnhub";
import { getQuote as tdQuote } from "@/services/providers/twelvedata";
import { getEquityQuote as avEquity, getFxRate as avFx } from "@/services/providers/alphavantage";
import { translateSymbol, type ProviderKey } from "@/lib/market/symbol-map";

// ---------- Public types ----------

export type AssetClass =
  | "crypto"
  | "us_stock"
  | "saudi_stock"
  | "metal"
  | "forex"
  | "commodity"
  | "etf"
  | "bond"
  | "unknown";

export type ProviderId =
  | "finnhub"
  | "twelvedata"
  | "alphavantage"
  | "alpaca"
  | "binance"
  | "coingecko";

export type ProviderMode = "live" | "delayed" | "cached" | "stale" | "synthetic";

export interface RouterQuote {
  success: boolean;
  provider: ProviderId | null;
  mode: ProviderMode;
  latency: number;          // ms for the upstream call (0 when served from cache)
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;        // ms — when the quote was produced upstream
  delayed: boolean;
  fallbackUsed: boolean;
  symbol: string;
  assetClass: AssetClass;
  /** When success=false: human-readable last error. */
  error?: string;
  /** Providers attempted in order, for observability. */
  attempted?: ProviderId[];
  /** Diagnostics: composite cache key, inflight dedup key, resolver trace, raw input. */
  cacheKey?: string;
  inflightKey?: string;
  resolverPath?: string;
  rawSymbol?: string;
  /** The provider-specific symbol string used for the successful (or last attempted) upstream call. */
  translatedSymbol?: string;
  /** Per-provider translations attempted, keyed by ProviderId. */
  translations?: Partial<Record<ProviderId, string>>;
}

// ---------- Asset resolver ----------

const METAL_SYMBOLS = new Set(["XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER", "PLATINUM", "PALLADIUM"]);
const COMMODITY_SYMBOLS = new Set(["WTI", "BRENT", "OIL", "NATGAS", "NG", "CL", "BZ", "COPPER", "HG"]);
const COMMON_ETFS = new Set([
  "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "VEA", "VWO", "AGG", "BND",
  "GLD", "SLV", "USO", "TLT", "XLK", "XLF", "XLE", "XLY", "XLV", "XLI",
  "ARKK", "EEM", "EFA",
]);
const BOND_PATTERNS = [/^US\d+Y$/i, /^DE\d+Y$/i, /^UK\d+Y$/i, /^TLT$/i, /^IEF$/i, /^SHY$/i];
const FOREX_RE = /^([A-Z]{3})[\/-]?([A-Z]{3})$/;
const CRYPTO_SUFFIX_RE = /^([A-Z0-9]{2,8})[-/](USDT?|BUSD|USDC|BTC|ETH)$/i;
const CRYPTO_PLAIN = new Set(["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "MATIC", "DOT", "LTC", "LINK", "ATOM", "TRX"]);

export interface ResolvedAsset {
  assetClass: AssetClass;
  /** Provider-friendly symbol (e.g. "BTCUSDT" for binance, "AAPL" for finnhub). */
  normalized: string;
  /** Forex helper. */
  forex?: { from: string; to: string };
  /** Pure trace of resolver branch taken, for diagnostics. */
  resolverPath: string;
  /** Original raw input, uppercased + trimmed. */
  raw: string;
}

export function resolveAsset(rawSymbol: string): ResolvedAsset {
  const raw = (rawSymbol ?? "").trim().toUpperCase();
  const make = (
    assetClass: AssetClass,
    normalized: string,
    resolverPath: string,
    extra: Partial<ResolvedAsset> = {},
  ): ResolvedAsset => ({ assetClass, normalized, resolverPath, raw, ...extra });

  if (!raw) return make("unknown", "", "empty");

  // Saudi: .SR suffix or :TADAWUL — keep numeric tickers intact (e.g. "2222.SR")
  if (/\.SR$/.test(raw) || /:TADAWUL$/.test(raw)) {
    return make("saudi_stock", raw.replace(/:TADAWUL$/, ".SR"), "saudi:.SR");
  }

  // Metals (XAU, XAUUSD, GOLD, ...) — keep raw for branching but tag class
  if (METAL_SYMBOLS.has(raw) || /^(XAU|XAG|XPT|XPD)/.test(raw)) {
    return make("metal", raw, "metal:prefix");
  }

  if (COMMODITY_SYMBOLS.has(raw)) return make("commodity", raw, "commodity:set");
  if (BOND_PATTERNS.some((re) => re.test(raw))) return make("bond", raw, "bond:pattern");
  if (COMMON_ETFS.has(raw)) return make("etf", raw, "etf:set");

  const cryptoMatch = raw.match(CRYPTO_SUFFIX_RE);
  if (cryptoMatch) {
    const [, base, quote] = cryptoMatch;
    return make("crypto", `${base}${quote}`, "crypto:suffix");
  }
  if (CRYPTO_PLAIN.has(raw)) return make("crypto", `${raw}USDT`, "crypto:plain");

  const fx = raw.match(FOREX_RE);
  if (fx) {
    const [, from, to] = fx;
    const FIATS = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "CNY", "SAR", "AED", "TRY"]);
    if (FIATS.has(from) && FIATS.has(to)) {
      return make("forex", `${from}${to}`, "forex:pair", { forex: { from, to } });
    }
  }

  if (/^[A-Z]{1,5}$/.test(raw)) return make("us_stock", raw, "us:alpha");
  return make("unknown", raw, "fallback");
}

// ---------- Provider priority chains ----------

const CHAINS: Record<AssetClass, ProviderId[]> = {
  us_stock:    ["finnhub", "alpaca", "twelvedata", "alphavantage"],
  saudi_stock: ["twelvedata", "alphavantage"],
  crypto:      ["binance", "coingecko", "twelvedata"],
  metal:       ["twelvedata", "alphavantage", "finnhub"],
  commodity:   ["twelvedata", "alphavantage", "finnhub"],
  etf:         ["finnhub", "twelvedata", "alphavantage"],
  bond:        ["twelvedata", "alphavantage"],
  forex:       ["twelvedata", "alphavantage", "finnhub"],
  unknown:     ["finnhub", "twelvedata", "alphavantage"],
};

// ---------- Cooldown memory ----------

type CooldownReason = "error" | "rate_limited";
interface Cooldown { until: number; reason: CooldownReason; lastError: string }
const COOLDOWN = new Map<ProviderId, Cooldown>();
const COOLDOWN_MS = { error: 30_000, rate_limited: 120_000 } as const;

function isCoolingDown(p: ProviderId, now = Date.now()): boolean {
  const c = COOLDOWN.get(p);
  if (!c) return false;
  if (c.until <= now) { COOLDOWN.delete(p); return false; }
  return true;
}

function setCooldown(p: ProviderId, reason: CooldownReason, lastError: string) {
  COOLDOWN.set(p, { until: Date.now() + COOLDOWN_MS[reason], reason, lastError });
}

// ---------- Metrics ----------

interface Metric {
  attempts: number;
  successes: number;
  errors: number;
  rateLimits: number;
  failovers: number;
  ewmaLatencyMs: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
}
const METRICS = new Map<ProviderId, Metric>();
const ALPHA = 0.25;

function metric(p: ProviderId): Metric {
  let m = METRICS.get(p);
  if (!m) {
    m = { attempts: 0, successes: 0, errors: 0, rateLimits: 0, failovers: 0,
          ewmaLatencyMs: 0, lastSuccessAt: null, lastErrorAt: null, lastError: null };
    METRICS.set(p, m);
  }
  return m;
}

function recordSuccess(p: ProviderId, latency: number) {
  const m = metric(p);
  m.attempts++;
  m.successes++;
  m.ewmaLatencyMs = m.ewmaLatencyMs === 0 ? latency : (ALPHA * latency + (1 - ALPHA) * m.ewmaLatencyMs);
  m.lastSuccessAt = Date.now();
}

function recordError(p: ProviderId, err: string, rateLimited: boolean) {
  const m = metric(p);
  m.attempts++;
  m.errors++;
  if (rateLimited) m.rateLimits++;
  m.lastErrorAt = Date.now();
  m.lastError = err;
}

function recordFailover(p: ProviderId) { metric(p).failovers++; }

export function getRouterMetrics() {
  const out: Record<string, Metric & { successRate: number; coolingDown: boolean }> = {};
  for (const [id, m] of METRICS) {
    out[id] = {
      ...m,
      successRate: m.attempts === 0 ? 1 : m.successes / m.attempts,
      coolingDown: isCoolingDown(id),
    };
  }
  return out;
}

// ---------- Cache + dedup ----------

interface CacheEntry { quote: RouterQuote; expiresAt: number }
const CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<RouterQuote>>();

const TTL_MS: Record<AssetClass, number> = {
  crypto: 15_000,
  us_stock: 30_000,
  saudi_stock: 30_000,
  etf: 30_000,
  metal: 5 * 60_000,
  commodity: 5 * 60_000,
  forex: 5 * 60_000,
  bond: 5 * 60_000,
  unknown: 30_000,
};

/**
 * Composite cache key. Includes asset class, normalized symbol AND the original
 * raw input so that two different inputs (e.g. "BTC" vs "BTCUSDT" vs "2222.SR")
 * can never collide — even if normalization were to converge.
 */
function buildCacheKey(asset: ResolvedAsset, interval?: string): string {
  const i = interval ? `@${interval}` : "";
  return `${asset.assetClass}::${asset.normalized}::${asset.raw}${i}`;
}
function buildInflightKey(asset: ResolvedAsset, interval?: string): string {
  // Distinct from cache key so cache reads never accidentally key into dedup table.
  return `inflight::${buildCacheKey(asset, interval)}`;
}

function fromCache(key: string, now = Date.now()): RouterQuote | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (hit.expiresAt > now) {
    return { ...hit.quote, mode: "cached", latency: 0, fallbackUsed: hit.quote.fallbackUsed };
  }
  return null;
}

function staleCache(key: string): RouterQuote | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  return { ...hit.quote, mode: "stale", latency: 0, success: true };
}

// ---------- Provider runners ----------

interface UpstreamResult {
  price: number;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  delayed: boolean;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function runFinnhub(asset: ResolvedAsset): Promise<UpstreamResult> {
  const q = await fhQuote(asset.normalized);
  if (!q || !Number.isFinite(q.c) || q.c <= 0) throw new Error("finnhub: empty quote");
  return {
    price: q.c,
    changePercent: q.dp ?? null,
    volume: null,
    timestamp: (q.t ?? 0) * 1000 || Date.now(),
    delayed: false,
  };
}

async function runTwelveData(asset: ResolvedAsset): Promise<UpstreamResult> {
  const mapped = mapForProvider(asset.raw, "twelvedata");
  const q = await tdQuote(mapped);
  const price = num(q.close);
  if (price == null) throw new Error("twelvedata: empty quote");
  return {
    price,
    changePercent: num(q.percent_change),
    volume: num(q.volume),
    timestamp: q.timestamp ? q.timestamp * 1000 : Date.now(),
    delayed: q.is_market_open === false,
  };
}

async function runAlphaVantage(asset: ResolvedAsset): Promise<UpstreamResult> {
  if (asset.assetClass === "forex" && asset.forex) {
    const r = await avFx(asset.forex.from, asset.forex.to);
    const rate = num(r["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]);
    if (rate == null) throw new Error("alphavantage: empty fx");
    return { price: rate, changePercent: null, volume: null, timestamp: Date.now(), delayed: true };
  }
  const r = await avEquity(asset.normalized);
  const g = r["Global Quote"];
  const price = num(g?.["05. price"]);
  if (price == null) throw new Error("alphavantage: empty quote");
  const pctRaw = g?.["10. change percent"]?.replace("%", "");
  return {
    price,
    changePercent: num(pctRaw),
    volume: num(g?.["06. volume"]),
    timestamp: Date.now(),
    delayed: true,
  };
}

async function runBinance(asset: ResolvedAsset): Promise<UpstreamResult> {
  const sym = asset.normalized.endsWith("USDT") ? asset.normalized : `${asset.normalized}USDT`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { signal: ctrl.signal });
    if (res.status === 429) throw Object.assign(new Error("binance: rate limit"), { rateLimited: true });
    if (!res.ok) throw new Error(`binance: HTTP ${res.status}`);
    const j = await res.json() as { lastPrice?: string; priceChangePercent?: string; volume?: string; closeTime?: number };
    const price = num(j.lastPrice);
    if (price == null) throw new Error("binance: empty quote");
    return {
      price,
      changePercent: num(j.priceChangePercent),
      volume: num(j.volume),
      timestamp: j.closeTime ?? Date.now(),
      delayed: false,
    };
  } finally {
    clearTimeout(t);
  }
}

async function runCoinGecko(asset: ResolvedAsset): Promise<UpstreamResult> {
  const base = asset.normalized.replace(/USDT?|USDC|BUSD$/i, "").toLowerCase();
  const map: Record<string, string> = {
    btc: "bitcoin", eth: "ethereum", sol: "solana", bnb: "binancecoin",
    xrp: "ripple", ada: "cardano", doge: "dogecoin", avax: "avalanche-2",
    matic: "matic-network", dot: "polkadot", ltc: "litecoin", link: "chainlink",
  };
  const id = map[base];
  if (!id) throw new Error(`coingecko: unsupported ${base}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { signal: ctrl.signal },
    );
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    if (res.status === 429 || /rate.?limit/i.test(text)) {
      throw Object.assign(new Error("coingecko: rate limit"), { rateLimited: true });
    }
    if (!res.ok || (!ctype.includes("application/json") && !text.trim().startsWith("{"))) {
      throw new Error(`coingecko: HTTP ${res.status}`);
    }
    const j = JSON.parse(text) as Record<string, { usd: number; usd_24h_change?: number; usd_24h_vol?: number }>;
    const row = j[id];
    if (!row) throw new Error("coingecko: empty quote");
    return {
      price: row.usd,
      changePercent: row.usd_24h_change ?? null,
      volume: row.usd_24h_vol ?? null,
      timestamp: Date.now(),
      delayed: false,
    };
  } finally {
    clearTimeout(t);
  }
}

async function runAlpaca(_asset: ResolvedAsset): Promise<UpstreamResult> {
  // Alpaca quote pipeline is not wired into the router yet; declared in the
  // chain so the priority order is honoured the moment we add it. For now we
  // throw and the router transparently falls through to the next provider.
  throw new Error("alpaca: not implemented");
}

const RUNNERS: Record<ProviderId, (a: ResolvedAsset) => Promise<UpstreamResult>> = {
  finnhub: runFinnhub,
  twelvedata: runTwelveData,
  alphavantage: runAlphaVantage,
  binance: runBinance,
  coingecko: runCoinGecko,
  alpaca: runAlpaca,
};

// ---------- Core router ----------

function detectRateLimit(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null && (err as { rateLimited?: boolean }).rateLimited) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|throttl|too many requests/i.test(msg);
}

export interface RouterOptions {
  /** Bypass cache and force a fresh fetch. */
  force?: boolean;
}

export async function routeQuote(rawSymbol: string, opts: RouterOptions = {}): Promise<RouterQuote> {
  const asset = resolveAsset(rawSymbol);
  const cKey = buildCacheKey(asset);
  const iKey = buildInflightKey(asset);

  const stamp = <T extends RouterQuote>(q: T): T => ({
    ...q,
    cacheKey: cKey,
    inflightKey: iKey,
    resolverPath: asset.resolverPath,
    rawSymbol: asset.raw,
  });

  // Cache hit
  if (!opts.force) {
    const cached = fromCache(cKey);
    if (cached) return stamp(cached);
  }

  // Dedup: piggyback on any in-flight request for the SAME symbol only
  const existing = INFLIGHT.get(iKey);
  if (existing) return existing;

  const promise = (async (): Promise<RouterQuote> => {
    const chain = CHAINS[asset.assetClass] ?? CHAINS.unknown;
    const attempted: ProviderId[] = [];
    let fallbackUsed = false;
    let lastError = "no provider available";

    for (let i = 0; i < chain.length; i++) {
      const p = chain[i];
      if (isCoolingDown(p)) { attempted.push(p); continue; }
      attempted.push(p);
      const runner = RUNNERS[p];
      if (!runner) continue;
      const start = Date.now();
      try {
        const r = await runner(asset);
        const latency = Date.now() - start;
        recordSuccess(p, latency);
        if (i > 0) { fallbackUsed = true; recordFailover(p); }
        const quote: RouterQuote = stamp({
          success: true,
          provider: p,
          mode: r.delayed ? "delayed" : "live",
          latency,
          price: r.price,
          changePercent: r.changePercent,
          volume: r.volume,
          timestamp: r.timestamp,
          delayed: r.delayed,
          fallbackUsed,
          symbol: asset.normalized,
          assetClass: asset.assetClass,
          attempted,
        });
        const ttl = TTL_MS[asset.assetClass];
        CACHE.set(cKey, { quote, expiresAt: Date.now() + ttl });
        return quote;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const rl = detectRateLimit(e);
        recordError(p, msg, rl);
        setCooldown(p, rl ? "rate_limited" : "error", msg);
        lastError = msg;
      }
    }

    const stale = staleCache(cKey);
    if (stale) return stamp({ ...stale, fallbackUsed: true, error: lastError, attempted });
    return stamp({
      success: false,
      provider: null,
      mode: "synthetic",
      latency: 0,
      price: null,
      changePercent: null,
      volume: null,
      timestamp: Date.now(),
      delayed: true,
      fallbackUsed: true,
      symbol: asset.normalized,
      assetClass: asset.assetClass,
      error: lastError,
      attempted,
    });
  })();

  INFLIGHT.set(iKey, promise);
  try {
    return await promise;
  } finally {
    INFLIGHT.delete(iKey);
  }
}

/** Diagnostic helper — used by /api/router-test and admin panels. */
export function getRouterDiagnostics() {
  const cooldowns: Record<string, { until: number; reason: string; lastError: string }> = {};
  for (const [k, v] of COOLDOWN) cooldowns[k] = v;
  return {
    metrics: getRouterMetrics(),
    cooldowns,
    cacheSize: CACHE.size,
    inflight: INFLIGHT.size,
    liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === "true",
  };
}
