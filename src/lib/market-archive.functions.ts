/**
 * Server functions for the Historical Market Archive (Phase 11).
 * Thin wrappers around the server-only history-router.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getHistoricalCandles as _get,
  refreshHistoricalCandles as _refresh,
  getArchiveCoverage as _coverage,
  recentHistoryCalls,
  type HistoryResult,
  type Range,
  type Interval,
} from "@/lib/market/history-router";

export type { HistoryResult, Range, Interval } from "@/lib/market/history-router";

const InputSchema = z.object({
  symbol: z.string().min(1).max(32),
  range: z.enum(["24h", "7d", "30d", "90d", "1y", "3y"]),
  interval: z.enum(["1m", "5m", "15m", "1h", "1d"]),
});

export const getHistoricalCandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<HistoryResult> => _get(data.symbol, data.range as Range, data.interval as Interval));

export const refreshHistoricalCandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<HistoryResult> => _refresh(data.symbol, data.range as Range, data.interval as Interval));

export const getArchiveCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => _coverage(data.symbol));

export const getHistoryCallLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => recentHistoryCalls().slice(0, 50));
