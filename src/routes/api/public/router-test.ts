import { createFileRoute } from "@tanstack/react-router";
import { routeQuote, getRouterDiagnostics, resolveAsset } from "@/lib/market/router";

export const Route = createFileRoute("/api/public/router-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol")?.trim();
        const debug = url.searchParams.get("debug") === "1";
        const force = url.searchParams.get("force") === "1";

        if (!symbol) {
          return new Response(
            JSON.stringify({
              error: "missing 'symbol' query parameter",
              example: "/api/public/router-test?symbol=AAPL",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const resolved = resolveAsset(symbol);
          const quote = await routeQuote(symbol, { force });
          const body: Record<string, unknown> = { resolved, quote };
          if (debug) body.diagnostics = getRouterDiagnostics();
          return new Response(JSON.stringify(body, null, 2), {
            status: quote.success ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "router failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
