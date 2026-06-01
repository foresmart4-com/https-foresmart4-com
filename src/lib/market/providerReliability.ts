/**
 * Provider and market reliability classification.
 *
 * Based on credential validation performed 2026-05-30 (commit ea87c24):
 *   reliable   = credential valid, data confirmed working in production
 *   degraded   = credential valid but data limited (plan/symbol restrictions)
 *   restricted = credential invalid (HTTP 401/402/403) — key must be renewed
 *   unavailable = unreachable, not configured, or permanently failing
 *
 * ─── GENESIS DECISION ENGINE NOTE ───────────────────────────────────────────
 * A Genesis decision MUST NOT use providers or markets marked:
 *   - "restricted"  — credentials are invalid; data cannot be trusted
 *   - "unavailable" — no data available at all
 * as primary evidence for investment recommendations.
 *
 * Markets marked "degraded" may be referenced only with explicit caveats
 * about data completeness. Markets marked "reliable" are safe to use as
 * primary evidence when their tested price is current and within bounds.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ProviderStatus = "reliable" | "degraded" | "restricted" | "unavailable";
export type MarketStatus   = "reliable" | "degraded" | "unavailable" | "unsupported";

export interface ProviderReliability {
  provider:                 string;
  status:                   ProviderStatus;
  reasonAr:                 string;
  allowedForDecisionEngine: boolean;
}

export interface MarketReliability {
  market:                   string;
  nameAr:                   string;
  status:                   MarketStatus;
  primaryProvider:          string | null;
  reasonAr:                 string;
  allowedForDecisionEngine: boolean;
}

/** Statuses that disqualify a source from Genesis decision-engine usage. */
export const GENESIS_BLOCKED_STATUSES = new Set<ProviderStatus | MarketStatus>([
  "restricted",
  "unavailable",
]);

export function isAllowedForGenesisDecision(status: ProviderStatus | MarketStatus): boolean {
  return !GENESIS_BLOCKED_STATUSES.has(status);
}

