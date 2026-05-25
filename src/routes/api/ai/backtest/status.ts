import { createFileRoute } from "@tanstack/react-router";
import { getBacktestStatus } from "@/lib/ai/backtesting/backtestEngine";

export const Route = createFileRoute("/api/ai/backtest/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getBacktestStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
