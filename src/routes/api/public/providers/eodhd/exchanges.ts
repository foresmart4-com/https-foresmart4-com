import { createFileRoute } from "@tanstack/react-router";
import { getEodhdExchanges, isEodhdConfigured } from "@/lib/market/providers/eodhd";

const GCC_PATTERNS: Record<string, { keywords: string[]; country: string[] }> = {
  saudi: { keywords: ["tadawul", "saudi"], country: ["SA"] },
  uae_adx: { keywords: ["abu dhabi", "adx"], country: ["AE"] },
  uae_dfm: { keywords: ["dubai", "dfm"], country: ["AE"] },
  kuwait: { keywords: ["kuwait", "boursa"], country: ["KW"] },
  qatar: { keywords: ["qatar", "doha"], country: ["QA"] },
  oman: { keywords: ["muscat", "oman"], country: ["OM"] },
  bahrain: { keywords: ["bahrain"], country: ["BH"] },
};

export const Route = createFileRoute("/api/public/providers/eodhd/exchanges")({
  server: {
    handlers: {
      GET: async () => {
        const configured = isEodhdConfigured();
        if (!configured) {
          const empty = { supported: false, code: null, mic: null, name: "المفتاح غير مهيأ في بيئة الإنتاج" };
          return new Response(JSON.stringify({
            eodhdConfigured: false,
            gccMarkets: Object.fromEntries(Object.keys(GCC_PATTERNS).map((k) => [k, empty])),
          }, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
        }

        const exchanges = await getEodhdExchanges();
        const gccMarkets: Record<string, { supported: boolean; code: string | null; mic: string | null; name: string }> = {};

        for (const [key, patterns] of Object.entries(GCC_PATTERNS)) {
          const match = exchanges.find((ex) => {
            const name = ex.Name.toLowerCase();
            const country = ex.CountryISO2?.toUpperCase();
            return patterns.keywords.some((kw) => name.includes(kw)) || patterns.country.includes(country);
          });
          gccMarkets[key] = match
            ? { supported: true, code: match.Code, mic: match.Code, name: match.Name }
            : { supported: false, code: null, mic: null, name: "غير مدعوم في الخطة الحالية" };
        }

        return new Response(JSON.stringify({
          eodhdConfigured: true,
          totalExchanges: exchanges.length,
          gccMarkets,
        }, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
      },
    },
  },
});
