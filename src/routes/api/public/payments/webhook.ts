import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          const eventType: string = payload.type ?? payload.event_type ?? "";
          const obj = payload.data?.object ?? payload.data ?? {};

          // Wallet deposit completion
          if (eventType.includes("checkout.session.completed") || eventType === "transaction.completed") {
            const userId = obj.metadata?.user_id || obj.client_reference_id;
            const purpose = obj.metadata?.purpose;
            const amountCents = obj.amount_total ?? obj.amount ?? 0;
            const amount = typeof amountCents === "number" ? amountCents / 100 : 0;

            if (userId && purpose === "wallet_deposit" && amount > 0) {
              const { data: wallet } = await supabaseAdmin
                .from("wallets")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();
              const w = wallet ?? (await supabaseAdmin.from("wallets").insert({ user_id: userId }).select().single()).data;
              if (w) {
                await supabaseAdmin.from("wallets").update({
                  balance: Number(w.balance) + amount,
                  updated_at: new Date().toISOString(),
                }).eq("id", w.id);
                await supabaseAdmin.from("wallet_transactions").insert({
                  user_id: userId,
                  wallet_id: w.id,
                  type: "deposit",
                  amount,
                  currency: (obj.currency ?? "usd").toUpperCase(),
                  status: "completed",
                  reference: obj.id ?? null,
                  metadata: { event: eventType },
                });
              }
            }
          }

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("webhook error", e);
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
