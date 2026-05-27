/**
 * Public test endpoint for the Historical Archive Engine.
 * /api/public/history-test?symbol=AAPL&range=30d&interval=1d&debug=1
 * Read-only; never exposes API keys.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getHistoricalCandles, getArchiveCoverage, recentHistoryCalls, type Range, type Interval } from "@/lib/market/history-router";

const VALID_RANGES = new Set(["24h","7d","30d","90d","1y","3y"]);
const VALID_INTERVALS = new Set(["1m","5m","15m","1h","1d"]);

export const Route = createFileRoute("/api/public/history-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const symbol = (u.searchParams.get("symbol") ?? "").trim();
        const range = (u.searchParams.get("range") ?? "30d") as Range;
        const interval = (u.searchParams.get("interval") ?? "1d") as Interval;
        const debug = u.searchParams.get("debug") === "1";
        if (!symbol) return Response.json({ error: "missing symbol" }, { status: 400 });
        if (!VALID_RANGES.has(range)) return Response.json({ error: "invalid range" }, { status: 400 });
        if (!VALID_INTERVALS.has(interval)) return Response.json({ error: "invalid interval" }, { status: 400 });

        const result = await getHistoricalCandles(symbol, range, interval);
        const body: Record<string, unknown> = {
          symbol: result.symbol,
          assetClass: result.assetClass,
          provider: result.provider,
          mode: result.mode,
          range, interval,
          candleCount: result.candles.length,
          first: result.candles[0] ?? null,
          last: result.candles[result.candles.length - 1] ?? null,
        };
        if (debug) {
          body.coverage = await getArchiveCoverage(symbol);
          body.attempted = result.attempted;
          body.fallbackUsed = result.fallbackUsed;
          body.error = result.error ?? null;
          body.recentCalls = recentHistoryCalls().slice(0, 10);
        }
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
