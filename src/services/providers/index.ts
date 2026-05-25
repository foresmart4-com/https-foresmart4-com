/**
 * Unified provider facade — server-side only.
 *
 * Routing policy:
 *  - US Quotes/markets: Finnhub → TwelveData → AlphaVantage
 *  - Saudi Quotes:      SAHMK → TwelveData → AlphaVantage
 *  - Macro:             AlphaVantage → Finnhub
 *  - News:              NewsAPI
 */

import {
  getQuote as fhQuote,
  getCompanyNews as fhCompanyNews,
  getGeneralNews as fhGeneralNews,
  getEarningsCalendar as fhEarnings,
  getMarketStatus as fhMarketStatus,
  providerHealth as fhHealth,
} from "@/services/providers/finnhub";

import {
  getQuote as tdQuote,
  getRealtimePrice as tdPrice,
  getMarketState as tdMarketState,
  providerHealth as tdHealth,
} from "@/services/providers/twelvedata";

import {
  getEquityQuote as avQuote,
  getFxRate as avFx,
  getMacroSnapshot as avMacro,
  providerHealth as avHealth,
} from "@/services/providers/alphavantage";

import {
  getQuote as sahmkQuote,
  providerHealth as sahmkHealth,
} from "@/services/providers/sahmk";

import {
  getFinancialFeed as naFinancialFeed,
  providerHealth as naHealth,
} from "@/services/providers/newsapi";

export const providers = {
  // US / global market primary
  quote: fhQuote,
  companyNews: fhCompanyNews,
  generalNews: fhGeneralNews,
  earnings: fhEarnings,
  marketStatus: fhMarketStatus,

  // Saudi market
  saudiQuote: sahmkQuote,

  // Backups
  backupQuote: tdQuote,
  backupPrice: tdPrice,
  backupMarketState: tdMarketState,

  // Macro
  macroSnapshot: avMacro,
  macroFx: avFx,
  macroEquity: avQuote,

  // News
  newsFinancial: naFinancialFeed,
};

/** Aggregated health for all wired providers. */
export function allProvidersHealth() {
  return {
    finnhub: fhHealth(),
    twelvedata: tdHealth(),
    alphavantage: avHealth(),
    newsapi: naHealth(),
    sahmk: sahmkHealth(),
  };
}

type ProviderId =
  | "finnhub"
  | "twelvedata"
  | "alphavantage"
  | "newsapi"
  | "sahmk"
  | "unavailable";

type FailoverEvent = {
  ts: number;
  kind: "market" | "macro" | "saudi";
  primary: ProviderId;
  chosen: ProviderId;
  reason: string;
};

const FAILOVER_LOG: FailoverEvent[] = [];

function logFailover(e: FailoverEvent) {
  FAILOVER_LOG.push(e);
  if (FAILOVER_LOG.length > 200) FAILOVER_LOG.splice(0, FAILOVER_LOG.length - 200);
  console.info(
    `[providers.failover] kind=${e.kind} primary=${e.primary} chosen=${e.chosen} reason="${e.reason}"`,
  );
}

export function lastFailoverEvents(limit = 50): FailoverEvent[] {
  return FAILOVER_LOG.slice(-limit).reverse();
}

// ---------- Unified quote result ----------

/** Structured quote response returned by all resilient routing helpers. */
export interface QuoteResult {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  provider: "sahmk" | "twelvedata" | "alphavantage" | "finnhub" | "unavailable";
  source: "live" | "delayed" | "unavailable";
  live: boolean;
  delayed: boolean;
  lastError: string | null;
  fallbackUsed: boolean;
  /** Arabic user-facing message emitted when a fallback provider was used. */
  fallbackMessage?: string;
  timestamp: number;
}

const ARABIC_FALLBACK = "مزود السوق غير متاح حالياً، تم استخدام مزود بديل.";

// ---------- Resilient Saudi quote: SAHMK → TwelveData → AlphaVantage ----------

/**
 * Fetch a Saudi stock quote with automatic fallback.
 * Never throws — always returns a QuoteResult (possibly with price: null).
 */
