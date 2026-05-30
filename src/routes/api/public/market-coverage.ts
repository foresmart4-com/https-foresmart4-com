import { createFileRoute } from "@tanstack/react-router";
import { routeQuote, resolveAsset } from "@/lib/market/router";
import { isEodhdConfigured, getEodhdExchanges } from "@/lib/market/providers/eodhd";
import { isMarketstackConfigured } from "@/lib/market/providers/marketstack";
import { getProviderConnected } from "@/lib/market/router";

interface CoverageItem {
  market: string;
  nameAr: string;
  connected: boolean;
  primaryProvider: string;
  fallbackProviders: string[];
  testedSymbol: string;
  lastPrice: number | null;
  lastProvider: string | null;
  lastError: string | null;
  /** Providers actually attempted in order (after capability + cooldown checks). */
  attempted: string[];
  /** Providers skipped before a network call (capability mismatch or cooldown). */
  skippedProviders: Array<{ provider: string; reason: string }>;
  /** Providers that were attempted but returned errors or invalid prices. */
  failedProviders: string[];
  /** Price validation rejections (e.g. "alphavantage: 3.68 rejected below floor 20"). */
  rejectedPrices: string[];
}

/**
 * Test symbols selected to exercise each asset class through the unified router.
 * primary/fallbacks are informational — actual routing follows CHAINS in router.ts.
 */
const TEST_SYMBOLS: Array<{
  market: string;
  nameAr: string;
  symbol: string;
  primary: string;
  fallbacks: string[];
}> = [
  { market: "us_stocks",    nameAr: "الأسهم الأمريكية",   symbol: "AAPL",    primary: "finnhub",      fallbacks: ["financialdata", "eodhd", "fmp"] },
  { market: "saudi_stocks", nameAr: "السوق السعودي",      symbol: "2222.SR", primary: "sahmk",        fallbacks: ["eodhd", "twelvedata", "fmp"] },
  { market: "crypto",       nameAr: "العملات الرقمية",   symbol: "BTCUSDT", primary: "binance",      fallbacks: ["coingecko", "financialdata"] },
  { market: "gold",         nameAr: "الذهب",              symbol: "XAUUSD",  primary: "twelvedata",   fallbacks: ["financialdata", "eodhd", "commodityprice", "fmp"] },
  { market: "silver",       nameAr: "الفضة",              symbol: "XAGUSD",  primary: "twelvedata",   fallbacks: ["financialdata", "eodhd", "commodityprice"] },
  // Oil: commodityprice first, TradingView removed (returned 404)
  { market: "oil_wti",      nameAr: "النفط WTI",          symbol: "WTI",     primary: "commodityprice", fallbacks: ["eodhd", "financialdata", "fmp", "alphavantage"] },
  { market: "oil_brent",    nameAr: "نفط برنت",           symbol: "BRENT",   primary: "commodityprice", fallbacks: ["eodhd", "financialdata", "fmp", "alphavantage"] },
  // Forex: finnhub removed (returned empty), twelvedata first
  { market: "forex",        nameAr: "سوق العملات",        symbol: "EURUSD",  primary: "twelvedata",   fallbacks: ["financialdata", "eodhd", "fmp", "alphavantage"] },
  { market: "hongkong",     nameAr: "هونغ كونغ",          symbol: "0700.HK", primary: "eodhd",        fallbacks: ["fmp", "yahoo"] },
  // UK: alphavantage first (.L→.LON), marketstack last (406 errors)
  { market: "uk",           nameAr: "بريطانيا",           symbol: "HSBA.L",  primary: "alphavantage", fallbacks: ["fmp", "eodhd", "twelvedata", "marketstack"] },
  // Europe: alphavantage first (.DE→.DEX), marketstack last
  { market: "europe",       nameAr: "أوروبا",             symbol: "SAP.DE",  primary: "alphavantage", fallbacks: ["fmp", "eodhd", "twelvedata", "marketstack"] },
];

