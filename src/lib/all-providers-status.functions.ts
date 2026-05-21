/**
 * Unified provider status — extended catalog of every external service the
 * platform talks to (market data, news, brokers, payments, KYC).
 *
 * Detects "configured / missing key" from process.env on the server, then
 * combines with live in-memory health when available. Never returns key
 * values to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allProvidersHealth, selectMarketProvider, selectMacroProvider, lastFailoverEvents } from "@/services/providers";
import { gdeltProviderHealth } from "@/services/providers/gdelt";
import { probeAllProviders, buildRoutingPlan, type RoutingPlanRow, type ProbeResult } from "@/services/providers/probes";

export type ProviderCategory = "market_data" | "news" | "macro" | "broker" | "payments" | "kyc";
export type ProviderConnState = "connected" | "missing_key" | "error" | "rate_limited" | "not_implemented" | "unknown";
export type ProviderDataMode = "live" | "delayed" | "mock" | "not_connected" | "error";

export interface ProviderStatusRow {
  id: string;
  label: string;
  category: ProviderCategory;
  connState: ProviderConnState;
  dataMode: ProviderDataMode;
  configured: boolean;
  envKeys: string[];                 // names only, never values
  lastSuccessAt?: number | null;
  lastErrorAt?: number | null;
  lastError?: string | null;
  latencyMs?: number | null;
  errorRate?: number | null;
  rateLimited?: number | null;
  httpStatus?: number | null;
  endpoint?: string | null;
  note?: string;
}

function hasEnv(...names: string[]): boolean {
  for (const n of names) {
    const v = (process.env as Record<string, string | undefined>)[n];
    if (v && v.trim().length > 0) return true;
  }
  return false;
}

function modeFor(conn: ProviderConnState, defaultLive: ProviderDataMode = "live"): ProviderDataMode {
  if (conn === "connected") return defaultLive;
  if (conn === "missing_key" || conn === "not_implemented") return "not_connected";
  if (conn === "error" || conn === "rate_limited") return "error";
  return "not_connected";
}

/** Probe outcome wins for connection state; cached health enriches metrics. */
function reconcile(probe: ProbeResult | undefined, fallback: ProviderConnState): ProviderConnState {
  if (!probe) return fallback;
  return probe.outcome === "connected" ? "connected"
    : probe.outcome === "rate_limited" ? "rate_limited"
    : probe.outcome === "missing_key" ? "missing_key"
    : probe.outcome === "not_implemented" ? "not_implemented"
    : "error";
}

function probeFields(p: ProbeResult | undefined) {
  return {
    lastSuccessAt: p?.lastSuccessAt ?? null,
    lastErrorAt: p?.lastErrorAt ?? null,
    lastError: p?.lastError ?? null,
    httpStatus: p?.httpStatus ?? null,
  };
}

