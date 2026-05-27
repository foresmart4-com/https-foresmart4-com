import { createFileRoute } from "@tanstack/react-router";
import { createMyFatoorahPayment } from "@/lib/payments/myfatoorah";

export const Route = createFileRoute("/api/payments/myfatoorah/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await createMyFatoorahPayment(request);
        return new Response(JSON.stringify(result, null, 2), {
          status: result.success ? 200 : 400,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
