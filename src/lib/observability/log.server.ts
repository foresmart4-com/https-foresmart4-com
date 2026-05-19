// Server-side observability writer. Fire-and-forget; never throws.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Severity = "info" | "warn" | "error" | "critical";
export type Source =
  | "frontend" | "server_fn" | "webhook" | "email" | "ai"
  | "db" | "auth" | "billing" | "rate_limit" | "broker";

export interface LogEventInput {
  source: Source;
  severity: Severity;
  eventType: string;
  message?: string;
  context?: Record<string, unknown>;
  userId?: string | null;
  requestId?: string | null;
  fingerprint?: string | null;
}

function safeContext(ctx: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(ctx ?? {}));
  } catch {
    return { _serializationError: true };
  }
}

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await supabaseAdmin.from("system_events").insert({
      source: input.source,
      severity: input.severity,
      event_type: input.eventType,
      message: input.message?.slice(0, 2000) ?? null,
      context: safeContext(input.context) as never,
      user_id: input.userId ?? null,
      request_id: input.requestId ?? null,
      fingerprint: input.fingerprint ?? null,
    });
  } catch (e) {
    // Last-resort: never propagate observability failures.
    console.error("[observability] logEvent failed", e);
  }

  // Optional Sentry forwarding (no SDK dependency — uses Envelope HTTP API
  // only if SENTRY_DSN is configured as a secret).
  const dsn = process.env.SENTRY_DSN;
  if (dsn && (input.severity === "error" || input.severity === "critical")) {
    try {
      await forwardToSentry(dsn, input);
    } catch {
      /* ignore */
    }
  }
}

// Minimal Sentry envelope POST (no dependency). Only used if SENTRY_DSN exists.
async function forwardToSentry(dsn: string, input: LogEventInput): Promise<void> {
  // dsn format: https://<key>@oXXX.ingest.sentry.io/<project>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) return;
  const [, key, host, project] = m;
  const url = `https://${host}/api/${project}/store/`;
  const body = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    level: input.severity === "critical" ? "fatal" : input.severity,
    logger: input.source,
    message: { formatted: `${input.eventType}: ${input.message ?? ""}` },
    tags: { source: input.source, event_type: input.eventType },
    extra: input.context ?? {},
    user: input.userId ? { id: input.userId } : undefined,
  };
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=foresmart-edge/1.0`,
    },
    body: JSON.stringify(body),
  });
}
