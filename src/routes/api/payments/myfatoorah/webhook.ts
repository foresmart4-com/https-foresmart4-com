import { createFileRoute } from "@tanstack/react-router";
import { handleMyFatoorahWebhook } from "@/lib/payments/myfatoorah";

export const Route = createFileRoute("/api/payments/myfatoorah/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await handleMyFatoorahWebhook(request);
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
