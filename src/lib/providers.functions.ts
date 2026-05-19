/**
 * Server functions exposing TwelveData, AlphaVantage and NewsAPI to the client.
 * All require auth. Keys stay server-side.
 *
 * Routing intent: clients should usually call the unified facade (Finnhub
 * primary), and only hit these endpoints when the primary is degraded or
 * when they specifically need macro / news data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getQuote as tdQuote,
  getRealtimePrice as tdPrice,
  getTimeSeries as tdSeries,
  getRSI as tdRSI,
  getEMA as tdEMA,
  getMACD as tdMACD,
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
  everything as naEverything,
  topHeadlines as naTopHeadlines,
  getFinancialFeed as naFinancialFeed,
  providerHealth as naHealth,
} from "@/services/providers/newsapi";
import { allProvidersHealth } from "@/services/providers";

const Sym = z.string().min(1).max(20).regex(/^[A-Za-z0-9.:/_-]+$/);

// ---------- TwelveData ----------
export const tdGetQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: Sym }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, quote: await tdQuote(data.symbol) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "td quote failed" }; }
  });

export const tdGetPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: Sym }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, price: await tdPrice(data.symbol) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "td price failed" }; }
  });

const Interval = z.enum(["1min","5min","15min","30min","45min","1h","2h","4h","8h","1day","1week","1month"]);
export const tdGetSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: Sym, interval: Interval.optional(), outputsize: z.number().int().min(10).max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, series: await tdSeries(data.symbol, data.interval ?? "1day", data.outputsize ?? 90) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "td series failed" }; }
  });

export const tdGetIndicator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: Sym, interval: Interval.optional(), indicator: z.enum(["rsi","ema","macd"]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const interval = data.interval ?? "1day";
      const v = data.indicator === "rsi" ? await tdRSI(data.symbol, interval)
        : data.indicator === "ema" ? await tdEMA(data.symbol, interval)
        : await tdMACD(data.symbol, interval);
      return { ok: true as const, indicator: v };
    } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "td indicator failed" }; }
  });

export const tdGetMarketState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ exchange: z.string().min(2).max(20).default("NASDAQ") }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, states: await tdMarketState(data.exchange) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "td market state failed" }; }
  });

// ---------- AlphaVantage ----------
export const avGetEquityQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: Sym }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, quote: await avQuote(data.symbol) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "av quote failed" }; }
  });

export const avGetFx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().min(3).max(8), to: z.string().min(3).max(8) }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, rate: await avFx(data.from.toUpperCase(), data.to.toUpperCase()) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "av fx failed" }; }
  });

export const avGetMacroSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try { return { ok: true as const, snapshot: await avMacro() }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "av macro failed" }; }
  });

// ---------- NewsAPI ----------
export const naSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    q: z.string().min(1).max(200),
    language: z.string().min(2).max(5).optional(),
    sortBy: z.enum(["publishedAt","popularity","relevancy"]).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, items: await naEverything(data) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "news search failed" }; }
  });

export const naHeadlines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    category: z.enum(["business","technology","general"]).optional(),
    country: z.string().min(2).max(2).optional(),
    q: z.string().max(200).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    try { return { ok: true as const, items: await naTopHeadlines(data) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "headlines failed" }; }
  });

export const naFinancial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try { return { ok: true as const, items: await naFinancialFeed() }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "financial feed failed" }; }
  });

// ---------- Aggregated health ----------
export const allProviderHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ...allProvidersHealth(),
    individual: { twelvedata: tdHealth(), alphavantage: avHealth(), newsapi: naHealth() },
  }));
