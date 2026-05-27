import { createServerFn } from "@tanstack/react-start";

export interface PaymentProviderHealth {
  id: "stripe" | "moyasar" | "paypal";
  label: string;
  configured: boolean;
  environment: "sandbox" | "live" | "unknown";
  missingKeys: string[];
}

export interface PaymentsHealthSnapshot {
  anyConfigured: boolean;
  providers: PaymentProviderHealth[];
  generatedAt: number;
}

// Server-only: reads env to determine which payment providers are wired.
// Never returns actual secret values — only boolean presence flags.
export const getPaymentProvidersHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentsHealthSnapshot> => {
    const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).length > 0);

    const stripeSandbox = has("STRIPE_SANDBOX_API_KEY");
    const stripeLive = has("STRIPE_LIVE_API_KEY");
    const stripeMissing: string[] = [];
    if (!stripeSandbox) stripeMissing.push("STRIPE_SANDBOX_API_KEY");

    const moyasarConfigured = has("MOYASAR_SECRET_KEY") || has("MOYASAR_PUBLISHABLE_KEY");
    const moyasarMissing: string[] = [];
    if (!has("MOYASAR_SECRET_KEY")) moyasarMissing.push("MOYASAR_SECRET_KEY");

    const paypalConfigured = has("PAYPAL_CLIENT_ID") && has("PAYPAL_CLIENT_SECRET");
    const paypalMissing: string[] = [];
    if (!has("PAYPAL_CLIENT_ID")) paypalMissing.push("PAYPAL_CLIENT_ID");
    if (!has("PAYPAL_CLIENT_SECRET")) paypalMissing.push("PAYPAL_CLIENT_SECRET");

    const providers: PaymentProviderHealth[] = [
      {
        id: "stripe",
        label: "Stripe",
        configured: stripeSandbox || stripeLive,
        environment: stripeLive ? "live" : stripeSandbox ? "sandbox" : "unknown",
        missingKeys: stripeMissing,
      },
      {
        id: "moyasar",
        label: "Moyasar",
        configured: moyasarConfigured,
        environment: "unknown",
        missingKeys: moyasarMissing,
      },
      {
        id: "paypal",
        label: "PayPal",
        configured: paypalConfigured,
        environment:
          (process.env.PAYPAL_ENVIRONMENT as "sandbox" | "live") ??
          (paypalConfigured ? "sandbox" : "unknown"),
        missingKeys: paypalMissing,
      },
    ];

    return {
      anyConfigured: providers.some((p) => p.configured),
      providers,
      generatedAt: Date.now(),
    };
  },
);