// ─── Provider reliability map ────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, ProviderReliability> = {
  finnhub: {
    provider: "finnhub",
    status: "reliable",
    reasonAr: "المفتاح صالح — يُعيد أسعار الأسهم الأمريكية مباشرةً (HTTP 200 مُأكّد)",
    allowedForDecisionEngine: true,
  },
  alphavantage: {
    provider: "alphavantage",
    status: "reliable",
    reasonAr: "المفتاح صالح — يُعيد أسعار الأسهم وأسعار صرف العملات (EURUSD: 1.166 مُأكّد)",
    allowedForDecisionEngine: true,
  },
  alphavantage_forex: {
    provider: "alphavantage_forex",
    status: "reliable",
    reasonAr: "CURRENCY_EXCHANGE_RATE يعمل — EURUSD مُأكّد (1.166)",
    allowedForDecisionEngine: true,
  },
  eodhd: {
    provider: "eodhd",
    status: "reliable",
    reasonAr: "المفتاح صالح — بيانات نهاية اليوم لمعظم الأسواق (AAPL.US مُأكّد)",
    allowedForDecisionEngine: true,
  },
  sahmk: {
    provider: "sahmk",
    status: "reliable",
    reasonAr: "المفتاح صالح — بيانات السوق السعودي متاحة (2222.SR مُأكّد)",
    allowedForDecisionEngine: true,
  },
  newsapi: {
    provider: "newsapi",
    status: "reliable",
    reasonAr: "المفتاح صالح عبر NEWS_API_KEY — أخبار مالية متاحة (top-headlines مُأكّد)",
    allowedForDecisionEngine: true,
  },
  binance: {
    provider: "binance",
    status: "reliable",
    reasonAr: "لا يحتاج مفتاحاً — بيانات العملات الرقمية في الوقت الفعلي دائماً متاحة",
    allowedForDecisionEngine: true,
  },
  coingecko: {
    provider: "coingecko",
    status: "reliable",
    reasonAr: "لا يحتاج مفتاحاً — بيانات العملات الرقمية متاحة (BTC مُأكّد)",
    allowedForDecisionEngine: true,
  },
  fred: {
    provider: "fred",
    status: "reliable",
    reasonAr: "Federal Reserve Economic Data — بيانات الاقتصاد الكلي الأمريكي موثوقة",
    allowedForDecisionEngine: true,
  },
  marketstack: {
    provider: "marketstack",
    status: "degraded",
    reasonAr: "المفتاح صالح للأسهم الأمريكية فقط — تُعيد HTTP 406 للأسهم الأوروبية والآسيوية على الخطة الحالية",
    allowedForDecisionEngine: false,
  },
  twelvedata: {
    provider: "twelvedata",
    status: "restricted",
    reasonAr: "المفتاح مرفوض من المزود (HTTP 401) — يجب تحديث TWELVEDATA_API_KEY في Railway من twelvedata.com/pricing",
    allowedForDecisionEngine: false,
  },
  fmp: {
    provider: "fmp",
    status: "restricted",
    reasonAr: "المفتاح محظور (HTTP 403) — الخطة أو المفتاح لا يسمح بالوصول. يجب تحديث FMP_API_KEY من financialmodelingprep.com",
    allowedForDecisionEngine: false,
  },
  commodityprice: {
    provider: "commodityprice",
    status: "reliable",
    reasonAr: "المفتاح صالح — بيانات النفط والمعادن متاحة (COMMODITYPRICE_API_KEY مُأكّد في Railway)",
    allowedForDecisionEngine: true,
  },
  financialdata: {
    provider: "financialdata",
    status: "unavailable",
    reasonAr: "المزود غير متاح من بيئة الإنتاج — انتهاء مهلة الاتصال في جميع الطلبات",
    allowedForDecisionEngine: false,
  },
  tradingview: {
    provider: "tradingview",
    status: "degraded",
    reasonAr: "TradingView أُزيل من سلاسل السلع والمعادن (كان يُعيد HTTP 404) — يُستخدم للمؤشرات فقط",
    allowedForDecisionEngine: false,
  },
  yahoo: {
    provider: "yahoo",
    status: "degraded",
    reasonAr: "Yahoo Finance لا يحتاج مفتاحاً لكنه قد يواجه قيوداً متكررة — احتياطي للأسهم فقط",
    allowedForDecisionEngine: false,
  },
  alpaca: {
    provider: "alpaca",
    status: "unavailable",
    reasonAr: "ALPACA_KEY_ID غير مهيأ في بيئة الإنتاج",
    allowedForDecisionEngine: false,
  },
};

export function getProviderReliability(providerId: string): ProviderReliability {
  return PROVIDER_MAP[providerId] ?? {
    provider: providerId,
    status: "unavailable",
    reasonAr: "مزود غير معروف أو غير مهيأ",
    allowedForDecisionEngine: false,
  };
}

export function getAllProviderReliabilities(): Record<string, ProviderReliability> {
  return { ...PROVIDER_MAP };
}

// ─── Market reliability map ──────────────────────────────────────────────────
// Keys match the `market` field in market-coverage TEST_SYMBOLS for easy lookup.

