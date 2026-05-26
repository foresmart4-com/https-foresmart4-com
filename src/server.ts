import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { vaultStatus } from "./services/security/encryption";

let vaultChecked = false;
function warnIfVaultMissing() {
  if (vaultChecked) return;
  vaultChecked = true;
  const s = vaultStatus();
  if (!s.ok) {
    console.warn(`[vault] ${s.message}`);
  }
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://*.stripe.com https://*.paypal.com https://api.moyasar.com",
].join("; ");

function injectSecurityHeaders(response: Response): Response {
  const h = new Headers(response.headers);
  if (!h.has("x-frame-options"))       h.set("x-frame-options", "DENY");
  if (!h.has("x-content-type-options")) h.set("x-content-type-options", "nosniff");
  if (!h.has("referrer-policy"))        h.set("referrer-policy", "strict-origin-when-cross-origin");
  if (!h.has("permissions-policy"))     h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (!h.has("content-security-policy")) h.set("content-security-policy", CSP);
  if (!h.has("cross-origin-opener-policy")) h.set("cross-origin-opener-policy", "same-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    warnIfVaultMissing();
    let response: Response;
    try {
      const handler = await getServerEntry();
      response = await handler.fetch(request, env, ctx);
      response = await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      response = brandedErrorResponse();
    }
    return injectSecurityHeaders(response);
  },
};
