import { createFileRoute } from "@tanstack/react-router";
import { backtestReportFromRequest } from "@/lib/ai/backtesting/backtestEngine";

export const Route = createFileRoute("/api/ai/backtest/report")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(backtestReportFromRequest(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
