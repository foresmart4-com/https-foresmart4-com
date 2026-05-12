import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSubscriptionCheckout } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

interface Props {
  priceId: "quarterly_sar" | "annual_sar";
  returnUrl: string;
}

export function StripeSubscriptionCheckout({ priceId, returnUrl }: Props) {
  const checkoutFn = useServerFn(createSubscriptionCheckout);
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const cs = await checkoutFn({
      data: { priceId, returnUrl, environment: getStripeEnvironment() },
    });
    if (!cs) throw new Error("Failed to create checkout session");
    return cs;
  }, [checkoutFn, priceId, returnUrl]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
