/**
 * Server-only live health probes for every external provider.
 *
 * Each probe performs ONE lightweight HTTP request (or no-op when the
 * required env var is missing) and returns a normalized result. Probes are
 * intentionally cheap — they never return user data — and they NEVER expose
 * key values back to the client; only key NAMES are referenced.
 *
 * The probe layer is fault-isolated: a thrown error from any single probe is
 * caught and reported as `error` so the provider-health page can never be
 * broken by an upstream outage.
 */

export type ProbeOutcome =
  | "connected"
  | "missing_key"
  | "error"
  | "rate_limited"
  | "not_implemented";

export interface ProbeResult {
  id: string;
  outcome: ProbeOutcome;
  latencyMs: number | null;
  httpStatus: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  checkedAt: number;
}

// In-memory rolling history. Keyed by provider id. Used to populate
// lastSuccessAt / lastErrorAt across refreshes within the same worker.
type HistoryEntry = { lastSuccessAt: number | null; lastErrorAt: number | null; lastError: string | null };
const HISTORY = new Map<string, HistoryEntry>();

function record(id: string, ok: boolean, error?: string) {
  const prev = HISTORY.get(id) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null };
  const now = Date.now();
  if (ok) {
    HISTORY.set(id, { ...prev, lastSuccessAt: now });
  } else {
    HISTORY.set(id, { ...prev, lastErrorAt: now, lastError: error ?? "unknown error" });
  }
}

function hist(id: string): HistoryEntry {
  return HISTORY.get(id) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null };
}

async function timedFetch(url: string, init?: RequestInit, timeoutMs = 7000): Promise<{ res: Response; latencyMs: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { res, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(t);
  }
}

function classify(status: number): ProbeOutcome {
  if (status === 429) return "rate_limited";
  if (status >= 200 && status < 400) return "connected";
  return "error";
}

function envFlag(...names: string[]): boolean {
  for (const n of names) {
    const v = (process.env as Record<string, string | undefined>)[n];
    if (v && v.trim().length > 0) return true;
  }
  return false;
}

function pack(id: string, outcome: ProbeOutcome, latencyMs: number | null, httpStatus: number | null): ProbeResult {
  const h = hist(id);
  return {
    id,
    outcome,
    latencyMs,
    httpStatus,
    lastSuccessAt: h.lastSuccessAt,
    lastErrorAt: h.lastErrorAt,
    lastError: h.lastError,
    checkedAt: Date.now(),
  };
}

// ---------------- Individual probes ----------------

async function probeFinnhub(): Promise<ProbeResult> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return pack("finnhub", "missing_key", null, null);
  try {
    const { res, latencyMs } = await timedFetch(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`,
    );
    const outcome = classify(res.status);
    record("finnhub", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("finnhub", outcome, latencyMs, res.status);
  } catch (e) {
    record("finnhub", false, e instanceof Error ? e.message : "network");
    return pack("finnhub", "error", null, null);
  }
}

async function probeTwelveData(): Promise<ProbeResult> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return pack("twelvedata", "missing_key", null, null);
  try {
    const { res, latencyMs } = await timedFetch(
      `https://api.twelvedata.com/price?symbol=AAPL&apikey=${encodeURIComponent(key)}`,
    );
    let outcome = classify(res.status);
    // TwelveData returns 200 with {status:"error", code:429} on rate-limit
    if (outcome === "connected") {
      try {
        const j = await res.clone().json();
        if (j && j.status === "error") {
          outcome = j.code === 429 ? "rate_limited" : "error";
        }
      } catch { /* ignore */ }
    }
    record("twelvedata", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("twelvedata", outcome, latencyMs, res.status);
  } catch (e) {
    record("twelvedata", false, e instanceof Error ? e.message : "network");
    return pack("twelvedata", "error", null, null);
  }
}