export const getAllProvidersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{
    generatedAt: number;
    routing: { market: string; macro: string };
    routingPlan: RoutingPlanRow[];
    providers: ProviderStatusRow[];
    failoverEvents: ReturnType<typeof lastFailoverEvents>;
  }> => {
    const health = allProvidersHealth();
    const gdelt = gdeltProviderHealth();
    // Probes use Promise.allSettled internally → never throws.
    const probes = await probeAllProviders();

    const fh = health.finnhub;
    const td = health.twelvedata;
    const av = health.alphavantage;
    const na = health.newsapi;

    const finnhubConn = reconcile(probes.finnhub, !fh.configured ? "missing_key" : fh.status === "down" ? "error" : "connected");
    const tdConn = reconcile(probes.twelvedata, !td.configured ? "missing_key" : td.status === "down" ? "error" : "connected");
    const avConn = reconcile(probes.alphavantage, !av.configured ? "missing_key" : av.status === "down" ? "error" : "connected");
    const naConn = reconcile(probes.newsapi, !na.configured ? "missing_key" : na.status === "down" ? "error" : "connected");

    const providers: ProviderStatusRow[] = [
      // ---- Market data ----
      {
        id: "finnhub", label: "Finnhub", category: "market_data",
        connState: finnhubConn, dataMode: modeFor(finnhubConn),
        configured: fh.configured, envKeys: ["FINNHUB_API_KEY"],
        latencyMs: fh.avgLatencyMs ?? null, errorRate: fh.errorRate ?? null,
        rateLimited: fh.rateLimited ?? 0,
        endpoint: "https://finnhub.io/api/v1",
      },
      {
        id: "twelvedata", label: "TwelveData", category: "market_data",
        connState: tdConn, dataMode: modeFor(tdConn),
        configured: td.configured, envKeys: ["TWELVEDATA_API_KEY"],
        latencyMs: td.avgLatencyMs ?? null, errorRate: td.errorRate ?? null,
        rateLimited: td.rateLimited ?? 0,
        endpoint: "https://api.twelvedata.com",
      },
      {
        id: "alphavantage", label: "AlphaVantage", category: "macro",
        connState: avConn, dataMode: modeFor(avConn),
        configured: av.configured, envKeys: ["ALPHAVANTAGE_API_KEY"],
        latencyMs: av.avgLatencyMs ?? null, errorRate: av.errorRate ?? null,
        rateLimited: av.rateLimited ?? 0,
        endpoint: "https://www.alphavantage.co/query",
      },
      {
        id: "coingecko", label: "CoinGecko", category: "market_data",
        connState: reconcile(probes.coingecko, "connected"), dataMode: "live",
        configured: true, envKeys: [],
        endpoint: "https://api.coingecko.com/api/v3",
        note: "Public, keyless",
      },
      // ---- News / geopolitics ----
      {
        id: "newsapi", label: "NewsAPI", category: "news",
        connState: naConn, dataMode: modeFor(naConn),
        configured: na.configured, envKeys: ["NEWSAPI_KEY", "NEWSAPI_KEY_BACKUP"],
        latencyMs: na.avgLatencyMs ?? null, errorRate: na.errorRate ?? null,
        rateLimited: na.rateLimited ?? 0,
        endpoint: "https://newsapi.org/v2",
      },
      {
        id: "gdelt", label: "GDELT", category: "news",
        connState: reconcile(probes.gdelt, "connected"),
        dataMode: "live",
        configured: true, envKeys: [],
        latencyMs: null,
        endpoint: "https://api.gdeltproject.org",
        note: `Public, keyless · cached: ${gdelt.cached}`,
      },
      {
        id: "tradingeconomics", label: "TradingEconomics", category: "macro",
        connState: reconcile(probes.tradingeconomics, hasEnv("TRADINGECONOMICS_API_KEY") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.tradingeconomics, hasEnv("TRADINGECONOMICS_API_KEY") ? "connected" : "missing_key")),
        configured: hasEnv("TRADINGECONOMICS_API_KEY"),
        envKeys: ["TRADINGECONOMICS_API_KEY"],
        endpoint: "https://api.tradingeconomics.com",
      },
      // ---- Brokers ----
      {
        id: "binance", label: "Binance", category: "broker",
        connState: reconcile(probes.binance, hasEnv("BINANCE_API_KEY", "BINANCE_SECRET_KEY") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.binance, hasEnv("BINANCE_API_KEY", "BINANCE_SECRET_KEY") ? "connected" : "missing_key")),
        configured: hasEnv("BINANCE_API_KEY") && hasEnv("BINANCE_SECRET_KEY"),
        envKeys: ["BINANCE_API_KEY", "BINANCE_SECRET_KEY"],
        endpoint: "https://api.binance.com",
        note: "Read-only while LIVE_TRADING_ENABLED=false",
      },
      {
        id: "alpaca", label: "Alpaca", category: "broker",
        connState: reconcile(probes.alpaca, hasEnv("ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.alpaca, hasEnv("ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY") ? "connected" : "missing_key")),
        configured: hasEnv("ALPACA_API_KEY_ID") && hasEnv("ALPACA_API_SECRET_KEY"),
        envKeys: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "ALPACA_BASE_URL"],
        endpoint: (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets"),
      },
      {
        id: "ibkr", label: "Interactive Brokers", category: "broker",
        connState: reconcile(probes.ibkr, hasEnv("IBKR_GATEWAY_URL") ? "connected" : "not_implemented"),
        dataMode: modeFor(reconcile(probes.ibkr, hasEnv("IBKR_GATEWAY_URL") ? "connected" : "not_implemented")),
        configured: hasEnv("IBKR_GATEWAY_URL"),
        envKeys: ["IBKR_GATEWAY_URL"],
        note: "Bridge not yet provisioned",
      },
      // ---- Payments ----
      {
        id: "stripe", label: "Stripe", category: "payments",
        connState: reconcile(probes.stripe, hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.stripe, hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY") ? "connected" : "missing_key")),
        configured: hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY"),
        envKeys: ["STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY"],
        endpoint: "https://api.stripe.com",
      },
      {
        id: "paypal", label: "PayPal", category: "payments",
        connState: reconcile(probes.paypal, hasEnv("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.paypal, hasEnv("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET") ? "connected" : "missing_key")),
        configured: hasEnv("PAYPAL_CLIENT_ID") && hasEnv("PAYPAL_CLIENT_SECRET"),
        envKeys: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENVIRONMENT"],
        endpoint: (process.env.PAYPAL_ENVIRONMENT || "sandbox") + ".paypal.com",
      },
      {
        id: "moyasar", label: "Moyasar", category: "payments",
        connState: reconcile(probes.moyasar, hasEnv("MOYASAR_SECRET_KEY") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.moyasar, hasEnv("MOYASAR_SECRET_KEY") ? "connected" : "missing_key")),
        configured: hasEnv("MOYASAR_SECRET_KEY"),
        envKeys: ["MOYASAR_SECRET_KEY"],
        endpoint: "https://api.moyasar.com",
      },
      // ---- KYC / banking ----
      {
        id: "plaid", label: "Plaid", category: "kyc",
        connState: reconcile(probes.plaid, hasEnv("PLAID_CLIENT_ID", "PLAID_SECRET") ? "connected" : "missing_key"),
        dataMode: modeFor(reconcile(probes.plaid, hasEnv("PLAID_CLIENT_ID", "PLAID_SECRET") ? "connected" : "missing_key")),
        configured: hasEnv("PLAID_CLIENT_ID") && hasEnv("PLAID_SECRET"),
        envKeys: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
        endpoint: "https://api.plaid.com",
      },
    ];

    // Merge live probe metadata (lastSuccessAt, lastErrorAt, lastError,
    // httpStatus, and probe-measured latency when the cached value is empty).
    for (const row of providers) {
      const p = probes[row.id];
      if (!p) continue;
      Object.assign(row, probeFields(p));
      if (row.latencyMs == null) row.latencyMs = p.latencyMs;
    }

    return {
      generatedAt: Date.now(),
      routing: { market: selectMarketProvider(), macro: selectMacroProvider() },
      routingPlan: buildRoutingPlan(probes),
      providers,
      failoverEvents: lastFailoverEvents(25),
    };
  });
