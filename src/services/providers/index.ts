/**
 * Unified provider facade — server-side only.
 *
 * Routing policy (failover order, evaluated lazily by callers via
 * selectMarketProvider / selectMacroProvider):
 *   - Quotes/markets:   Finnhub  →  TwelveData  →  AlphaVantage
 *   - Macro:            AlphaVantage (primary)  →  Finnhub (fallback)
 *   - News:             NewsAPI  →  GDELT (fallback handled in global-intel)
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
  getFinancialFeed as naFinancialFeed,
  providerHealth as naHealth,
} from "@/services/providers/newsapi";

export const providers = {
  quote: fhQuote,
  companyNews: fhCompanyNews,
  generalNews: fhGeneralNews,
  earnings: fhEarnings,
  marketStatus: fhMarketStatus,
  // Backups (used when primary degrades)
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

/** Aggregated health for every wired provider — surfaced to /market-data-monitor. */
export function allProvidersHealth() {
  return {
    finnhub: fhHealth(),
    twelvedata: tdHealth(),
    alphavantage: avHealth(),
    newsapi: naHealth(),
  };
}

type ProviderId = "finnhub" | "twelvedata" | "alphavantage" | "newsapi";

/**
 * Resilient routing helper for market quotes.
 * Picks the highest-scoring healthy provider, falling through to backups when
 * the primary reports `degraded` or `down`.
 */
export function selectMarketProvider(): ProviderId {
  const fh = fhHealth(); const td = tdHealth(); const av = avHealth();
  const primaryOk = fh.configured && fh.status === "healthy";
  if (primaryOk) return "finnhub";
  // Primary degraded → prefer TwelveData by failoverScore, else AV.
  const tdReady = td.configured && td.status !== "down";
  const avReady = av.configured && av.status !== "down";
  if (tdReady && avReady) return td.failoverScore >= av.failoverScore ? "twelvedata" : "alphavantage";
  if (tdReady) return "twelvedata";
  if (avReady) return "alphavantage";
  // Last resort — still try Finnhub even if degraded.
  return "finnhub";
}

/** Macro routing: AlphaVantage primary, Finnhub fallback (general news / status). */
export function selectMacroProvider(): "alphavantage" | "finnhub" {
  const av = avHealth();
  return av.configured && av.status !== "down" ? "alphavantage" : "finnhub";
}