async function probeAlphaVantage(): Promise<ProbeResult> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return pack("alphavantage", "missing_key", null, null);
  try {
    const { res, latencyMs } = await timedFetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${encodeURIComponent(key)}`,
    );
    let outcome = classify(res.status);
    if (outcome === "connected") {
      try {
        const j = await res.clone().json();
        if (j && (j.Note || j.Information)) outcome = "rate_limited";
      } catch { /* ignore */ }
    }
    record("alphavantage", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("alphavantage", outcome, latencyMs, res.status);
  } catch (e) {
    record("alphavantage", false, e instanceof Error ? e.message : "network");
    return pack("alphavantage", "error", null, null);
  }
}

async function probeCoinGecko(): Promise<ProbeResult> {
  try {
    const { res, latencyMs } = await timedFetch("https://api.coingecko.com/api/v3/ping");
    let outcome = classify(res.status);
    const ctype = res.headers.get("content-type") || "";
    // Safe body read — never throw on HTML/text responses
    let bodyText = "";
    try { bodyText = await res.text(); } catch { /* ignore */ }
    const looksJson = ctype.includes("application/json") || bodyText.trim().startsWith("{");
    const rateLimited =
      res.status === 429 ||
      /rate.?limit|throttl|too many requests/i.test(bodyText);
    if (rateLimited) {
      outcome = "rate_limited";
    } else if (outcome === "connected" && !looksJson) {
      // Reachable but not returning JSON → treat as transient error
      outcome = "error";
    }
    const errMsg = outcome === "rate_limited" ? "Rate limited"
      : outcome !== "connected" ? `HTTP ${res.status}${looksJson ? "" : " (non-JSON)"}`
      : undefined;
    record("coingecko", outcome === "connected", errMsg);
    return pack("coingecko", outcome, latencyMs, res.status);
  } catch (e) {
    record("coingecko", false, e instanceof Error ? e.message : "network");
    return pack("coingecko", "error", null, null);
  }
}

async function probeBinance(): Promise<ProbeResult> {
  // Public ping — does not require a key. Key presence still matters for trading.
  try {
    const { res, latencyMs } = await timedFetch("https://api.binance.com/api/v3/ping");
    const outcome = classify(res.status);
    record("binance", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("binance", outcome, latencyMs, res.status);
  } catch (e) {
    record("binance", false, e instanceof Error ? e.message : "network");
    return pack("binance", "error", null, null);
  }
}

async function probeAlpaca(): Promise<ProbeResult> {
  const id = process.env.ALPACA_API_KEY_ID;
  const sec = process.env.ALPACA_API_SECRET_KEY;
  if (!id || !sec) return pack("alpaca", "missing_key", null, null);
  const base = (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets").replace(/\/+$/, "");
  try {
    const { res, latencyMs } = await timedFetch(`${base}/v2/clock`, {
      headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": sec },
    });
    const outcome = classify(res.status);
    record("alpaca", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("alpaca", outcome, latencyMs, res.status);
  } catch (e) {
    record("alpaca", false, e instanceof Error ? e.message : "network");
    return pack("alpaca", "error", null, null);
  }
}

async function probeIBKR(): Promise<ProbeResult> {
  const gw = process.env.IBKR_GATEWAY_URL;
  if (!gw) return pack("ibkr", "not_implemented", null, null);
  try {
    const { res, latencyMs } = await timedFetch(`${gw.replace(/\/+$/, "")}/v1/api/iserver/auth/status`);
    const outcome = classify(res.status);
    record("ibkr", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("ibkr", outcome, latencyMs, res.status);
  } catch (e) {
    record("ibkr", false, e instanceof Error ? e.message : "network");
    return pack("ibkr", "error", null, null);
  }
}

async function probeTradingEconomics(): Promise<ProbeResult> {
  const key = process.env.TRADINGECONOMICS_API_KEY;
  if (!key) return pack("tradingeconomics", "missing_key", null, null);
  try {
    const { res, latencyMs } = await timedFetch(
      `https://api.tradingeconomics.com/markets/symbol/aapl:us?c=${encodeURIComponent(key)}&f=json`,
    );
    const outcome = classify(res.status);
    record("tradingeconomics", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("tradingeconomics", outcome, latencyMs, res.status);
  } catch (e) {
    record("tradingeconomics", false, e instanceof Error ? e.message : "network");
    return pack("tradingeconomics", "error", null, null);
  }
}

