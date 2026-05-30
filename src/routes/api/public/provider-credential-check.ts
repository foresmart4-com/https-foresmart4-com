import { createFileRoute } from "@tanstack/react-router";

// Server-side credential validation for all market data providers.
// Makes one real lightweight HTTP request per provider with a 5-second timeout.
// Never exposes API keys or partial keys in any field.

type ErrorType =
  | "missing_key"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "unsupported_symbol"
  | "empty_quote"
  | "network_error"
  | "plan_restriction"
  | "ok";

interface ProviderResult {
  provider: string;
  configured: boolean;
  credentialValid: boolean;
  httpStatus: number | null;
  testSymbol: string;
  endpointType: string;
  errorType: ErrorType;
  messageAr: string;
  recommendedActionAr: string;
}

const RECOMMENDED: Partial<Record<string, string>> = {
  finnhub_ok:                   "لا توجد إجراءات مطلوبة — المزود يعمل بشكل صحيح",
  finnhub_unauthorized:         "قم بتحديث FINNHUB_API_KEY في Railway بمفتاح جديد من finnhub.io",
  twelvedata_unauthorized:      "قم بتحديث TWELVEDATA_API_KEY في Railway — المفتاح الحالي مرفوض (HTTP 401). احصل على مفتاح جديد من twelvedata.com/pricing",
  alphavantage_unauthorized:    "قم بتحديث ALPHAVANTAGE_API_KEY في Railway بمفتاح جديد من alphavantage.co",
  alphavantage_rate_limited:    "تجاوزت حد الطلبات على AlphaVantage (5 طلبات/دقيقة) — انتظر دقيقة ثم أعد المحاولة",
  eodhd_unauthorized:           "قم بتحديث EODHD_API_KEY في Railway بمفتاح جديد من eodhd.com",
  marketstack_ok:               "المزود يعمل — ملاحظة: الخطة الحالية تدعم US stocks فقط وتُعيد 406 للأسهم الأوروبية/الآسيوية",
  marketstack_plan_restriction: "قم بترقية خطة Marketstack لتشمل البيانات الدولية أو استخدم EODHD/AlphaVantage للأسهم الأوروبية",
  fmp_forbidden:                "قم بتجديد FMP_API_KEY في Railway — المفتاح يُعيد HTTP 403. قم بتحديثه من financialmodelingprep.com",
  financialdata_network_error:  "المزود FinancialData غير متاح — تحقق من إمكانية الوصول أو أزل المفتاح من البيئة إذا كانت الخدمة متوقفة",
  commodityprice_plan_restriction: "قم بتجديد الاشتراك في CommodityPriceAPI — تُعيد HTTP 402 (الدفع مطلوب). الرابط: commoditypriceapi.com",
  sahmk_ok:                     "لا توجد إجراءات مطلوبة — بيانات السوق السعودي تعمل بشكل صحيح",
  newsapi_missing_key:          "أضف NEWSAPI_KEY أو NEWS_API_KEY في متغيرات Railway من newsapi.org",
  newsapi_unauthorized:         "قم بتحديث NEWSAPI_KEY في Railway بمفتاح صالح من newsapi.org",
};

function getRecommendedActionAr(provider: string, errorType: ErrorType): string {
  const specific = RECOMMENDED[`${provider}_${errorType}`];
  if (specific) return specific;
  switch (errorType) {
    case "ok":               return "لا توجد إجراءات مطلوبة — المزود يعمل بشكل صحيح";
    case "missing_key":      return `أضف مفتاح API الخاص بـ ${provider} في متغيرات البيئة في Railway`;
    case "unauthorized":     return `قم بتحديث مفتاح ${provider.toUpperCase()}_API_KEY في Railway بمفتاح جديد من لوحة تحكم المزود`;
    case "forbidden":        return `قم بترقية خطة ${provider} أو تجديد صلاحيات المفتاح في لوحة تحكم المزود`;
    case "plan_restriction": return `قم بترقية خطة ${provider} أو تجديد الاشتراك للوصول إلى هذه البيانات`;
    case "rate_limited":     return "تجاوز حد الطلبات — انتظر دقيقة ثم أعد المحاولة";
    case "network_error":    return `تحقق من إمكانية الوصول إلى خوادم ${provider} — قد يكون الموقع معطلاً`;
    case "empty_quote":      return `المزود متاح لكن الرمز المختبر لم يُعيد سعراً — قد يكون الرمز غير مدعوم في الخطة الحالية`;
    default:                 return "راجع لوحة تحكم المزود لمزيد من المعلومات";
  }
}

