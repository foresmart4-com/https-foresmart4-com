import { createFileRoute } from "@tanstack/react-router";
import { getMyFatoorahRuntimeStatus } from "@/lib/payments/myfatoorah";

export const Route = createFileRoute("/api/payments/myfatoorah/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getMyFatoorahRuntimeStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
