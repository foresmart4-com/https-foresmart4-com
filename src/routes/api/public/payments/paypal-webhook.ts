import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getPayPalEnv, verifyPayPalWebhook } from "@/lib/paypal.server";

let _sb: any = null;
function sb() {
  if (!_sb) {
    _sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _sb;
}

async function applyEvent(event: any, env: string) {
  const type: string = event.event_type;
  const resource = event.resource ?? {};
  const resourceId: string | null = resource.id ?? null;
  const customId: string | undefined = resource.custom_id ?? resource.purchase_units?.[0]?.custom_id;
  const [uid, _planCode, planId] = (customId ?? "").split("|");

  await sb().from("payment_events").insert({
    provider: "paypal",
    event_type: type,
    event_id: event.id,
    resource_id: resourceId,
    user_id: uid || null,
    environment: env,
    status: "verified",
    payload: event,
  });

  switch (type) {
    case "CHECKOUT.ORDER.APPROVED":
    case "PAYMENT.CAPTURE.COMPLETED": {
      if (!uid || !planId) return;
      const { data: plan } = await sb()
        .from("subscription_plans").select("duration_months").eq("id", planId).maybeSingle();
      const months = plan?.duration_months ?? 3;
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + months);
      await sb().from("subscriptions").upsert(
        {
          user_id: uid,
          plan_id: planId,
          provider: "paypal",
          paypal_order_id: resource.supplementary_data?.related_ids?.order_id ?? resourceId,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          environment: env,
          currency: (resource.amount?.currency_code ?? "USD"),
          amount_paid: Number(resource.amount?.value ?? 0),
          updated_at: now.toISOString(),
        },
        { onConflict: "paypal_order_id" },
      );
      break;
    }
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED": {
      if (uid) {
        await sb().from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", uid).eq("provider", "paypal");
      }
      break;
    }
    default:
      // logged only
      break;
  }
}

export const Route = createFileRoute("/api/public/payments/paypal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const env = getPayPalEnv();
        const webhookId = process.env.PAYPAL_WEBHOOK_ID;

        if (!webhookId) {
          console.error("[paypal-webhook] PAYPAL_WEBHOOK_ID not configured");
          return new Response("Webhook ID not configured", { status: 503 });
        }

        const verified = await verifyPayPalWebhook({
          headers: request.headers, body, webhookId, env,
        });
        if (!verified) {
          await sb().from("payment_events").insert({
            provider: "paypal", event_type: "webhook.invalid_signature",
            environment: env, status: "rejected", payload: { raw: body.slice(0, 1000) },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const event = JSON.parse(body);
          await applyEvent(event, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[paypal-webhook] processing error", e);
          await sb().from("payment_events").insert({
            provider: "paypal", event_type: "webhook.error",
            environment: env, status: "error", error: (e as Error).message,
            payload: { raw: body.slice(0, 2000) },
          });
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});