const AR: Record<ErrorType, string> = {
  ok:               "يعمل بشكل صحيح",
  missing_key:      "مفتاح API غير مهيأ في بيئة الإنتاج",
  unauthorized:     "المفتاح موجود لكنه غير مقبول من المزود — تحقق من صحة المفتاح أو تاريخ انتهاء صلاحيته",
  forbidden:        "المفتاح غير مصرح له بهذه العملية أو الخطة لا تدعم هذا الطلب",
  rate_limited:     "تجاوز حد معدل الطلبات — حاول لاحقاً",
  unsupported_symbol: "الرمز غير مدعوم من هذا المزود",
  empty_quote:      "المزود متاح لكن لم يُعيد بيانات سعر للرمز المطلوب",
  network_error:    "خطأ في الشبكة أو انتهاء مهلة الاتصال بالمزود",
  plan_restriction: "الخطة الحالية لا تدعم هذا الطلب — قد يلزم ترقية الاشتراك",
};

// Direct probe — no retry, no cache, 5 s timeout.
async function probe(url: string, init: RequestInit = {}): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } catch {
    return { status: 0, text: "" };
  } finally {
    clearTimeout(id);
  }
}

function fromStatus(status: number): ErrorType {
  if (status === 0)                      return "network_error";
  if (status === 401)                    return "unauthorized";
  if (status === 402)                    return "plan_restriction";
  if (status === 403)                    return "forbidden";
  if (status === 406 || status === 426)  return "plan_restriction";
  if (status === 429)                    return "rate_limited";
  return "network_error";
}

function pass(provider: string, sym: string, ep: string): ProviderResult {
  return { provider, configured: true, credentialValid: true, httpStatus: 200, testSymbol: sym, endpointType: ep, errorType: "ok", messageAr: AR.ok, recommendedActionAr: getRecommendedActionAr(provider, "ok") };
}
function deny(provider: string, configured: boolean, httpStatus: number | null, sym: string, ep: string, errorType: ErrorType): ProviderResult {
  return { provider, configured, credentialValid: false, httpStatus, testSymbol: sym, endpointType: ep, errorType, messageAr: AR[errorType], recommendedActionAr: getRecommendedActionAr(provider, errorType) };
}
function noKey(provider: string, sym: string, ep: string): ProviderResult {
  return deny(provider, false, null, sym, ep, "missing_key");
}

// ─── Per-provider checks ──────────────────────────────────────────────────────

async function checkFinnhub(): Promise<ProviderResult> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return noKey("finnhub", "AAPL", "quote");
  const { status, text } = await probe(
    `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { c?: unknown };
      if (typeof j.c === "number" && j.c > 0) return pass("finnhub", "AAPL", "quote");
      return deny("finnhub", true, 200, "AAPL", "quote", "empty_quote");
    } catch { return deny("finnhub", true, 200, "AAPL", "quote", "empty_quote"); }
  }
  return deny("finnhub", true, status || null, "AAPL", "quote", fromStatus(status));
}

async function checkTwelveData(): Promise<ProviderResult> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return noKey("twelvedata", "AAPL", "quote");
  const { status, text } = await probe(
    `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { status?: string; code?: number; close?: string };
      if (j.status === "error") {
        const et: ErrorType = j.code === 401 || j.code === 403 ? "unauthorized" : "empty_quote";
        return deny("twelvedata", true, 200, "AAPL", "quote", et);
      }
      const p = parseFloat(j.close ?? "");
      if (p > 0) return pass("twelvedata", "AAPL", "quote");
      return deny("twelvedata", true, 200, "AAPL", "quote", "empty_quote");
    } catch { return deny("twelvedata", true, 200, "AAPL", "quote", "empty_quote"); }
  }
  // TwelveData returns HTTP 401 for invalid/missing API key
  return deny("twelvedata", true, status || null, "AAPL", "quote", fromStatus(status));
}

