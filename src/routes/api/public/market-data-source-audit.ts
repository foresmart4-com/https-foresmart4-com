import { createFileRoute } from "@tanstack/react-router";
import { getProviderConnected } from "@/lib/market/router";

export const Route = createFileRoute("/api/public/market-data-source-audit")({
  server: {
    handlers: {
      GET: async () => {
        const connected = getProviderConnected();

        const syntheticDataLocations: string[] = [
          "src/lib/market-data.ts → syntheticCrypto() — fallback when CoinGecko unavailable (source: 'simulated')",
          "src/lib/market-data.ts → syntheticAsset()  — fallback for metal-funds / bonds when Yahoo unavailable (source: 'simulated')",
          "src/lib/stocks-data.ts → syntheticQuote()  — fallback for global stocks when Yahoo unavailable (isLive: false)",
          "src/lib/universal-quote.functions.ts        — mode: 'mock' when all providers fail",
          "src/lib/mock-data.ts → portfolioKpis/portfolioPerformance/aiAlerts/topOpportunities/featuredAssets — dashboard demo UI (already labeled)",
          "src/routes/_app/signals.tsx → error fallback — hardcoded sample signals when generateSignals() throws",
        ];

        const pagesUsingUnifiedQuotes: string[] = [
          "/api/public/quote — 100% unified router (routeQuote)",
          "/market-intelligence — uses getMarketIntelligence() backed by unified router",
          "/market-data-monitor — uses finnhubHealth() + getProviderHealthTimeline()",
          "/provider-health — uses getAllProvidersStatus()",
          "/genesis-100 — uses /api/public/genesis100/* endpoints, no direct price display",
          "/genesis — uses /api/ai/intelligence/genesis, no direct price display",
        ];

        const pagesUsingLegacyOrMixedData: string[] = [
          "/dashboard → SmartMarketPulse uses getMarketData() (can be simulated); badges added",
          "/heatmap → uses getMarketData() + getStocksData() (can be simulated/Yahoo); mode now mapped correctly",
          "/signals → generateSignals() consumes getMarketData() (can be simulated); dataMode badge added per signal",
          "/watchlist → loadQuotes() uses getMarketData() + getStocksData() (prices only, no explicit mode badge in quote row)",
          "/markets → uses getMarketData() + getStocksData() + featuredAssets (mock-data)",
          "/portfolios → GROWTH_HOLDINGS are hardcoded holdings (no live price, labeled demo)",
        ];

        const syntheticDataStillUsed = true;

        return new Response(
          JSON.stringify(
            {
              ok: true,
              auditVersion: "market-data-source-audit-v1",
              timestamp: new Date().toISOString(),
              unifiedRouterUsed: true,
              syntheticDataStillUsed,
              liveTradingEnabled: false,
              syntheticDataLocations,
              pagesAudited: [
                "dashboard",
                "heatmap",
                "signals",
                "market-intelligence",
                "market-data-monitor",
                "provider-health",
                "genesis-100",
                "genesis",
                "portfolios",
                "watchlists",
              ],
              pagesUsingUnifiedQuotes,
              pagesStillUsingLegacyData: pagesUsingLegacyOrMixedData,
              dataClassification: {
                "مباشر":    "delayed=false AND fallbackUsed=false (real-time provider)",
                "متأخر":    "delayed=true OR provider is inherently delayed (Yahoo, AlphaVantage)",
                "احتياطي":  "fallbackUsed=true but price successfully retrieved from secondary provider",
                "تقديري":   "synthetic/simulated/mock — deterministic noise around baseline price",
                "غير متاح": "success=false — all providers exhausted",
              },
              connectedProviders: connected,
              unifiedRouterEndpoint: "/api/public/quote?symbol=<SYMBOL>",
              notes: [
                "Fallback logic in market-data.ts and stocks-data.ts is preserved per spec.",
                "All visible market prices on /dashboard, /heatmap, /signals now carry a data mode badge (مباشر / متأخر / تقديري).",
                "Dashboard portfolio KPIs, performance chart, and AI alerts remain labeled 'بيانات تجريبية' (demo) as they are mock data.",
                "FeaturedAssetsTable is already labeled 'Demo data' in its header.",
                "Watchlist price quotes use getMarketData()/getStocksData() — prices shown without inline mode badge (quote is supplementary context only).",
              ],
            },
            null,
            2,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
