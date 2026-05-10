import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Moyasar webhook: https://docs.moyasar.com/webhooks/
// Configure in Moyasar dashboard to POST to:
//   https://project--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app/api/public/moyasar-webhook
// Set the secret token in Moyasar; we verify the `secret_token` field on the payload.

export const Route = createFileRoute("/api/public/moyasar-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          const secret = process.env.MOYASAR_WEBHOOK_SECRET;
          if (secret && payload.secret_token !== secret) {
            return new Response("invalid secret", { status: 401 });
          }

          const type: string = payload.type ?? "";
          const data = payload.data ?? {};
          if (!type.startsWith("payment_")) return new Response("ignored", { status: 200 });

          const paymentId: string = data.id;
          const status: string = data.status; // paid | failed | authorized ...
          const amountSar = (data.amount ?? 0) / 100;
          const meta = data.metadata ?? {};
          const purpose: string = meta.purpose ?? "";
          const userId: string = meta.user_id ?? "";

          if (!paymentId || !userId) return new Response("missing fields", { status: 200 });

          if (purpose === "wallet_topup" && status === "paid") {
            // Mark topup paid, credit net amount to wallet
            const { data: topup } = await supabaseAdmin
              .from("wallet_topups").select("*")
              .eq("id", meta.topup_id).maybeSingle();
            if (topup && topup.status === "pending") {
              await supabaseAdmin.from("wallet_topups").update({
                status: "paid", moyasar_payment_id: paymentId,
                payment_method: data.source?.type ?? null,
              }).eq("id", topup.id);

              const { data: w } = await supabaseAdmin.from("wallets")
                .select("*").eq("user_id", userId).maybeSingle();
              const wallet = w ?? (await supabaseAdmin.from("wallets")
                .insert({ user_id: userId, currency: "SAR" }).select().single()).data;
              if (wallet) {
                await supabaseAdmin.from("wallets").update({
                  balance: Number(wallet.balance) + Number(topup.net_credit_sar),
                  currency: "SAR",
                  updated_at: new Date().toISOString(),
                }).eq("id", wallet.id);
                await supabaseAdmin.from("wallet_transactions").insert({
                  user_id: userId, wallet_id: wallet.id,
                  type: "deposit", amount: topup.net_credit_sar, currency: "SAR",
                  status: "completed", reference: paymentId,
                  metadata: { gross: topup.amount_sar, moyasar_fee: topup.moyasar_fee_sar, service_fee: topup.service_fee_sar },
                });
              }
            }
          }

          if (purpose === "subscription" && status === "paid") {
            await supabaseAdmin.from("subscriptions").update({
              status: "active", moyasar_payment_id: paymentId,
              updated_at: new Date().toISOString(),
            }).eq("id", meta.subscription_id);
            // Promote to subscriber role
            const { data: existingRole } = await supabaseAdmin.from("user_roles")
              .select("id").eq("user_id", userId).eq("role", "subscriber").maybeSingle();
            if (!existingRole) {
              await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "subscriber" });
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
