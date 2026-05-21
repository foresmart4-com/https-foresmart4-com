/**
 * Regression smoke tests for the unified market router.
 *
 * Runs resolveAsset() over a fixed symbol set and asserts:
 *  - assetClass matches expectation
 *  - cacheKey + inflightKey are unique across symbols (no collisions)
 *
 * Live network is NOT hit — these are pure resolver assertions. Live trading
 * remains disabled.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveAsset } from "@/lib/market/router";

interface Case { input: string; expect: string }
const CASES: Case[] = [
  { input: "BTC",      expect: "crypto" },
  { input: "ETH",      expect: "crypto" },
  { input: "AAPL",     expect: "us_stock" },
  { input: "TSLA",     expect: "us_stock" },
  { input: "2222.SR",  expect: "saudi_stock" },
  { input: "XAUUSD",   expect: "metal" },
];

export const Route = createFileRoute("/api/public/router-regression")({
  server: {
    handlers: {
      GET: async () => {
        const results = CASES.map((c) => {
          const a = resolveAsset(c.input);
          const cacheKey = `${a.assetClass}::${a.normalized}::${a.raw}`;
          const inflightKey = `inflight::${cacheKey}`;
          return {
            input: c.input,
            expect: c.expect,
            actual: a.assetClass,
            pass: a.assetClass === c.expect,
            normalized: a.normalized,
            resolverPath: a.resolverPath,
            cacheKey,
            inflightKey,
          };
        });

        const cacheKeys = results.map((r) => r.cacheKey);
        const uniqueCacheKeys = new Set(cacheKeys).size === cacheKeys.length;
        const allPass = results.every((r) => r.pass) && uniqueCacheKeys;

        return new Response(
          JSON.stringify(
            {
              ok: allPass,
              uniqueCacheKeys,
              liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === "true",
              results,
            },
            null,
            2,
          ),
          {
            status: allPass ? 200 : 500,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
