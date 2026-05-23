import { createFileRoute } from "@tanstack/react-router";
import { getGenesisControls, updateGenesisControls } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/controls")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(getGenesisControls(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
      POST: async ({ request }) => {
        const controls = await updateGenesisControls(request);
        return new Response(JSON.stringify(controls, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
