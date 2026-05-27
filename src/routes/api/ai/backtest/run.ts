import { createFileRoute } from "@tanstack/react-router";
import { runBacktestFromRequest } from "@/lib/ai/backtesting/backtestEngine";

export const Route = createFileRoute("/api/ai/backtest/run")({
  server: {
    handlers: {
      POST: async ({ request }) => new Response(JSON.stringify(await runBacktestFromRequest(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
