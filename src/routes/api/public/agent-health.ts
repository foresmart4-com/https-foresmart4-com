import { createFileRoute } from "@tanstack/react-router";
import { getAgentHealth } from "@/lib/agent/engine";

export const Route = createFileRoute("/api/public/agent-health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis Agent",
          ...getAgentHealth(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
