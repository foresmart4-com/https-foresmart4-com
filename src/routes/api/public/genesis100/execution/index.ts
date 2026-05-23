import { createFileRoute } from "@tanstack/react-router";
import { getExecutionStatus } from "@/lib/genesis100/execution/executionLifecycle";

export const Route = createFileRoute("/api/public/genesis100/execution/")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          ...getExecutionStatus(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
