/**
 * Regression / unit tests for the unified market router resolver.
 *
 * Pure resolver assertions — no live network. Verifies:
 *   - Metals (XAUUSD, XAGUSD, GOLD, SILVER) NEVER resolve to index/SPX.
 *   - SPX whitelist is exact: SPX | SP500 | ^GSPC only.
 *   - Treasuries (US10Y) resolve to "treasury", not bond/index.
 *   - Commodities (WTI, BRENT) resolve to "commodity".
 *   - Cache keys are unique per symbol (no contamination).
 *   - Diagnostics fields (resolverMatchedBy, resolverRule) populated.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveAsset, clearRouterCache } from "@/lib/market/router";

interface Case {
  input: string;
  expectClass: string;
  expectMatchedBy?: string;
  forbidClass?: string[];
}

const CASES: Case[] = [
  // Metals — must NEVER be "index"
  { input: "XAUUSD", expectClass: "metal", expectMatchedBy: "metal_exact",  forbidClass: ["index", "us_stock", "forex", "unknown"] },
  { input: "XAGUSD", expectClass: "metal", expectMatchedBy: "metal_exact",  forbidClass: ["index", "us_stock", "forex", "unknown"] },
  { input: "GOLD",   expectClass: "metal", expectMatchedBy: "metal_exact",  forbidClass: ["index", "us_stock", "commodity"] },
  { input: "SILVER", expectClass: "metal", expectMatchedBy: "metal_exact",  forbidClass: ["index", "us_stock", "commodity"] },
  { input: "XAU",    expectClass: "metal", expectMatchedBy: "metal_exact" },
  { input: "XAG",    expectClass: "metal", expectMatchedBy: "metal_exact" },

  // SPX strict whitelist
  { input: "SPX",    expectClass: "index", expectMatchedBy: "index_exact" },
  { input: "SP500",  expectClass: "index", expectMatchedBy: "index_exact" },
  { input: "^GSPC",  expectClass: "index", expectMatchedBy: "index_exact" },
  // Confusables that must NOT become SPX
  { input: "SPY",    expectClass: "etf",   forbidClass: ["index"] },
  { input: "SP",     expectClass: "us_stock", forbidClass: ["index"] },

  // Treasuries
  { input: "US10Y",  expectClass: "treasury", expectMatchedBy: "treasury_exact", forbidClass: ["bond", "index"] },
  { input: "US02Y",  expectClass: "treasury" },

  // Commodities
  { input: "WTI",    expectClass: "commodity", expectMatchedBy: "commodity_exact" },
  { input: "BRENT",  expectClass: "commodity", expectMatchedBy: "commodity_exact" },
  { input: "USOIL",  expectClass: "commodity" },

  // Crypto / equities (sanity)
  { input: "BTC",    expectClass: "crypto" },
  { input: "AAPL",   expectClass: "us_stock" },
  { input: "2222.SR", expectClass: "saudi_stock" },
];

export const Route = createFileRoute("/api/public/router-regression")({
  server: {
    handlers: {
      GET: async () => {
        // Flush any cached entries so tests reflect the current resolver.
        const cleared = clearRouterCache();

        const results = CASES.map((c) => {
          const a = resolveAsset(c.input);
          const cacheKey = `${a.assetClass}::${a.normalized}::${a.raw}`;
          const checks: Record<string, boolean> = {
            assetClass: a.assetClass === c.expectClass,
            forbidden: !(c.forbidClass?.includes(a.assetClass)),
            hasDiagnostics: !!a.resolverMatchedBy && !!a.resolverRule,
            matchedBy: c.expectMatchedBy ? a.resolverMatchedBy === c.expectMatchedBy : true,
          };
          const pass = Object.values(checks).every(Boolean);
          return {
            input: c.input,
            expect: c.expectClass,
            actual: a.assetClass,
            matchedBy: a.resolverMatchedBy,
            rule: a.resolverRule,
            resolverPath: a.resolverPath,
            cacheKey,
            checks,
            pass,
          };
        });

        const cacheKeys = results.map((r) => r.cacheKey);
        const uniqueCacheKeys = new Set(cacheKeys).size === cacheKeys.length;

        // Hard invariant: XAGUSD must never resolve to SPX/index.
        const xag = resolveAsset("XAGUSD");
        const xagSafe = xag.assetClass === "metal" && xag.normalized !== "SPX";

        const allPass = results.every((r) => r.pass) && uniqueCacheKeys && xagSafe;

        return new Response(
          JSON.stringify(
            {
              ok: allPass,
              uniqueCacheKeys,
              xagSafe,
              cacheCleared: cleared,
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
