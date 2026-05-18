// Alias route forwarding to the canonical Stripe webhook handler
// (`/api/public/payments/webhook`). Provided so external Stripe
// configurations pointing at `/api/webhooks/stripe` still work.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env") ?? "sandbox";
        const target = new URL(
          `/api/public/payments/webhook?env=${encodeURIComponent(env)}`,
          url.origin,
        );
        return fetch(target.toString(), {
          method: "POST",
          headers: request.headers,
          body: await request.arrayBuffer(),
        });
      },
    },
  },
});
