import { createFileRoute } from "@tanstack/react-router";
import { getExecutionHistory } from "@/lib/genesis100/execution/executionLifecycle";

export const Route = createFileRoute("/api/public/genesis100/execution/history")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          ...getExecutionHistory(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
