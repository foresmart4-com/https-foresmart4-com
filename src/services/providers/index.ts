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
import {
  getCommodityQuote,
  providerHealth as cpHealth,
} from "@/services/providers/commodityprice";

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
  // Commodities / metals
  commodityQuote: getCommodityQuote,
};

/** Aggregated health for every wired provider — surfaced to /market-data-monitor. */
export function allProvidersHealth() {
  return {
    finnhub: fhHealth(),
    twelvedata: tdHealth(),
    alphavantage: avHealth(),
    newsapi: naHealth(),
    commodityprice: cpHealth(),
  };
}

type ProviderId = "finnhub" | "twelvedata" | "alphavantage" | "newsapi" | "commodityprice";

// Lightweight failover log — useful for debugging which adapter served the
// request when production logs surface a rollup / runtime error tied to a
// specific module. Kept in-memory; surfaced via lastFailoverEvents().
type FailoverEvent = {
  ts: number; kind: "market" | "macro";
  primary: ProviderId; chosen: ProviderId; reason: string;
};
const FAILOVER_LOG: FailoverEvent[] = [];
function logFailover(e: FailoverEvent) {
  FAILOVER_LOG.push(e);
  if (FAILOVER_LOG.length > 200) FAILOVER_LOG.splice(0, FAILOVER_LOG.length - 200);
  // Stable, greppable line for worker logs.
  console.info(`[providers.failover] kind=${e.kind} primary=${e.primary} chosen=${e.chosen} reason="${e.reason}"`);
}
export function lastFailoverEvents(limit = 50): FailoverEvent[] {
  return FAILOVER_LOG.slice(-limit).reverse();
}

/**
 * Resilient routing helper for market quotes.
 * Picks the highest-scoring healthy provider, falling through to backups when
 * the primary reports `degraded` or `down`.
 */
export function selectMarketProvider(): ProviderId {
  const fh = fhHealth(); const td = tdHealth(); const av = avHealth();
  const primaryOk = fh.configured && fh.status === "healthy";
  if (primaryOk) return "finnhub";
  const tdReady = td.configured && td.status !== "down";
  const avReady = av.configured && av.status !== "down";
  let chosen: ProviderId = "finnhub";
  let reason = `finnhub ${fh.status} configured=${fh.configured}`;
  if (tdReady && avReady) {
    chosen = td.failoverScore >= av.failoverScore ? "twelvedata" : "alphavantage";
    reason = `failoverScore td=${td.failoverScore} av=${av.failoverScore}`;
  } else if (tdReady) { chosen = "twelvedata"; reason = `av down/unconfigured`; }
  else if (avReady) { chosen = "alphavantage"; reason = `td down/unconfigured`; }
  logFailover({ ts: Date.now(), kind: "market", primary: "finnhub", chosen, reason });
  return chosen;
}

/** Macro routing: AlphaVantage primary, Finnhub fallback. */
export function selectMacroProvider(): "alphavantage" | "finnhub" {
  const av = avHealth();
  const chosen = av.configured && av.status !== "down" ? "alphavantage" : "finnhub";
  if (chosen !== "alphavantage") {
    logFailover({
      ts: Date.now(), kind: "macro", primary: "alphavantage", chosen,
      reason: `av configured=${av.configured} status=${av.status}`,
    });
  }
  return chosen;
}