export const Route = createFileRoute("/api/public/market-coverage")({
  server: {
    handlers: {
      GET: async () => {
        const coverage: CoverageItem[] = [];
        const connected = getProviderConnected();

        for (const t of TEST_SYMBOLS) {
          const resolved = resolveAsset(t.symbol);
          try {
            const q = await routeQuote(t.symbol);

            // Identify providers that were attempted but failed (attempted - skipped by capability - winner)
            const attempted = (q.attempted ?? []) as string[];
            const skipped = (q.skippedProviders ?? []) as Array<{ provider: string; reason: string }>;
            const winnerIdx = q.provider ? attempted.indexOf(q.provider) : -1;
            const failedProviders = winnerIdx > 0 ? attempted.slice(0, winnerIdx) : [];

            // Detect price rejections from the error string (PriceValidationError messages)
            const rejectedPrices: string[] = [];
            if (q.error && q.error.includes("rejected")) rejectedPrices.push(q.error);

            coverage.push({
              market: t.market,
              nameAr: t.nameAr,
              connected: q.success,
              primaryProvider: t.primary,
              fallbackProviders: t.fallbacks,
              testedSymbol: t.symbol,
              lastPrice: q.price,
              lastProvider: q.provider,
              lastError: q.error ?? null,
              attempted,
              skippedProviders: skipped,
              failedProviders,
              rejectedPrices,
            });
          } catch (e) {
            coverage.push({
              market: t.market,
              nameAr: t.nameAr,
              connected: false,
              primaryProvider: t.primary,
              fallbackProviders: t.fallbacks,
              testedSymbol: t.symbol,
              lastPrice: null,
              lastProvider: null,
              lastError: e instanceof Error ? e.message : "فشل الاتصال بالمزود",
              attempted: [],
              skippedProviders: [],
              failedProviders: [],
              rejectedPrices: [],
            });
          }
        }

        // GCC markets: not supported by current provider plan
        const gccMarkets: Record<string, { supported: boolean; note: string }> = {
          uae_adx: { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
          uae_dfm: { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
          kuwait:  { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
          qatar:   { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
          oman:    { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
          bahrain: { supported: false, note: "غير مدعوم في خطة مزود البيانات الحالية" },
        };

        // EODHD exchange discovery for GCC (only updates if EODHD key is configured and returns GCC exchanges)
        if (isEodhdConfigured()) {
          try {
            const exchanges = await getEodhdExchanges();
            const gccMap: Record<string, string[]> = {
              uae_adx: ["abu dhabi", "adx"],
              uae_dfm: ["dubai", "dfm"],
              kuwait:  ["kuwait", "boursa"],
              qatar:   ["qatar", "doha"],
              oman:    ["muscat", "oman"],
              bahrain: ["bahrain"],
            };
            for (const [key, keywords] of Object.entries(gccMap)) {
              const found = exchanges.some((ex) =>
                keywords.some((kw) => ex.Name.toLowerCase().includes(kw)),
              );
              if (found) {
                gccMarkets[key] = { supported: true, note: "مدعوم عبر EODHD" };
              }
            }
          } catch { /* discovery failed — keep all GCC as unsupported */ }
        }

        const connectedCount = coverage.filter((c) => c.connected).length;

        return new Response(
          JSON.stringify(
            {
              product: "ForeSmart",
              timestamp: new Date().toISOString(),
              eodhdConfigured: isEodhdConfigured(),
              marketstackConfigured: isMarketstackConfigured(),
              connectedProviders: connected,
              coverage,
              connectedCount,
              totalMarkets: coverage.length,
              gccMarkets,
              routingNotes: [
                "TradingView removed from commodity/metal chains (returned HTTP 404)",
                "Finnhub removed from forex chain (returned empty quote for OANDA pairs)",
                "UK stocks: alphavantage first (.L→.LON translation), marketstack last",
                "European stocks: alphavantage first (.DE→.DEX translation), marketstack last",
                "WTI/BRENT price validation: price < 20 USD is rejected and next provider tried",
                "EODHD/Marketstack/Yahoo now registered in capability matrix",
                "GCC markets: no attempt — not supported by current provider plan",
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