async function checkAlphaVantage(): Promise<ProviderResult> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return noKey("alphavantage", "AAPL", "GLOBAL_QUOTE");
  const { status, text } = await probe(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as {
        "Global Quote"?: { "05. price"?: string };
        "Error Message"?: string;
        Note?: string;
        Information?: string;
      };
      if (j["Error Message"]) return deny("alphavantage", true, 200, "AAPL", "GLOBAL_QUOTE", "unauthorized");
      if (j.Note || j.Information) return deny("alphavantage", true, 200, "AAPL", "GLOBAL_QUOTE", "rate_limited");
      const p = parseFloat(j["Global Quote"]?.["05. price"] ?? "");
      if (p > 0) return pass("alphavantage", "AAPL", "GLOBAL_QUOTE");
      return deny("alphavantage", true, 200, "AAPL", "GLOBAL_QUOTE", "empty_quote");
    } catch { return deny("alphavantage", true, 200, "AAPL", "GLOBAL_QUOTE", "empty_quote"); }
  }
  return deny("alphavantage", true, status || null, "AAPL", "GLOBAL_QUOTE", fromStatus(status));
}

async function checkAlphaVantageForex(): Promise<ProviderResult> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return noKey("alphavantage_forex", "EURUSD", "CURRENCY_EXCHANGE_RATE");
  const { status, text } = await probe(
    `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=EUR&to_currency=USD&apikey=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as {
        "Realtime Currency Exchange Rate"?: { "5. Exchange Rate"?: string };
        "Error Message"?: string;
        Note?: string;
        Information?: string;
      };
      if (j["Error Message"]) return deny("alphavantage_forex", true, 200, "EURUSD", "CURRENCY_EXCHANGE_RATE", "unauthorized");
      if (j.Note || j.Information) return deny("alphavantage_forex", true, 200, "EURUSD", "CURRENCY_EXCHANGE_RATE", "rate_limited");
      const r = parseFloat(j["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] ?? "");
      if (r > 0) return pass("alphavantage_forex", "EURUSD", "CURRENCY_EXCHANGE_RATE");
      return deny("alphavantage_forex", true, 200, "EURUSD", "CURRENCY_EXCHANGE_RATE", "empty_quote");
    } catch { return deny("alphavantage_forex", true, 200, "EURUSD", "CURRENCY_EXCHANGE_RATE", "empty_quote"); }
  }
  return deny("alphavantage_forex", true, status || null, "EURUSD", "CURRENCY_EXCHANGE_RATE", fromStatus(status));
}

async function checkEodhd(): Promise<ProviderResult> {
  const key = process.env.EODHD_API_KEY;
  if (!key) return noKey("eodhd", "AAPL.US", "real-time");
  const { status, text } = await probe(
    `https://eodhd.com/api/real-time/AAPL.US?api_token=${encodeURIComponent(key)}&fmt=json`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { close?: unknown; previousClose?: unknown };
      const price = Number(j.close ?? j.previousClose ?? 0);
      if (price > 0) return pass("eodhd", "AAPL.US", "real-time");
      return deny("eodhd", true, 200, "AAPL.US", "real-time", "empty_quote");
    } catch { return deny("eodhd", true, 200, "AAPL.US", "real-time", "empty_quote"); }
  }
  return deny("eodhd", true, status || null, "AAPL.US", "real-time", fromStatus(status));
}

