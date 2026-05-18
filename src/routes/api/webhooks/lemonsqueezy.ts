// LemonSqueezy webhook stub. Verifies the X-Signature header (HMAC-SHA256
// of the raw body) using LEMONSQUEEZY_WEBHOOK_SECRET. Returns 503 when
// unconfigured to prevent silent acceptance of unsigned events.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/webhooks/lemonsqueezy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("LemonSqueezy webhook not configured", { status: 503 });
        }
        const signature = request.headers.get("x-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const ok = signature.length === expected.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        if (!ok) return new Response("Invalid signature", { status: 401 });
        // TODO: persist event via service_role client once LemonSqueezy is enabled.
        return Response.json({ received: true });
      },
    },
  },
});
