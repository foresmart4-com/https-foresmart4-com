import { createFileRoute } from "@tanstack/react-router";
import { runGenesisCycle } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/run-cycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cycle = await runGenesisCycle(request);
        return new Response(JSON.stringify(cycle, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
