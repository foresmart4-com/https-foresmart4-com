import { createFileRoute } from "@tanstack/react-router";
import { routeQuote, resolveAsset } from "@/lib/market/router";
import { isEodhdConfigured, getEodhdExchanges } from "@/lib/market/providers/eodhd";
import { isMarketstackConfigured } from "@/lib/market/providers/marketstack";

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
}

const TEST_SYMBOLS: Array<{ market: string; nameAr: string; symbol: string; primary: string; fallbacks: string[] }> = [
  { market: "us_stocks", nameAr: "الأسهم الأمريكية", symbol: "AAPL", primary: "finnhub", fallbacks: ["eodhd", "marketstack", "fmp"] },
  { market: "saudi_stocks", nameAr: "السوق السعودي", symbol: "2222.SR", primary: "sahmk", fallbacks: ["eodhd", "marketstack", "fmp"] },
  { market: "crypto", nameAr: "العملات الرقمية", symbol: "BTCUSDT", primary: "binance", fallbacks: ["coingecko", "eodhd"] },
  { market: "gold", nameAr: "الذهب", symbol: "XAUUSD", primary: "twelvedata", fallbacks: ["eodhd", "commodityprice", "fmp"] },
  { market: "silver", nameAr: "الفضة", symbol: "XAGUSD", primary: "twelvedata", fallbacks: ["eodhd", "commodityprice"] },
  { market: "oil_wti", nameAr: "النفط WTI", symbol: "WTI", primary: "eodhd", fallbacks: ["commodityprice", "fmp"] },
  { market: "oil_brent", nameAr: "نفط برنت", symbol: "BRENT", primary: "eodhd", fallbacks: ["commodityprice", "fmp"] },
  { market: "forex", nameAr: "سوق العملات", symbol: "EURUSD", primary: "twelvedata", fallbacks: ["eodhd", "fmp", "alphavantage"] },
  { market: "hongkong", nameAr: "هونغ كونغ", symbol: "0700.HK", primary: "eodhd", fallbacks: ["fmp", "yahoo"] },
  { market: "uk", nameAr: "بريطانيا", symbol: "HSBA.L", primary: "eodhd", fallbacks: ["marketstack", "fmp"] },
  { market: "europe", nameAr: "أوروبا", symbol: "SAP.DE", primary: "eodhd", fallbacks: ["marketstack", "fmp"] },
];

export const Route = createFileRoute("/api/public/market-coverage")({
  server: {
    handlers: {
      GET: async () => {
        const coverage: CoverageItem[] = [];

        for (const t of TEST_SYMBOLS) {
          try {
            const q = await routeQuote(t.symbol);
            coverage.push({
              market: t.market, nameAr: t.nameAr, connected: q.success,
              primaryProvider: t.primary, fallbackProviders: t.fallbacks,
              testedSymbol: t.symbol, lastPrice: q.price, lastProvider: q.provider,
              lastError: q.error ?? null,
            });
          } catch (e) {
            coverage.push({
              market: t.market, nameAr: t.nameAr, connected: false,
              primaryProvider: t.primary, fallbackProviders: t.fallbacks,
              testedSymbol: t.symbol, lastPrice: null, lastProvider: null,
              lastError: e instanceof Error ? e.message : "فشل الاتصال بالمزود",
            });
          }
        }

        const gccMarkets: Record<string, { supported: boolean; note: string }> = {
          uae_adx: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
          uae_dfm: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
          kuwait: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
          qatar: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
          oman: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
          bahrain: { supported: false, note: "غير مدعوم في خطة EODHD الحالية" },
        };

        if (isEodhdConfigured()) {
          try {
            const exchanges = await getEodhdExchanges();
            const gccMap: Record<string, string[]> = {
              uae_adx: ["abu dhabi", "adx"], uae_dfm: ["dubai", "dfm"],
              kuwait: ["kuwait", "boursa"], qatar: ["qatar", "doha"],
              oman: ["muscat", "oman"], bahrain: ["bahrain"],
            };
            for (const [key, keywords] of Object.entries(gccMap)) {
              const found = exchanges.some((ex) => keywords.some((kw) => ex.Name.toLowerCase().includes(kw)));
              if (found) gccMarkets[key] = { supported: true, note: "مدعوم عبر EODHD" };
            }
          } catch { /* discovery failed, keep defaults */ }
        }

        return new Response(JSON.stringify({
          product: "ForeSmart",
          timestamp: new Date().toISOString(),
          eodhdConfigured: isEodhdConfigured(),
          marketstackConfigured: isMarketstackConfigured(),
          coverage,
          connectedCount: coverage.filter((c) => c.connected).length,
          totalMarkets: coverage.length,
          gccMarkets,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