export async function getSaudiQuote(symbol: string): Promise<QuoteResult> {
  const now = Date.now();
  const errors: string[] = [];

  // 1. SAHMK (primary — real-time or intraday-delayed Saudi feed)
  if (process.env.SAHMK_API_KEY) {
    const r = await sahmkQuote(symbol);
    if (r.price !== null) {
      return {
        symbol: r.symbol,
        price: r.price,
        changePercent: r.changePercent,
        volume: r.volume,
        provider: "sahmk",
        source: r.source,
        live: r.live,
        delayed: r.delayed,
        lastError: r.lastError,
        fallbackUsed: false,
        timestamp: r.timestamp,
      };
    }
    if (r.lastError) errors.push(`sahmk: ${r.lastError}`);
  }

  // 2. TwelveData (delayed — 15-20 min, global EOD coverage)
  if (process.env.TWELVEDATA_API_KEY) {
    try {
      const q = await tdQuote(symbol);
      const price = parseFloat(q.close ?? "0");
      if (price > 0) {
        logFailover({ ts: now, kind: "saudi", primary: "sahmk", chosen: "twelvedata", reason: errors.join("; ") || "SAHMK unavailable" });
        return {
          symbol,
          price,
          changePercent: parseFloat(q.percent_change ?? "0") || null,
          volume: parseFloat(q.volume ?? "0") || null,
          provider: "twelvedata",
          source: "delayed",
          live: false,
          delayed: true,
          lastError: errors[0] ?? null,
          fallbackUsed: true,
          fallbackMessage: ARABIC_FALLBACK,
          timestamp: now,
        };
      }
      errors.push("twelvedata: empty quote");
    } catch (e) {
      errors.push(`twelvedata: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. AlphaVantage (EOD delayed — last resort)
  if (process.env.ALPHAVANTAGE_API_KEY) {
    try {
      // AlphaVantage uses numeric Tadawul codes without ".SR"
      const clean = symbol.replace(".SR", "");
      const q = await avQuote(clean);
      const gq = q["Global Quote"];
      const price = parseFloat(gq?.["05. price"] ?? "0");
      if (price > 0) {
        const changePct = parseFloat((gq?.["10. change percent"] ?? "0%").replace("%", ""));
        const volume = parseFloat(gq?.["06. volume"] ?? "0") || null;
        logFailover({ ts: now, kind: "saudi", primary: "sahmk", chosen: "alphavantage", reason: errors.join("; ") });
        return {
          symbol,
          price,
          changePercent: changePct,
          volume,
          provider: "alphavantage",
          source: "delayed",
          live: false,
          delayed: true,
          lastError: errors[0] ?? null,
          fallbackUsed: true,
          fallbackMessage: ARABIC_FALLBACK,
          timestamp: now,
        };
      }
      errors.push("alphavantage: empty quote");
    } catch (e) {
      errors.push(`alphavantage: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. All providers failed
  logFailover({ ts: now, kind: "saudi", primary: "sahmk", chosen: "unavailable", reason: errors.join("; ") });
  return {
    symbol,
    price: null,
    changePercent: null,
    volume: null,
    provider: "unavailable",
    source: "unavailable",
    live: false,
    delayed: false,
    lastError: errors.join("; ") || "all Saudi providers unavailable",
    fallbackUsed: true,
    fallbackMessage: ARABIC_FALLBACK,
    timestamp: now,
  };
}

// ---------- Advisory routing helpers (used by callers that fetch themselves) ----------

/**
 * Resilient routing helper for US/global market quotes.
 */
export function selectMarketProvider(): Exclude<ProviderId, "sahmk" | "newsapi" | "unavailable"> {
  const fh = fhHealth();
  const td = tdHealth();
  const av = avHealth();

  const primaryOk = fh.configured && fh.status === "healthy";
  if (primaryOk) return "finnhub";

  const tdReady = td.configured && td.status !== "down";
  const avReady = av.configured && av.status !== "down";

  let chosen: Exclude<ProviderId, "sahmk" | "newsapi" | "unavailable"> = "finnhub";
  let reason = `finnhub ${fh.status} configured=${fh.configured}`;

  if (tdReady && avReady) {
    chosen = td.failoverScore >= av.failoverScore ? "twelvedata" : "alphavantage";
    reason = `failoverScore td=${td.failoverScore} av=${av.failoverScore}`;
  } else if (tdReady) {
    chosen = "twelvedata";
    reason = "AlphaVantage down/unconfigured";
  } else if (avReady) {
    chosen = "alphavantage";
    reason = "TwelveData down/unconfigured";
  }

  logFailover({ ts: Date.now(), kind: "market", primary: "finnhub", chosen, reason });
  return chosen;
}

/**
 * Advisory Saudi market routing (use getSaudiQuote for resilient chain).
 */
export function selectSaudiMarketProvider(): ProviderId {
  if (process.env.SAHMK_API_KEY) {
    const sh = sahmkHealth();
    if (sh.status !== "down") return "sahmk";
  }

  const td = tdHealth();
  if (td.configured && td.status !== "down") return "twelvedata";

  const av = avHealth();
  if (av.configured && av.status !== "down") return "alphavantage";

  logFailover({
    ts: Date.now(),
    kind: "saudi",
    primary: "sahmk",
    chosen: "unavailable",
    reason: "no healthy Saudi provider",
  });
  return "unavailable";
}

/**
 * Macro routing: AlphaVantage primary, Finnhub fallback.
 */
export function selectMacroProvider(): "alphavantage" | "finnhub" {
  const av = avHealth();
  const chosen = av.configured && av.status !== "down" ? "alphavantage" : "finnhub";
  if (chosen !== "alphavantage") {
    logFailover({
      ts: Date.now(),
      kind: "macro",
      primary: "alphavantage",
      chosen,
      reason: `av configured=${av.configured} status=${av.status}`,
    });
  }
  return chosen;
}
