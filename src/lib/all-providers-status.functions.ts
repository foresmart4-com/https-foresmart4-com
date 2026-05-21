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

export const getAllProvidersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ generatedAt: number; routing: { market: string; macro: string }; providers: ProviderStatusRow[]; failoverEvents: ReturnType<typeof lastFailoverEvents> }> => {
    const health = allProvidersHealth();
    const gdelt = gdeltProviderHealth();

    const fh = health.finnhub;
    const td = health.twelvedata;
    const av = health.alphavantage;
    const na = health.newsapi;

    const finnhubConn: ProviderConnState = !fh.configured ? "missing_key" : fh.status === "down" ? "error" : "connected";
    const tdConn: ProviderConnState = !td.configured ? "missing_key" : td.status === "down" ? "error" : "connected";
    const avConn: ProviderConnState = !av.configured ? "missing_key" : av.status === "down" ? "error" : "connected";
    const naConn: ProviderConnState = !na.configured ? "missing_key" : na.status === "down" ? "error" : "connected";

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
        connState: "connected", dataMode: "live",
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
        connState: gdelt.status === "down" ? "error" : "connected",
        dataMode: gdelt.status === "down" ? "error" : "live",
        configured: true, envKeys: [],
        latencyMs: gdelt.avgLatencyMs ?? null,
        endpoint: "https://api.gdeltproject.org",
        note: "Public, keyless",
      },
      {
        id: "tradingeconomics", label: "TradingEconomics", category: "macro",
        connState: hasEnv("TRADINGECONOMICS_API_KEY") ? "connected" : "missing_key",
        dataMode: hasEnv("TRADINGECONOMICS_API_KEY") ? "live" : "not_connected",
        configured: hasEnv("TRADINGECONOMICS_API_KEY"),
        envKeys: ["TRADINGECONOMICS_API_KEY"],
        endpoint: "https://api.tradingeconomics.com",
      },
      // ---- Brokers ----
      {
        id: "binance", label: "Binance", category: "broker",
        connState: hasEnv("BINANCE_API_KEY", "BINANCE_SECRET_KEY") ? "connected" : "missing_key",
        dataMode: hasEnv("BINANCE_API_KEY", "BINANCE_SECRET_KEY") ? "live" : "not_connected",
        configured: hasEnv("BINANCE_API_KEY") && hasEnv("BINANCE_SECRET_KEY"),
        envKeys: ["BINANCE_API_KEY", "BINANCE_SECRET_KEY"],
        endpoint: "https://api.binance.com",
        note: "Read-only while LIVE_TRADING_ENABLED=false",
      },
      {
        id: "alpaca", label: "Alpaca", category: "broker",
        connState: hasEnv("ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY") ? "connected" : "missing_key",
        dataMode: hasEnv("ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY") ? "live" : "not_connected",
        configured: hasEnv("ALPACA_API_KEY_ID") && hasEnv("ALPACA_API_SECRET_KEY"),
        envKeys: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "ALPACA_BASE_URL"],
        endpoint: (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets"),
      },
      {
        id: "ibkr", label: "Interactive Brokers", category: "broker",
        connState: hasEnv("IBKR_GATEWAY_URL") ? "connected" : "not_implemented",
        dataMode: hasEnv("IBKR_GATEWAY_URL") ? "live" : "not_connected",
        configured: hasEnv("IBKR_GATEWAY_URL"),
        envKeys: ["IBKR_GATEWAY_URL"],
        note: "Bridge not yet provisioned",
      },
      // ---- Payments ----
      {
        id: "stripe", label: "Stripe", category: "payments",
        connState: hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY") ? "connected" : "missing_key",
        dataMode: hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY") ? "live" : "not_connected",
        configured: hasEnv("STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY"),
        envKeys: ["STRIPE_SANDBOX_API_KEY", "STRIPE_LIVE_API_KEY"],
        endpoint: "https://api.stripe.com",
      },
      {
        id: "paypal", label: "PayPal", category: "payments",
        connState: hasEnv("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET") ? "connected" : "missing_key",
        dataMode: hasEnv("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET") ? "live" : "not_connected",
        configured: hasEnv("PAYPAL_CLIENT_ID") && hasEnv("PAYPAL_CLIENT_SECRET"),
        envKeys: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENVIRONMENT"],
        endpoint: (process.env.PAYPAL_ENVIRONMENT || "sandbox") + ".paypal.com",
      },
      {
        id: "moyasar", label: "Moyasar", category: "payments",
        connState: hasEnv("MOYASAR_SECRET_KEY") ? "connected" : "missing_key",
        dataMode: hasEnv("MOYASAR_SECRET_KEY") ? "live" : "not_connected",
        configured: hasEnv("MOYASAR_SECRET_KEY"),
        envKeys: ["MOYASAR_SECRET_KEY"],
        endpoint: "https://api.moyasar.com",
      },
      // ---- KYC / banking ----
      {
        id: "plaid", label: "Plaid", category: "kyc",
        connState: hasEnv("PLAID_CLIENT_ID", "PLAID_SECRET") ? "connected" : "missing_key",
        dataMode: hasEnv("PLAID_CLIENT_ID", "PLAID_SECRET") ? "live" : "not_connected",
        configured: hasEnv("PLAID_CLIENT_ID") && hasEnv("PLAID_SECRET"),
        envKeys: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
        endpoint: "https://api.plaid.com",
      },
    ];

    return {
      generatedAt: Date.now(),
      routing: { market: selectMarketProvider(), macro: selectMacroProvider() },
      providers,
      failoverEvents: lastFailoverEvents(25),
    };
  });
