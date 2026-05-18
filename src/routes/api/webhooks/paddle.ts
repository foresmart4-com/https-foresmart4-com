// Paddle webhook stub. Verifies the Paddle-Signature header when
// PADDLE_WEBHOOK_SECRET is configured, otherwise responds 503 so that
// misconfigured deployments fail loudly instead of silently accepting
// unsigned events.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/webhooks/paddle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PADDLE_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Paddle webhook not configured", { status: 503 });
        }
        const signature = request.headers.get("paddle-signature") ?? "";
        const body = await request.text();
        try {
          // Paddle signature format: "ts=...;h1=..."
          const parts = Object.fromEntries(
            signature.split(";").map((p) => p.split("=") as [string, string]),
          );
          const expected = createHmac("sha256", secret)
            .update(`${parts.ts}:${body}`)
            .digest("hex");
          const ok = !!parts.h1 &&
            timingSafeEqual(Buffer.from(expected), Buffer.from(parts.h1));
          if (!ok) return new Response("Invalid signature", { status: 401 });
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        // TODO: persist event via service_role client once Paddle is enabled.
        return Response.json({ received: true });
      },
    },
  },
});