async function checkMarketstack(): Promise<ProviderResult> {
  const key = process.env.MARKETSTACK_API_KEY;
  if (!key) return noKey("marketstack", "AAPL", "eod/latest");
  // Uses HTTP (not HTTPS) — Marketstack free tier requires HTTP
  const { status, text } = await probe(
    `http://api.marketstack.com/v1/eod/latest?access_key=${encodeURIComponent(key)}&symbols=AAPL&limit=1`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { data?: Array<{ close?: unknown }>; error?: { message?: string } };
      if (j.error) return deny("marketstack", true, 200, "AAPL", "eod/latest", "unauthorized");
      const price = Number(j.data?.[0]?.close ?? 0);
      if (price > 0) return pass("marketstack", "AAPL", "eod/latest");
      return deny("marketstack", true, 200, "AAPL", "eod/latest", "empty_quote");
    } catch { return deny("marketstack", true, 200, "AAPL", "eod/latest", "empty_quote"); }
  }
  return deny("marketstack", true, status || null, "AAPL", "eod/latest", fromStatus(status));
}

async function checkFmp(): Promise<ProviderResult> {
  const key = process.env.FMP_API_KEY;
  if (!key) return noKey("fmp", "AAPL", "quote");
  const { status, text } = await probe(
    `https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j) && j.length > 0) {
        const price = Number((j[0] as { price?: unknown }).price ?? 0);
        if (price > 0) return pass("fmp", "AAPL", "quote");
      }
      return deny("fmp", true, 200, "AAPL", "quote", "empty_quote");
    } catch { return deny("fmp", true, 200, "AAPL", "quote", "empty_quote"); }
  }
  return deny("fmp", true, status || null, "AAPL", "quote", fromStatus(status));
}

async function checkFinancialData(): Promise<ProviderResult> {
  const key = process.env.FINANCIALDATA_API_KEY;
  if (!key) return noKey("financialdata", "AAPL", "v1/quote");
  // Try the primary path — same headers as the provider
  const { status, text } = await probe(
    `https://api.financialdata.net/v1/quote?symbol=AAPL&apikey=${encodeURIComponent(key)}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${key}`, "X-API-Key": key } }
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text);
      // pickRow logic: extract price from various response shapes
      let row: Record<string, unknown> | null = null;
      if (Array.isArray(j) && j.length > 0) row = j[0] as Record<string, unknown>;
      else if (j && typeof j === "object") {
        const obj = j as Record<string, unknown>;
        for (const k of ["data", "quote", "result", "results"]) {
          const v = obj[k];
          if (Array.isArray(v) && v.length > 0) { row = v[0] as Record<string, unknown>; break; }
          if (v && typeof v === "object") { row = v as Record<string, unknown>; break; }
        }
        if (!row) row = obj;
      }
      const price = Number(row?.price ?? row?.last ?? row?.close ?? row?.c ?? 0);
      if (price > 0) return pass("financialdata", "AAPL", "v1/quote");
      return deny("financialdata", true, 200, "AAPL", "v1/quote", "empty_quote");
    } catch { return deny("financialdata", true, 200, "AAPL", "v1/quote", "empty_quote"); }
  }
  return deny("financialdata", true, status || null, "AAPL", "v1/quote", fromStatus(status));
}

async function checkCommodityPrice(): Promise<ProviderResult> {
  const key = process.env.COMMODITYPRICE_API_KEY ?? process.env.COMMODITYPRICEAPI_KEY;
  if (!key) return noKey("commodityprice", "WTI (WTIOIL-FUT)", "rates/latest");
  const { status, text } = await probe(
    "https://api.commoditypriceapi.com/v2/rates/latest?symbols=WTIOIL-FUT",
    { headers: { "x-api-key": key, Accept: "application/json" } }
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as {
        rates?: Record<string, number>;
        data?: Record<string, { price?: number }>;
      };
      const price = j.rates?.["WTIOIL-FUT"] ?? j.data?.["WTIOIL-FUT"]?.price ?? 0;
      if (Number(price) > 0) return pass("commodityprice", "WTI (WTIOIL-FUT)", "rates/latest");
      return deny("commodityprice", true, 200, "WTI (WTIOIL-FUT)", "rates/latest", "empty_quote");
    } catch { return deny("commodityprice", true, 200, "WTI (WTIOIL-FUT)", "rates/latest", "empty_quote"); }
  }
  return deny("commodityprice", true, status || null, "WTI (WTIOIL-FUT)", "rates/latest", fromStatus(status));
}

