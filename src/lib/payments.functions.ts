import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTopupFees } from "./moyasar.server";

const MIN_TOPUP_SAR = 150;

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

// Initiate a subscription: creates a pending row, returns plan + publishable key
// so the client can render the Moyasar.js form. Webhook will activate.
export const initiateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ planCode: z.enum(["quarterly", "annual"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: plan, error: pErr } = await supabase
      .from("subscription_plans").select("*").eq("code", data.planCode).single();
    if (pErr || !plan) throw new Error("Plan not found");

    const trialEnd = new Date(Date.now() + plan.trial_days * 86400_000);
    const periodEnd = new Date(trialEnd.getTime() + plan.duration_months * 30 * 86400_000);

    const { data: sub, error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_id: plan.id,
      status: "pending",
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      amount_paid: plan.price_sar,
      currency: "SAR",
    }).select().single();
    if (error) throw new Error(error.message);

    return {
      subscriptionId: sub.id,
      plan,
      publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY ?? null,
    };
  });

// Initiate a wallet top-up
export const initiateTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    amountSar: z.number().min(MIN_TOPUP_SAR).max(500000),
    isMada: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const fees = computeTopupFees(data.amountSar, data.isMada ?? false);

    const { data: topup, error } = await supabase.from("wallet_topups").insert({
      user_id: userId,
      amount_sar: data.amountSar,
      moyasar_fee_sar: fees.moyasarFee,
      service_fee_sar: fees.serviceFee,
      net_credit_sar: fees.netCredit,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);

    return {
      topupId: topup.id,
      amountSar: data.amountSar,
      fees,
      publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY ?? null,
      minTopup: MIN_TOPUP_SAR,
    };
  });

// Compute fees for UI preview without inserting
export const previewTopupFees = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    amountSar: z.number().min(1).max(500000),
    isMada: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    return { fees: computeTopupFees(data.amountSar, data.isMada ?? false), minTopup: MIN_TOPUP_SAR };
  });
