import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTopupFees } from "./moyasar.server";
import { type StripeEnv, createStripeClient, resolveOrCreateCustomer } from "./stripe.server";

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

// Stripe checkout session for subscription with 14-day trial
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      priceId: z.enum([
        "quarterly_sar", "semi_annual_sar", "annual_sar",
        "pro_quarterly_sar", "pro_semi_annual_sar", "pro_annual_sar",
      ]),
      returnUrl: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found in Stripe");
    const stripePrice = prices.data[0];

    // Get user email for customer
    const { data: { user } } = await context.supabase.auth.getUser();
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user?.email,
      userId,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId },
      },
      metadata: { userId },
    });

    return session.client_secret;
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      returnUrl: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const env = data.environment as StripeEnv;
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", env)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      throw new Error("No Stripe customer found. Please complete a subscription first.");
    }

    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return portal.url;
  });

// ----- Wallet top-up (Moyasar) -----

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

export const previewTopupFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    amountSar: z.number().min(1).max(500000),
    isMada: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    return { fees: computeTopupFees(data.amountSar, data.isMada ?? false), minTopup: MIN_TOPUP_SAR };
  });
