import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalEnv,
} from "./paypal.server";
import { assertSafeReturnUrl } from "./security/safeRedirect";

// SAR -> USD (rough peg, SAR ~ 3.75 USD per 1 SAR is wrong; 1 USD ≈ 3.75 SAR)
const SAR_PER_USD = 3.75;
const sarToUsd = (sar: number) => Math.max(1, Math.round((sar / SAR_PER_USD) * 100) / 100);

const PlanCodeSchema = z.enum([
  "quarterly", "semi_annual", "annual",
  "pro_quarterly", "pro_semi_annual", "pro_annual",
]);

export const createPayPalCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      planCode: PlanCodeSchema,
      returnUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const safeReturn = assertSafeReturnUrl(data.returnUrl);
    const safeCancel = assertSafeReturnUrl(data.cancelUrl);

    const { data: plan, error } = await context.supabase
      .from("subscription_plans")
      .select("id, code, name_en, price_sar, duration_months")
      .eq("code", data.planCode)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !plan) throw new Error("Plan not found");

    const amountUsd = sarToUsd(Number(plan.price_sar));
    const order = await createPayPalOrder({
      amountUsd,
      description: `${plan.name_en} subscription`,
      customId: `${context.userId}|${plan.code}|${plan.id}`,
      returnUrl: safeReturn,
      cancelUrl: safeCancel,
    });

    await supabaseAdmin.from("payment_events").insert({
      provider: "paypal",
      event_type: "order.created",
      event_id: order.id,
      resource_id: order.id,
      user_id: context.userId,
      environment: getPayPalEnv(),
      status: "created",
      payload: { planCode: plan.code, amountUsd, amountSar: plan.price_sar },
    });

    const approveUrl = order.links?.find((l) => l.rel === "approve")?.href ?? null;
    return { orderId: order.id, approveUrl, amountUsd };
  });

export const capturePayPalCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().min(3).max(100) }).parse(d))
  .handler(async ({ context, data }) => {
    const env = getPayPalEnv();
    const result = await capturePayPalOrder(data.orderId);

    const purchaseUnit = result.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    const customId: string = capture?.custom_id ?? purchaseUnit?.custom_id ?? "";
    const [uid, planCode, planId] = customId.split("|");
    const captureId = capture?.id ?? null;
    const status = result.status; // "COMPLETED" expected

    await supabaseAdmin.from("payment_events").insert({
      provider: "paypal",
      event_type: "order.captured",
      event_id: captureId ?? data.orderId,
      resource_id: data.orderId,
      user_id: context.userId,
      environment: env,
      status: status ?? "unknown",
      payload: result,
    });

    if (status !== "COMPLETED") {
      return { ok: false, status };
    }

    if (uid !== context.userId || !planId) {
      throw new Error("Order ownership mismatch");
    }

    // Activate subscription
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans").select("duration_months").eq("id", planId).maybeSingle();
    const months = plan?.duration_months ?? 3;
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: uid,
        plan_id: planId,
        provider: "paypal",
        paypal_order_id: data.orderId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        environment: env,
        currency: "USD",
        amount_paid: Number(capture?.amount?.value ?? 0),
        updated_at: now.toISOString(),
      },
      { onConflict: "paypal_order_id" },
    );

    return { ok: true, status, planCode };
  });
