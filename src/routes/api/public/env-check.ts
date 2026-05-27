import { createFileRoute } from "@tanstack/react-router";

const ENV_KEYS = [
  "FMP_API_KEY",
  "TWELVEDATA_API_KEY",
  "ALPHAVANTAGE_API_KEY",
  "FRED_API_KEY",
  "COMMODITYPRICE_API_KEY",
  "COMMODITYPRICEAPI_KEY",
  "FINNHUB_API_KEY",
  "NEWSAPI_KEY",
  "NEWS_API_KEY",
  "NEWSAPI_KEY_BACKUP",
  "SAHMK_API_KEY",
  "SAUDI_MARKET_PROVIDER",
  "BINANCE_API_KEY",
  "BINANCE_SECRET_KEY",
  "BINANCE_MODE",
  "BINANCE_TESTNET_API_KEY",
  "ALPACA_API_KEY",
  "ALPACA_API_KEY_ID",
  "ALPACA_SECRET_KEY",
  "ALPACA_API_SECRET_KEY",
  "ALPACA_BASE_URL",
  "ALPACA_DATA_URL",
  "BROKER_PROVIDER",
  "EODHD_API_KEY",
  "MARKETSTACK_API_KEY",
  "LIVE_TRADING_ENABLED",
  "RESEND_API_KEY",
  "GEMINI_API_KEY",
  "LOVABLE_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

const ALIASES: Record<string, string[]> = {
  news: ["NEWSAPI_KEY", "NEWS_API_KEY", "NEWSAPI_KEY_BACKUP"],
  fmp: ["FMP_API_KEY"],
  twelvedata: ["TWELVEDATA_API_KEY"],
  alphavantage: ["ALPHAVANTAGE_API_KEY"],
  fred: ["FRED_API_KEY"],
  commodity: ["COMMODITYPRICE_API_KEY", "COMMODITYPRICEAPI_KEY"],
  finnhub: ["FINNHUB_API_KEY"],
  sahmk: ["SAHMK_API_KEY", "SAUDI_MARKET_PROVIDER"],
  binance: ["BINANCE_API_KEY", "BINANCE_SECRET_KEY", "BINANCE_MODE"],
  alpaca: ["ALPACA_API_KEY", "ALPACA_API_KEY_ID", "ALPACA_SECRET_KEY", "ALPACA_API_SECRET_KEY", "ALPACA_BASE_URL", "ALPACA_DATA_URL"],
  eodhd: ["EODHD_API_KEY"],
  marketstack: ["MARKETSTACK_API_KEY"],
  broker: ["BROKER_PROVIDER", "LIVE_TRADING_ENABLED"],
  email: ["RESEND_API_KEY"],
  // AI provider priority: GEMINI_API_KEY (primary) → LOVABLE_API_KEY (fallback)
  ai: ["GEMINI_API_KEY", "LOVABLE_API_KEY"],
  supabase: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"],
};

function hasKey(name: string): boolean {
  return typeof process !== "undefined" && Boolean(process.env[name]?.trim());
}

export const Route = createFileRoute("/api/public/env-check")({
  server: {
    handlers: {
      GET: async () => {
        const keys: Record<string, boolean> = {};
        for (const k of ENV_KEYS) keys[k] = hasKey(k);

        const liveTrading = process.env.LIVE_TRADING_ENABLED?.trim() === "true";

        const missingRequired: string[] = [];
        const missingOptional: string[] = [];
        const warnings: string[] = [];

        if (!keys.FMP_API_KEY) missingRequired.push("FMP_API_KEY");
        if (!keys.TWELVEDATA_API_KEY) missingOptional.push("TWELVEDATA_API_KEY");
        if (!keys.ALPHAVANTAGE_API_KEY) missingOptional.push("ALPHAVANTAGE_API_KEY");
        if (!keys.FINNHUB_API_KEY) missingOptional.push("FINNHUB_API_KEY");
        if (!keys.NEWSAPI_KEY && !keys.NEWS_API_KEY) missingOptional.push("NEWSAPI_KEY or NEWS_API_KEY");

        if (keys.NEWSAPI_KEY && keys.NEWS_API_KEY) {
          warnings.push("Both NEWSAPI_KEY and NEWS_API_KEY are set — code uses NEWSAPI_KEY");
        }
        if (keys.ALPACA_API_KEY && keys.ALPACA_API_KEY_ID) {
          warnings.push("Both ALPACA_API_KEY and ALPACA_API_KEY_ID are set — code checks both");
        }

        // Detect active AI provider (Gemini primary, Lovable fallback)
        const aiProvider =
          keys.GEMINI_API_KEY ? "gemini" :
          keys.LOVABLE_API_KEY ? "lovable" :
          "none";
        const aiRuntime =
          aiProvider === "gemini" ? "Gemini API (direct)" :
          aiProvider === "lovable" ? "Lovable AI Gateway (fallback)" :
          "heuristic (no AI key)";

        return new Response(JSON.stringify({
          ok: true,
          environment: process.env.RAILWAY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
          secretsExposed: false,
          liveTradingEnabled: liveTrading,
          aiProvider,
          aiRuntime,
          keys,
          aliases: ALIASES,
          missingRequiredForMarketData: missingRequired,
          missingOptional,
          warnings,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
