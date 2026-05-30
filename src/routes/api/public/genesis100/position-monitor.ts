import { createFileRoute } from "@tanstack/react-router";
import { checkOpenPositions } from "@/lib/genesis100/execution/positionMonitor";

export const Route = createFileRoute("/api/public/genesis100/position-monitor")({
  server: {
    handlers: {
      GET: async () => {
        const results = await checkOpenPositions();
        return new Response(
          JSON.stringify(
            {
              product: "ForeSmart Genesis 100",
              liveExecutionEnabled: false,
              executionMode: "paper_only",
              note: "محاكاة ورقية — لا تنفيذ حقيقي. هذه نتائج استشارية فقط. يجب على الإنسان تأكيد أي إجراء.",
              count: results.length,
              criticalCount: results.filter((r) => r.alertLevel === "critical").length,
              warningCount: results.filter((r) => r.alertLevel === "warning").length,
              positions: results,
            },
            null,
            2,
          ),
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
