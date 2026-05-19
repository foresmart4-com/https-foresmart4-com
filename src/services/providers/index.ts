/**
 * Unified provider facade — server-side only.
 *
 * Existing engines (realtime, opportunity scanner, macro, decision, global-intel)
 * can import these helpers without coupling to a specific vendor. Today they
 * route to Finnhub; tomorrow we can add fall-throughs (Alpha Vantage, etc.)
 * with the same shape and provider-health aggregation.
 */
import {
  getQuote as fhQuote,
  getCompanyNews as fhCompanyNews,
  getGeneralNews as fhGeneralNews,
  getEarningsCalendar as fhEarnings,
  getMarketStatus as fhMarketStatus,
  providerHealth as fhHealth,
} from "@/services/providers/finnhub";

export const providers = {
  quote: fhQuote,
  companyNews: fhCompanyNews,
  generalNews: fhGeneralNews,
  earnings: fhEarnings,
  marketStatus: fhMarketStatus,
};

export function allProvidersHealth() {
  return { finnhub: fhHealth() };
}
