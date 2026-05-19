/**
 * Server functions exposing Finnhub to the client.
 * All require auth. Key stays server-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getQuote,
  getCompanyNews,
  getGeneralNews,
  getEarningsCalendar,
  getMarketStatus,
  providerHealth,
} from "@/services/providers/finnhub";

const Sym = z.object({ symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9.:_-]+$/) });

export const finnhubQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Sym.parse(d))
  .handler(async ({ data }) => {
    try {
      const q = await getQuote(data.symbol);
      return { ok: true as const, quote: q, fetchedAt: Date.now() };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "quote failed" };
    }
  });

const NewsInput = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9.:_-]+$/).optional(),
  category: z.enum(["general", "forex", "crypto", "merger"]).default("general"),
  fromISO: z.string().optional(),
  toISO: z.string().optional(),
});

export const finnhubNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => NewsInput.parse(d))
  .handler(async ({ data }) => {
    try {
      if (data.symbol && data.fromISO && data.toISO) {
        const items = await getCompanyNews(data.symbol, data.fromISO, data.toISO);
        return { ok: true as const, items: items.slice(0, 50) };
      }
      const items = await getGeneralNews(data.category);
      return { ok: true as const, items: items.slice(0, 50) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "news failed" };
    }
  });

const EarningsInput = z.object({
  fromISO: z.string(),
  toISO: z.string(),
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9.:_-]+$/).optional(),
});

export const finnhubEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EarningsInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const items = await getEarningsCalendar(data.fromISO, data.toISO, data.symbol);
      return { ok: true as const, items: items.slice(0, 200) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "earnings failed" };
    }
  });

export const finnhubMarketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ exchange: z.string().min(1).max(10).default("US") }).parse(d))
  .handler(async ({ data }) => {
    try {
      const s = await getMarketStatus(data.exchange);
      return { ok: true as const, status: s };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "status failed" };
    }
  });

export const finnhubHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => providerHealth());
