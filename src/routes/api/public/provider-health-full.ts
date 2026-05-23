import { createFileRoute } from "@tanstack/react-router";
import { allProvidersHealth, selectMarketProvider, selectMacroProvider } from "@/services/providers";

export const Route = createFileRoute("/api/public/provider-health-full")({
  server: {
    handlers: {
      GET: async () => {
        const health = allProvidersHealth();
        const marketProvider = selectMarketProvider();
        const macroProvider = selectMacroProvider();

        const registry = [
          {
            provider: "finnhub",
            configured: health.finnhub.configured,
            reachable: health.finnhub.status === "healthy",
            quota: health.finnhub.status !== "rate_limited",
            latency: health.finnhub.latencyMs ?? null,
            fallback: marketProvider !== "finnhub" ? marketProvider : null,
            lastSuccess: health.finnhub.lastSuccessAt ?? null,
            status: health.finnhub.status,
            envKey: "FINNHUB_API_KEY",
            missingMessage: !health.finnhub.configured ? "المفتاح غير مهيأ في بيئة الإنتاج" : null,
          },
          {
            provider: "twelvedata",
            configured: health.twelvedata.configured,
            reachable: health.twelvedata.status === "healthy",
            quota: health.twelvedata.status !== "rate_limited",
            latency: health.twelvedata.latencyMs ?? null,
            fallback: null,
            lastSuccess: health.twelvedata.lastSuccessAt ?? null,
            status: health.twelvedata.status,
            envKey: "TWELVEDATA_API_KEY",
            missingMessage: !health.twelvedata.configured ? "المفتاح غير مهيأ في بيئة الإنتاج" : null,
          },
          {
            provider: "alphavantage",
            configured: health.alphavantage.configured,
            reachable: health.alphavantage.status === "healthy",
            quota: health.alphavantage.status !== "rate_limited",
            latency: health.alphavantage.latencyMs ?? null,
            fallback: null,
            lastSuccess: health.alphavantage.lastSuccessAt ?? null,
            status: health.alphavantage.status,
            envKey: "ALPHAVANTAGE_API_KEY",
            missingMessage: !health.alphavantage.configured ? "المفتاح غير مهيأ في بيئة الإنتاج" : null,
          },
          {
            provider: "coingecko",
            configured: true,
            reachable: true,
            quota: true,
            latency: null,
            fallback: "twelvedata",
            lastSuccess: new Date().toISOString(),
            status: "healthy",
            envKey: null,
            missingMessage: null,
          },
          {
            provider: "newsapi",
            configured: health.newsapi.configured,
            reachable: health.newsapi.status === "healthy",
            quota: health.newsapi.status !== "rate_limited",
            latency: health.newsapi.latencyMs ?? null,
            fallback: "gdelt",
            lastSuccess: health.newsapi.lastSuccessAt ?? null,
            status: health.newsapi.status,
            envKey: "NEWSAPI_KEY",
            missingMessage: !health.newsapi.configured ? "المفتاح غير مهيأ في بيئة الإنتاج" : null,
          },
          {
            provider: "commodityprice",
            configured: health.commodityprice.configured,
            reachable: health.commodityprice.status === "healthy",
            quota: health.commodityprice.status !== "rate_limited",
            latency: health.commodityprice.latencyMs ?? null,
            fallback: null,
            lastSuccess: health.commodityprice.lastSuccessAt ?? null,
            status: health.commodityprice.status,
            envKey: "COMMODITYPRICE_API_KEY",
            missingMessage: !health.commodityprice.configured ? "المفتاح غير مهيأ في بيئة الإنتاج" : null,
          },
        ];

        return new Response(JSON.stringify({
          product: "ForeSmart",
          activeMarketProvider: marketProvider,
          activeMacroProvider: macroProvider,
          cryptoFallback: "coingecko",
          providers: registry,
          configured: registry.filter((p) => p.configured).length,
          total: registry.length,
          timestamp: new Date().toISOString(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
