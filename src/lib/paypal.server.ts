// PayPal server SDK helpers — server-only.
// Uses REST API directly (no Node-only SDK dependency).

export type PayPalEnv = "sandbox" | "live";

export function getPayPalEnv(): PayPalEnv {
  const v = (process.env.PAYPAL_ENVIRONMENT ?? "sandbox").toLowerCase();
  return v === "live" ? "live" : "sandbox";
}

export function getPayPalBaseUrl(env: PayPalEnv = getPayPalEnv()): string {
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

let _tokenCache: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(env: PayPalEnv = getPayPalEnv()): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 30_000) return _tokenCache.token;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${getPayPalBaseUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  _tokenCache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

export async function paypalFetch<T = any>(
  path: string,
  init: RequestInit = {},
  env: PayPalEnv = getPayPalEnv(),
): Promise<T> {
  const token = await getPayPalAccessToken(env);
  const res = await fetch(`${getPayPalBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function createPayPalOrder(params: {
  amountUsd: number;
  description: string;
  customId: string; // userId|planCode
  returnUrl: string;
  cancelUrl: string;
}) {
  return paypalFetch<{ id: string; status: string; links: { href: string; rel: string }[] }>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: params.amountUsd.toFixed(2) },
            description: params.description,
            custom_id: params.customId,
          },
        ],
        application_context: {
          brand_name: "ForeSmart",
          user_action: "PAY_NOW",
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      }),
    },
  );
}

export async function capturePayPalOrder(orderId: string) {
  return paypalFetch<any>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST" });
}

export async function verifyPayPalWebhook(params: {
  headers: Headers;
  body: string;
  webhookId: string;
  env?: PayPalEnv;
}): Promise<boolean> {
  const env = params.env ?? getPayPalEnv();
  const payload = {
    auth_algo: params.headers.get("paypal-auth-algo"),
    cert_url: params.headers.get("paypal-cert-url"),
    transmission_id: params.headers.get("paypal-transmission-id"),
    transmission_sig: params.headers.get("paypal-transmission-sig"),
    transmission_time: params.headers.get("paypal-transmission-time"),
    webhook_id: params.webhookId,
    webhook_event: JSON.parse(params.body),
  };
  try {
    const res = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body: JSON.stringify(payload) },
      env,
    );
    return res.verification_status === "SUCCESS";
  } catch (e) {
    console.error("[paypal] verify webhook error", e);
    return false;
  }
}
