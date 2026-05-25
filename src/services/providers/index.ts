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

import { getQuote as sahmkQuote } from "@/services/providers/sahmk";

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

/** Aggregated health for wired providers. */
export function allProvidersHealth() {
  return {
    finnhub: fhHealth(),
    twelvedata: tdHealth(),
    alphavantage: avHealth(),
    newsapi: naHealth(),
    sahmk: {
      provider: "sahmk",
      configured: Boolean(process.env.SAHMK_API_KEY),
      status: process.env.SAHMK_API_KEY ? "healthy" : "down",
      role: "saudi-market",
      failoverScore: process.env.SAHMK_API_KEY ? 1 : 0,
    },
  };
}

type ProviderId =
  | "finnhub"
  | "twelvedata"
  | "alphavantage"
  | "newsapi"
  | "sahmk";

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

  if (FAILOVER_LOG.length > 200) {
    FAILOVER_LOG.splice(0, FAILOVER_LOG.length - 200);
  }

  console.info(
    `[providers.failover] kind=${e.kind} primary=${e.primary} chosen=${e.chosen} reason="${e.reason}"`
  );
}

export function lastFailoverEvents(limit = 50): FailoverEvent[] {
  return FAILOVER_LOG.slice(-limit).reverse();
}

/**
 * Resilient routing helper for US/global market quotes.
 */
export function selectMarketProvider(): ProviderId {
  const fh = fhHealth();
  const td = tdHealth();
  const av = avHealth();

  const primaryOk = fh.configured && fh.status === "healthy";
  if (primaryOk) return "finnhub";

  const tdReady = td.configured && td.status !== "down";
  const avReady = av.configured && av.status !== "down";

  let chosen: ProviderId = "finnhub";
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

  logFailover({
    ts: Date.now(),
    kind: "market",
    primary: "finnhub",
    chosen,
    reason,
  });

  return chosen;
}

/**
 * Saudi market routing.
 */
export function selectSaudiMarketProvider(): ProviderId {
  if (process.env.SAHMK_API_KEY) {
    return "sahmk";
  }

  const td = tdHealth();
  const av = avHealth();

  if (td.configured && td.status !== "down") return "twelvedata";
  if (av.configured && av.status !== "down") return "alphavantage";

  logFailover({
    ts: Date.now(),
    kind: "saudi",
    primary: "sahmk",
    chosen: "twelvedata",
    reason: "SAHMK missing key; no healthy Saudi provider",
  });

  return "twelvedata";
}

/**
 * Macro routing: AlphaVantage primary, Finnhub fallback.
 */
export function selectMacroProvider(): "alphavantage" | "finnhub" {
  const av = avHealth();

  const chosen =
    av.configured && av.status !== "down" ? "alphavantage" : "finnhub";

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
