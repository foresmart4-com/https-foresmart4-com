import { createFileRoute } from "@tanstack/react-router";
import { buildGenesisReport, parseGenesisPeriod } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const period = parseGenesisPeriod(url.searchParams.get("period"));
        const report = buildGenesisReport(period);
        return new Response(JSON.stringify(report, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
