import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STRIPE_GATEWAY = "https://connector-gateway.lovable.dev/stripe/v1";

async function stripeCall(path: string, body: URLSearchParams) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const STRIPE_KEY = process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!STRIPE_KEY) throw new Error("Stripe payments not configured");
  const r = await fetch(`${STRIPE_GATEWAY}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": STRIPE_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${JSON.stringify(j)}`);
  return j as any;
}

export const createDepositSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().min(5).max(100000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const origin = process.env.SITE_URL ?? "https://project--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app";

    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", `${origin}/wallet?deposit=success`);
    body.set("cancel_url", `${origin}/wallet?deposit=cancelled`);
    body.set("client_reference_id", userId);
    body.set("metadata[user_id]", userId);
    body.set("metadata[purpose]", "wallet_deposit");
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(data.amount * 100)));
    body.set("line_items[0][price_data][product_data][name]", `Wallet deposit $${data.amount}`);

    const session = await stripeCall("/checkout/sessions", body);
    return { url: session.url as string };
  });
