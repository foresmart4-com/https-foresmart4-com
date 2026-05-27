import { createFileRoute } from "@tanstack/react-router";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/memory/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ...getAIMemoryStatus(), ...AI_SAFETY_FLAGS }, null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
