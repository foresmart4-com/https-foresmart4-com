// Payment provider abstraction layer.
// Allows the platform to support multiple SaaS billing backends behind a
// single interface. Stripe is the primary implementation (already wired
// via Lovable's gateway). Paddle and LemonSqueezy are scaffolded behind
// the same shape and activate once their server-side keys are configured.

export type BillingProviderId = "stripe" | "paddle" | "lemonsqueezy";

export type BillingPlanCode =
  | "free"
  | "pro_monthly"
  | "pro_yearly";

export interface BillingPlan {
  code: BillingPlanCode;
  name: string;
  priceUsd: number;       // 0 for Free
  interval: "month" | "year" | "none";
  features: string[];
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    code: "free",
    name: "Free",
    priceUsd: 0,
    interval: "none",
    features: [
      "Basic market analytics",
      "Limited AI insights",
      "Watchlist tracking",
    ],
  },
  {
    code: "pro_monthly",
    name: "Pro Monthly",
    priceUsd: 29,
    interval: "month",
    features: [
      "Full AI market analytics",
      "Real-time market signals",
      "Educational trading simulations",
      "Portfolio analytics",
      "Priority support",
    ],
  },
  {
    code: "pro_yearly",
    name: "Pro Yearly",
    priceUsd: 290,
    interval: "year",
    features: [
      "Everything in Pro Monthly",
      "2 months free",
      "Exclusive webinars",
      "Early access to new analytics",
    ],
  },
];

export interface BillingProvider {
  id: BillingProviderId;
  label: string;
  isConfigured: boolean;
  checkoutPath: string;     // server endpoint that creates a checkout session
  webhookPath: string;      // public webhook endpoint
}

// Client-safe configuration. `isConfigured` is best-effort — actual
// availability is enforced server-side when secrets are read.
export const BILLING_PROVIDERS: Record<BillingProviderId, BillingProvider> = {
  stripe: {
    id: "stripe",
    label: "Stripe",
    isConfigured: true, // wired via Lovable's seamless integration
    checkoutPath: "/api/public/payments/webhook",
    webhookPath: "/api/public/payments/webhook",
  },
  paddle: {
    id: "paddle",
    label: "Paddle",
    isConfigured: false,
    checkoutPath: "/api/webhooks/paddle",
    webhookPath: "/api/webhooks/paddle",
  },
  lemonsqueezy: {
    id: "lemonsqueezy",
    label: "LemonSqueezy",
    isConfigured: false,
    checkoutPath: "/api/webhooks/lemonsqueezy",
    webhookPath: "/api/webhooks/lemonsqueezy",
  },
};

export function listProviders(): BillingProvider[] {
  return Object.values(BILLING_PROVIDERS);
}

export function getActiveProvider(): BillingProvider {
  return BILLING_PROVIDERS.stripe;
}
