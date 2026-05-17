// Stripe Integration facade — wraps existing server functions.
// Server-side processing only; no secret keys are exposed in this module.
import {
  listPlans,
  getMySubscription,
  createSubscriptionCheckout,
  createBillingPortalSession,
} from "@/lib/payments.functions";

export type BillingInterval = "monthly" | "quarterly" | "semi_annual" | "annual";
export type PlanTier = "starter" | "pro";

export interface SubscriptionStatusView {
  active: boolean;
  status: string;
  tier: PlanTier | "none";
  trialing: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planName: string | null;
}

export async function fetchPlans() {
  return await listPlans();
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatusView> {
  const sub: any = await getMySubscription();
  if (!sub) {
    return {
      active: false, status: "none", tier: "none", trialing: false,
      trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, planName: null,
    };
  }
  const tier: PlanTier = String(sub.plan?.code ?? "").startsWith("pro") ? "pro" : "starter";
  const active = ["trialing", "active", "past_due"].includes(sub.status);
  return {
    active,
    status: sub.status,
    tier,
    trialing: sub.status === "trialing",
    trialEndsAt: sub.trial_ends_at ?? null,
    currentPeriodEnd: sub.current_period_end ?? null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    planName: sub.plan?.name ?? null,
  };
}

export async function startCheckout(
  priceId:
    | "quarterly_sar" | "semi_annual_sar" | "annual_sar"
    | "pro_quarterly_sar" | "pro_semi_annual_sar" | "pro_annual_sar",
  returnUrl: string,
) {
  const env = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("pk_test_")
    ? "sandbox" : "live";
  return await createSubscriptionCheckout({ data: { priceId, returnUrl, environment: env } });
}

export async function openBillingPortal(returnUrl: string): Promise<string> {
  const env = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("pk_test_")
    ? "sandbox" : "live";
  return await createBillingPortalSession({ data: { returnUrl, environment: env } });
}
