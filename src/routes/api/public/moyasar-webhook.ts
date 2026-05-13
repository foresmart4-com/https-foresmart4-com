import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "crypto";

// Moyasar webhook for wallet top-ups only.
// Configure in Moyasar dashboard → POST to:
//   https://project--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app/api/public/moyasar-webhook
// Set the secret token in Moyasar; we verify the `secret_token` field.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/moyasar-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          const secret = process.env.MOYASAR_WEBHOOK_SECRET;
          if (!secret || !payload.secret_token || !safeEqual(payload.secret_token, secret)) {
            return new Response("invalid secret", { status: 401 });
          }

          const type: string = payload.type ?? "";
          const data = payload.data ?? {};
          if (!type.startsWith("payment_")) return new Response("ignored", { status: 200 });

          const paymentId: string = data.id;
          const status: string = data.status;
          const meta = data.metadata ?? {};
          const purpose: string = meta.purpose ?? "";
          const userId: string = meta.user_id ?? "";

          if (!paymentId || !userId) return new Response("missing fields", { status: 200 });

          // Wallet top-up: credit net amount to wallet atomically.
          // wallet_credit_topup() guards on status='pending' in a single UPDATE,
          // so concurrent webhook retries cannot double-credit.
          if (purpose === "wallet_topup" && status === "paid") {
            if (!meta.topup_id) return new Response("missing topup_id", { status: 200 });

            const { data: result, error } = await supabaseAdmin.rpc("wallet_credit_topup", {
              _topup_id: meta.topup_id,
              _payment_id: paymentId,
              _payment_method: data.source?.type ?? null,
            });

            if (error) {
              console.error("wallet_credit_topup failed", error);
              return new Response("error", { status: 500 });
            }

            const row = Array.isArray(result) ? result[0] : result;
            if (!row?.credited) {
              // Already processed (idempotent retry) or topup missing.
              return new Response("already processed", { status: 200 });
            }

            // Verify the user_id from the webhook payload matches the topup record.
            if (userId && row.user_id !== userId) {
              console.error("user_id mismatch in webhook", { expected: row.user_id, got: userId });
            }
          }

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("moyasar webhook error", e);
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