const MARKET_MAP: Record<string, MarketReliability> = {
  us_stocks: {
    market: "us_stocks",
    nameAr: "الأسهم الأمريكية",
    status: "reliable",
    primaryProvider: "finnhub",
    reasonAr: "Finnhub يُعيد أسعار مباشرة — AAPL: $312 مُأكّد",
    allowedForDecisionEngine: true,
  },
  saudi_stocks: {
    market: "saudi_stocks",
    nameAr: "السوق السعودي",
    status: "reliable",
    primaryProvider: "sahmk",
    reasonAr: "SAHMK يُعيد بيانات موثوقة — 2222.SR: 27.9 مُأكّد",
    allowedForDecisionEngine: true,
  },
  crypto: {
    market: "crypto",
    nameAr: "العملات الرقمية",
    status: "reliable",
    primaryProvider: "binance",
    reasonAr: "Binance وCoinGecko يعملان بدون مفتاح — BTC: $73,829 مُأكّد",
    allowedForDecisionEngine: true,
  },
  forex: {
    market: "forex",
    nameAr: "سوق العملات الأجنبية",
    status: "reliable",
    primaryProvider: "alphavantage",
    reasonAr: "AlphaVantage CURRENCY_EXCHANGE_RATE يعمل — EURUSD: 1.166 مُأكّد",
    allowedForDecisionEngine: true,
  },
  gold: {
    market: "gold",
    nameAr: "الذهب",
    status: "degraded",
    primaryProvider: "eodhd",
    reasonAr: "EODHD يُعيد بيانات الذهب (GC.COMM) وCommodityPriceAPI نشط — TwelveData 401 وFMP 403 لا تزال مقيّدة",
    allowedForDecisionEngine: true,
  },
  silver: {
    market: "silver",
    nameAr: "الفضة",
    status: "degraded",
    primaryProvider: "eodhd",
    reasonAr: "EODHD يُعيد بيانات الفضة (SI.COMM) وCommodityPriceAPI نشط — TwelveData 401 وFMP 403 لا تزال مقيّدة",
    allowedForDecisionEngine: true,
  },
  oil_wti: {
    market: "oil_wti",
    nameAr: "النفط WTI",
    status: "degraded",
    primaryProvider: "commodityprice",
    reasonAr: "CommodityPriceAPI نشط (COMMODITYPRICE_API_KEY مُأكّد) وEODHD احتياطي (CL.COMM) — بيانات متأخرة",
    allowedForDecisionEngine: true,
  },
  oil_brent: {
    market: "oil_brent",
    nameAr: "نفط برنت",
    status: "degraded",
    primaryProvider: "commodityprice",
    reasonAr: "CommodityPriceAPI نشط (COMMODITYPRICE_API_KEY مُأكّد) وEODHD احتياطي (BZ.COMM) — بيانات متأخرة",
    allowedForDecisionEngine: true,
  },
  europe: {
    market: "europe",
    nameAr: "الأسهم الأوروبية",
    status: "degraded",
    primaryProvider: "alphavantage",
    reasonAr: "AlphaVantage يحاول SAP.DEX لكن يُعيد سعراً فارغاً — EODHD لم يُأكّد دعم الخطة للأسهم الأوروبية",
    allowedForDecisionEngine: false,
  },
  uk: {
    market: "uk",
    nameAr: "الأسهم البريطانية",
    status: "degraded",
    primaryProvider: "alphavantage",
    reasonAr: "AlphaVantage يحاول HSBA.LON لكن يُعيد سعراً فارغاً — لم يُؤكّد أي مزود بعد",
    allowedForDecisionEngine: false,
  },
  hongkong: {
    market: "hongkong",
    nameAr: "أسهم هونغ كونغ",
    status: "degraded",
    primaryProvider: "eodhd",
    reasonAr: "EODHD يحاول لكن لم يُأكّد نجاحه — TwelveData 401 يمنع الاحتياط الرئيسي",
    allowedForDecisionEngine: false,
  },
  gcc: {
    market: "gcc",
    nameAr: "أسواق الخليج",
    status: "unsupported",
    primaryProvider: null,
    reasonAr: "أسواق الخليج غير مدعومة في خطط المزودين الحاليين",
    allowedForDecisionEngine: false,
  },
};

export function getMarketReliability(market: string): MarketReliability {
  return MARKET_MAP[market] ?? {
    market,
    nameAr: market,
    status: "unavailable",
    primaryProvider: null,
    reasonAr: "سوق غير معروف",
    allowedForDecisionEngine: false,
  };
}

export function getAllMarketReliabilities(): Record<string, MarketReliability> {
  return { ...MARKET_MAP };
}