async function checkSahmk(): Promise<ProviderResult> {
  const key = process.env.SAHMK_API_KEY;
  if (!key) return noKey("sahmk", "2222.SR", "quote");
  const { status, text } = await probe(
    "https://app.sahmk.sa/api/v1/quote/2222/",
    { headers: { "X-API-Key": key, Accept: "application/json" } }
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { price?: unknown };
      const price = Number(j.price ?? 0);
      if (price > 0) return pass("sahmk", "2222.SR", "quote");
      return deny("sahmk", true, 200, "2222.SR", "quote", "empty_quote");
    } catch { return deny("sahmk", true, 200, "2222.SR", "quote", "empty_quote"); }
  }
  return deny("sahmk", true, status || null, "2222.SR", "quote", fromStatus(status));
}

async function checkNewsApi(): Promise<ProviderResult> {
  // Support both NEWSAPI_KEY and NEWS_API_KEY — some environments use the underscore variant
  const key = process.env.NEWSAPI_KEY ?? process.env.NEWS_API_KEY;
  if (!key) return noKey("newsapi", "top-headlines (country=us)", "top-headlines");
  const { status, text } = await probe(
    `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${encodeURIComponent(key)}`
  );
  if (status === 200) {
    try {
      const j = JSON.parse(text) as { status?: string; articles?: unknown[]; code?: string };
      if (j.status === "ok" && Array.isArray(j.articles)) {
        return pass("newsapi", "top-headlines (country=us)", "top-headlines");
      }
      const et: ErrorType =
        j.code === "apiKeyInvalid" || j.code === "apiKeyDisabled" ? "unauthorized"
        : j.code === "rateLimited"   ? "rate_limited"
        : j.code === "apiKeyExhausted" ? "plan_restriction"
        : "empty_quote";
      return deny("newsapi", true, 200, "top-headlines (country=us)", "top-headlines", et);
    } catch { return deny("newsapi", true, 200, "top-headlines (country=us)", "top-headlines", "empty_quote"); }
  }
  if (status === 426) return deny("newsapi", true, 426, "top-headlines (country=us)", "top-headlines", "plan_restriction");
  return deny("newsapi", true, status || null, "top-headlines (country=us)", "top-headlines", fromStatus(status));
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/provider-credential-check")({
  server: {
    handlers: {
      GET: async () => {
        const results = await Promise.allSettled([
          checkFinnhub(),
          checkTwelveData(),
          checkAlphaVantage(),
          checkAlphaVantageForex(),
          checkEodhd(),
          checkMarketstack(),
          checkFmp(),
          checkFinancialData(),
          checkCommodityPrice(),
          checkSahmk(),
          checkNewsApi(),
        ]);

        const NAMES = [
          "finnhub", "twelvedata", "alphavantage", "alphavantage_forex",
          "eodhd", "marketstack", "fmp", "financialdata",
          "commodityprice", "sahmk", "newsapi",
        ];

        const providers: ProviderResult[] = results.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          return deny(NAMES[i] ?? `check_${i}`, true, null, "unknown", "unknown", "network_error");
        });

        const validCount   = providers.filter((p) => p.credentialValid).length;
        const configuredCount = providers.filter((p) => p.configured).length;

        return new Response(
          JSON.stringify({
            ok: validCount > 0,
            testedAt: new Date().toISOString(),
            summary: {
              configured: configuredCount,
              credentialValid: validCount,
              total: providers.length,
            },
            providers,
          }, null, 2),
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
