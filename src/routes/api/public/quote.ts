import { createFileRoute } from "@tanstack/react-router";
import { routeQuote, resolveAsset, type AssetClass } from "@/lib/market/router";


const BUILD_TIME = new Date().toISOString();
const QUOTE_ROUTER_VERSION = "quote-router-eodhd-marketstack-v1";
const REGION_MAP: Record<string, string> = {
  us_stock: "us", saudi_stock: "saudi", gcc_stock: "gcc", uk_stock: "uk",
  european_stock: "europe", china_stock: "china", hongkong_stock: "hongkong",
  crypto: "global", forex: "global", metal: "global", commodity: "global",
  etf: "us", bond: "us", treasury: "us", index: "global", macro: "global",
  news: "global", unknown: "unknown",
};

const CURRENCY_MAP: Record<string, string> = {
  us_stock: "USD", saudi_stock: "SAR", gcc_stock: "USD", uk_stock: "GBP",
  european_stock: "EUR", china_stock: "CNY", hongkong_stock: "HKD",
  crypto: "USD", forex: "USD", metal: "USD", commodity: "USD",
  etf: "USD", bond: "USD", treasury: "USD", index: "USD",
};

const EXCHANGE_MAP: Record<string, string> = {
  saudi_stock: "Tadawul", uk_stock: "LSE", us_stock: "NYSE/NASDAQ",
  crypto: "Multi", forex: "FX", metal: "Spot", commodity: "Futures",
};

export const Route = createFileRoute("/api/public/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol")?.trim();
        if (!symbol) {
          return new Response(JSON.stringify({ success: false, error: "Missing ?symbol= parameter" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const resolved = resolveAsset(symbol);
        const start = Date.now();
        const chains = getChains(resolved.assetClass);

        try {
          const quote = await routeQuote(symbol);
          const dq = !quote.success ? "غير متاح"
            : (quote.fallbackUsed ?? false) ? "احتياطي"
            : (quote.delayed ?? false) ? "متأخر"
            : "مباشر";
          return new Response(JSON.stringify({
            gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? "local",
            buildTime: BUILD_TIME,
            quoteRouterVersion: QUOTE_ROUTER_VERSION,
            success: quote.success,
            dataQuality: dq,
            symbol: quote.symbol,
            inputSymbol: symbol,
            normalizedSymbol: resolved.normalized,
            providerSymbol: quote.symbol,
            assetClass: resolved.assetClass,
            marketRegion: REGION_MAP[resolved.assetClass] ?? "unknown",
            exchange: EXCHANGE_MAP[resolved.assetClass] ?? null,
            currency: CURRENCY_MAP[resolved.assetClass] ?? null,
            provider: quote.provider,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            timestamp: quote.timestamp,
            delayed: quote.delayed ?? false,
            fallbackUsed: quote.fallbackUsed ?? false,
            error: quote.error ?? null,
            attempted: quote.attempted ?? [],
            diagnostics: {
              missingKeys: [],
              latencyMs: Date.now() - start,
              resolverPath: resolved.resolverPath,
              providerPriority: chains,
              triedProviderSymbols: chains.map((p) => ({ provider: p, symbol: symbol })),
            },
          }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (err) {
          return new Response(JSON.stringify({
            gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? "local",
            buildTime: BUILD_TIME,
            quoteRouterVersion: QUOTE_ROUTER_VERSION,
            success: false,
            symbol,
            inputSymbol: symbol,
            normalizedSymbol: resolved.normalized,
            providerSymbol: null,
            assetClass: resolved.assetClass,
            marketRegion: REGION_MAP[resolved.assetClass] ?? "unknown",
            exchange: null,
            currency: null,
            provider: null,
            price: null,
            change: null,
            changePercent: null,
            volume: null,
            timestamp: Date.now(),
            delayed: false,
            fallbackUsed: true,
            error: err instanceof Error ? err.message : "تعذر جلب بيانات هذا الأصل من المزودات المتاحة حالياً",
            attempted: chains,
            diagnostics: {
              missingKeys: [],
              latencyMs: Date.now() - start,
              resolverPath: resolved.resolverPath,
              providerPriority: chains,
              triedProviderSymbols: chains.map((p) => ({ provider: p, symbol: symbol })),
            },
          }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});

function getChains(assetClass: AssetClass): string[] {
  const map: Record<string, string[]> = {
    us_stock:       ["finnhub", "financialdata", "eodhd", "marketstack", "fmp", "twelvedata", "alphavantage"],
    saudi_stock:    ["sahmk", "eodhd", "marketstack", "twelvedata", "fmp", "alphavantage"],
    gcc_stock:      ["eodhd", "marketstack", "fmp", "twelvedata", "alphavantage"],
    // marketstack removed — returns 406 for UK/EU/Asia on current plan
    uk_stock:       ["alphavantage", "fmp", "eodhd", "twelvedata"],
    european_stock: ["alphavantage", "fmp", "eodhd", "twelvedata"],
    china_stock:    ["eodhd", "fmp", "twelvedata", "alphavantage"],
    hongkong_stock: ["eodhd", "fmp", "twelvedata", "alphavantage", "yahoo"],
    crypto:         ["binance", "coingecko", "financialdata", "twelvedata", "eodhd", "fmp"],
    // alphavantage before financialdata — AV forex works; FD unreachable
    forex:          ["twelvedata", "alphavantage", "eodhd", "fmp", "financialdata", "marketstack"],
    metal:          ["twelvedata", "financialdata", "eodhd", "commodityprice", "fmp", "alphavantage"],
    commodity:      ["commodityprice", "eodhd", "financialdata", "fmp", "alphavantage", "twelvedata"],
    macro:          ["fred", "fmp", "alphavantage"],
  };
  return map[assetClass] ?? ["eodhd", "fmp", "twelvedata", "alphavantage"];
}