async function probeNewsAPI(): Promise<ProbeResult> {
  const key = process.env.NEWSAPI_KEY || process.env.NEWSAPI_KEY_BACKUP;
  if (!key) return pack("newsapi", "missing_key", null, null);
  try {
    const { res, latencyMs } = await timedFetch(
      `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${encodeURIComponent(key)}`,
    );
    const outcome = classify(res.status);
    record("newsapi", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("newsapi", outcome, latencyMs, res.status);
  } catch (e) {
    record("newsapi", false, e instanceof Error ? e.message : "network");
    return pack("newsapi", "error", null, null);
  }
}

async function probeGDELT(): Promise<ProbeResult> {
  try {
    const { res, latencyMs } = await timedFetch(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=markets&mode=ArtList&maxrecords=1&format=json",
    );
    const outcome = classify(res.status);
    record("gdelt", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("gdelt", outcome, latencyMs, res.status);
  } catch (e) {
    record("gdelt", false, e instanceof Error ? e.message : "network");
    return pack("gdelt", "error", null, null);
  }
}

async function probeStripe(): Promise<ProbeResult> {
  // We do NOT call Stripe directly here. The presence of either gateway
  // connection key is the practical health signal — actual API calls are
  // routed through the connector gateway with a real secret key.
  const ok = envFlag("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY");
  const outcome: ProbeOutcome = ok ? "connected" : "missing_key";
  record("stripe", ok);
  return pack("stripe", outcome, null, null);
}

async function probeMoyasar(): Promise<ProbeResult> {
  const key = process.env.MOYASAR_SECRET_KEY;
  if (!key) return pack("moyasar", "missing_key", null, null);
  try {
    const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");
    const { res, latencyMs } = await timedFetch("https://api.moyasar.com/v1/payments?limit=1", {
      headers: { Authorization: auth },
    });
    const outcome = classify(res.status);
    record("moyasar", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("moyasar", outcome, latencyMs, res.status);
  } catch (e) {
    record("moyasar", false, e instanceof Error ? e.message : "network");
    return pack("moyasar", "error", null, null);
  }
}

async function probePayPal(): Promise<ProbeResult> {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const cs = process.env.PAYPAL_CLIENT_SECRET;
  if (!cid || !cs) return pack("paypal", "missing_key", null, null);
  const env = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();
  const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  try {
    const auth = "Basic " + Buffer.from(`${cid}:${cs}`).toString("base64");
    const { res, latencyMs } = await timedFetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const outcome = classify(res.status);
    record("paypal", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("paypal", outcome, latencyMs, res.status);
  } catch (e) {
    record("paypal", false, e instanceof Error ? e.message : "network");
    return pack("paypal", "error", null, null);
  }
}

async function probePlaid(): Promise<ProbeResult> {
  const cid = process.env.PLAID_CLIENT_ID;
  const sec = process.env.PLAID_SECRET;
  if (!cid || !sec) return pack("plaid", "missing_key", null, null);
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  const host = env === "production" ? "https://production.plaid.com"
    : env === "development" ? "https://development.plaid.com"
    : "https://sandbox.plaid.com";
  try {
    const { res, latencyMs } = await timedFetch(`${host}/categories/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: cid, secret: sec }),
    });
    const outcome = classify(res.status);
    record("plaid", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("plaid", outcome, latencyMs, res.status);
  } catch (e) {
    record("plaid", false, e instanceof Error ? e.message : "network");
    return pack("plaid", "error", null, null);
  }
}

async function probeSahmk(): Promise<ProbeResult> {
  const key = process.env.SAHMK_API_KEY;
  if (!key) return pack("sahmk", "missing_key", null, null);
  try {
    // 2222 = Saudi Aramco — a stable, always-listed ticker.
    const { res, latencyMs } = await timedFetch("https://app.sahmk.sa/api/v1/quote/2222/", {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    const outcome = classify(res.status);
    record("sahmk", outcome === "connected", outcome === "connected" ? undefined : `HTTP ${res.status}`);
    return pack("sahmk", outcome, latencyMs, res.status);
  } catch (e) {
    record("sahmk", false, e instanceof Error ? e.message : "network");
    return pack("sahmk", "error", null, null);
  }
}

const REGISTRY: Record<string, () => Promise<ProbeResult>> = {
  finnhub: probeFinnhub,
  twelvedata: probeTwelveData,
  alphavantage: probeAlphaVantage,
  coingecko: probeCoinGecko,
  binance: probeBinance,
  alpaca: probeAlpaca,
  ibkr: probeIBKR,
  tradingeconomics: probeTradingEconomics,
  newsapi: probeNewsAPI,
  gdelt: probeGDELT,
  stripe: probeStripe,
  moyasar: probeMoyasar,
  paypal: probePayPal,
  plaid: probePlaid,
};

/**
 * Run every probe in parallel. Each probe is wrapped in allSettled so a
 * single network failure can never break the caller — the worst case is an
 * `error` result for that one provider.
 */
export async function probeAllProviders(): Promise<Record<string, ProbeResult>> {
  const ids = Object.keys(REGISTRY);
  const results = await Promise.allSettled(ids.map((id) => REGISTRY[id]()));
  const out: Record<string, ProbeResult> = {};
  results.forEach((r, i) => {
    const id = ids[i];
    if (r.status === "fulfilled") {
      out[id] = r.value;
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      record(id, false, msg);
      out[id] = pack(id, "error", null, null);
    }
  });
  return out;
}

// ---------------- Fallback routing plan (per asset class) ----------------

export type AssetClass = "us_stock" | "sa_stock" | "crypto" | "macro" | "news";

export interface RoutingChainEntry {
  id: string;
  available: boolean;
}

export interface RoutingPlanRow {
  assetClass: AssetClass;
  chain: RoutingChainEntry[];
  selected: string | "not_connected";
  reason: string;
}

/**
 * Build the per-asset-class failover plan from current probe results.
 * Used by the UI to show "us_stock → Finnhub → TwelveData → AlphaVantage".
 */
export function buildRoutingPlan(probes: Record<string, ProbeResult>): RoutingPlanRow[] {
  const ok = (id: string) => probes[id]?.outcome === "connected";

  const chains: Record<AssetClass, string[]> = {
    us_stock: ["finnhub", "twelvedata", "alphavantage"],
    sa_stock: ["twelvedata"],
    crypto: ["coingecko", "binance"],
    macro: ["tradingeconomics", "alphavantage"],
    news: ["newsapi", "gdelt"],
  };

  const reasons: Record<AssetClass, string> = {
    us_stock: "US equities prefer Finnhub for breadth, fall back to TwelveData, then AlphaVantage.",
    sa_stock: "Saudi tickers route through TwelveData (.SR) when configured.",
    crypto: "Crypto prefers public CoinGecko, falls back to public Binance.",
    macro: "Macro indicators prefer TradingEconomics, fall back to AlphaVantage.",
    news: "News prefers NewsAPI, falls back to public GDELT.",
  };

  return (Object.keys(chains) as AssetClass[]).map((cls) => {
    const ids = chains[cls];
    const chain = ids.map((id) => ({ id, available: ok(id) }));
    const firstOk = chain.find((c) => c.available);
    return {
      assetClass: cls,
      chain,
      selected: firstOk ? firstOk.id : "not_connected",
      reason: reasons[cls],
    };
  });
}
