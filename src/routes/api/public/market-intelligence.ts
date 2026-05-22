/**
 * Public market intelligence endpoint.
 *
 * GET /api/public/market-intelligence?symbol=2222.SR&debug=1
 *
 * Wraps the unified router (the ONLY price source) and the intelligence
 * layer factor engine. Returns Arabic investment analysis plus diagnostics.
 *
 * Never executes trades. LIVE_TRADING_ENABLED stays false.
 */

import { createFileRoute } from "@tanstack/react-router";
import { routeQuote, getRouterDiagnostics, resolveAsset } from "@/lib/market/router";
import { getSahmkQuote } from "@/services/providers/sahmk";
import { buildMarketIntelligence, type IntelQuoteInput } from "@/services/intelligence/market-intelligence-layer";

async function fetchNewsSentiment(symbol: string): Promise<{ sentiment: number | null; count: number | null }> {
  try {
    const { getCompanyNews } = await import("@/services/providers/finnhub");
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const items = await getCompanyNews(symbol, from, to);
    if (!items || items.length === 0) return { sentiment: null, count: 0 };
    const POS = ["beat", "beats", "surge", "rally", "record", "upgrade", "growth", "profit", "gain", "strong", "boost"];
    const NEG = ["miss", "misses", "plunge", "tumble", "crash", "downgrade", "loss", "drop", "fall", "weak", "warning", "lawsuit", "fraud"];
    let bull = 0, bear = 0;
    for (const it of items.slice(0, 30)) {
      const h = (it.headline || "").toLowerCase();
      for (const w of POS) if (h.includes(w)) bull++;
      for (const w of NEG) if (h.includes(w)) bear++;
    }
    const denom = Math.max(1, bull + bear);
    const score = Math.round(((bull - bear) / denom) * 100);
    return { sentiment: score, count: items.length };
  } catch {
    return { sentiment: null, count: null };
  }
}

export const Route = createFileRoute("/api/public/market-intelligence")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol")?.trim();
        const debug = url.searchParams.get("debug") === "1";

        if (!symbol) {
          return new Response(JSON.stringify({
            error: "missing 'symbol' query parameter",
            example: "/api/public/market-intelligence?symbol=2222.SR",
          }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        try {
          const resolved = resolveAsset(symbol);
          const quote = await routeQuote(symbol);

          // Provider extras
          let sahmkRaw = null;
          if (resolved.assetClass === "saudi_stock") {
            const r = await getSahmkQuote(symbol);
            if (!("ok" in r) || r.ok !== false) sahmkRaw = (r as { raw?: unknown }).raw ?? null;
          }
          const news = resolved.assetClass === "us_stock"
            ? await fetchNewsSentiment(resolved.normalized)
            : { sentiment: null, count: null };

          const input: IntelQuoteInput = {
            symbol: quote.symbol,
            assetClass: quote.assetClass,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            liquidity: quote.liquidity,
            delayed: quote.delayed,
            provider: quote.provider,
            mode: quote.mode,
            success: quote.success,
          };

          const intelligence = buildMarketIntelligence(input, {
            sahmkRaw: sahmkRaw as never,
            newsSentiment: news.sentiment,
            newsCount: news.count,
          });

          const body: Record<string, unknown> = {
            success: true,
            symbol: quote.symbol,
            assetClass: quote.assetClass,
            quote,
            intelligence,
            disclaimerAr: "تحليل تعليمي غير ملزم وليس توصية مالية",
            liveTradingEnabled: false,
            diagnostics: debug ? {
              resolved,
              router: getRouterDiagnostics(),
              newsCount: news.count,
              newsSentiment: news.sentiment,
              sahmkRawAvailable: !!sahmkRaw,
            } : {
              resolved: { assetClass: resolved.assetClass, resolverPath: resolved.resolverPath },
              attempted: quote.attempted,
              skippedProviders: quote.skippedProviders,
            },
          };

          return new Response(JSON.stringify(body, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          // Graceful fallback — never 500 to the client.
          const message = e instanceof Error ? e.message : "intelligence failed";
          const resolved = resolveAsset(symbol);
          const fallback = buildMarketIntelligence({
            symbol: resolved.normalized || symbol,
            assetClass: resolved.assetClass,
            price: null, change: null, changePercent: null, volume: null, liquidity: null,
            delayed: true, provider: null, mode: "synthetic", success: false,
          });
          return new Response(JSON.stringify({
            success: false,
            symbol: resolved.normalized || symbol,
            assetClass: resolved.assetClass,
            quote: null,
            intelligence: fallback,
            error: message,
            disclaimerAr: "تحليل تعليمي غير ملزم وليس توصية مالية",
            liveTradingEnabled: false,
            diagnostics: { resolved, error: message },
          }, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

      },
    },
  },
});
