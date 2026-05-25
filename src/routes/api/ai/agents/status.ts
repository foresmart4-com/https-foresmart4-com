import { createFileRoute } from "@tanstack/react-router";
import { getInstitutionalAgentStatus } from "@/lib/ai/debate/debateEngine";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/agents/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ...getInstitutionalAgentStatus(), ...AI_SAFETY_FLAGS }, null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
