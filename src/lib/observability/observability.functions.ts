import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { logEvent, type Severity, type Source } from "./log.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  if (!data?.some((r) => r.role === "admin")) {
    throw new Error("admin required");
  }
}

// Public: report a frontend crash (rate-limited, no auth required so we can
// capture pre-login errors). Stored as low-trust info.
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      message: z.string().min(1).max(2000),
      stack: z.string().max(8000).optional(),
      url: z.string().max(2000).optional(),
      kind: z.enum(["js_crash", "unhandled_rejection", "react_error", "manual"]).default("js_crash"),
      context: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await logEvent({
      source: "frontend",
      severity: "error",
      eventType: data.kind,
      message: data.message,
      context: { stack: data.stack, url: data.url, ...(data.context ?? {}) },
      fingerprint: hashFingerprint(`${data.kind}:${data.message}`),
    });
    return { ok: true };
  });

function hashFingerprint(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `fp_${(h >>> 0).toString(16)}`;
}

// ---------- Admin: snapshot + queries ----------

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("system_health_snapshot");
    if (error) throw new Error(error.message);
    return { snapshot: JSON.parse(JSON.stringify(data ?? {})) as Record<string, any> };
  });

export const getErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      severity: z.enum(["info", "warn", "error", "critical", "all"]).default("all"),
      source: z.string().max(40).optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).default({ severity: "all", limit: 100 } as never),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("system_events")
      .select("id, source, severity, event_type, message, context, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.severity !== "all") q = q.eq("severity", data.severity);
    if (data.source) q = q.eq("source", data.source);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getEmailMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("resend_email_log")
      .select("id, recipient, subject, category, template, status, error_message, attempts, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const { count: sent24 } = await supabaseAdmin
      .from("resend_email_log").select("*", { count: "exact", head: true })
      .eq("status", "sent").gt("created_at", since);
    const { count: failed24 } = await supabaseAdmin
      .from("resend_email_log").select("*", { count: "exact", head: true })
      .eq("status", "failed").gt("created_at", since);
    const { count: pending24 } = await supabaseAdmin
      .from("resend_email_log").select("*", { count: "exact", head: true })
      .eq("status", "pending").gt("created_at", since);
    return {
      stats: { sent24: sent24 ?? 0, failed24: failed24 ?? 0, pending24: pending24 ?? 0 },
      recent: recent ?? [],
    };
  });

export const getBillingMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: webhookEvents } = await supabaseAdmin
      .from("system_events")
      .select("id, severity, event_type, message, context, created_at")
      .in("source", ["webhook", "billing"])
      .order("created_at", { ascending: false })
      .limit(80);
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, status, environment, current_period_end, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(40);
    const { count: failed24 } = await supabaseAdmin
      .from("system_events").select("*", { count: "exact", head: true })
      .in("source", ["webhook", "billing"]).eq("severity", "error")
      .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    return {
      stats: { failed24: failed24 ?? 0, recentSubs: subs?.length ?? 0 },
      webhookEvents: webhookEvents ?? [],
      subs: subs ?? [],
    };
  });

export const getActiveAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("alerts_fired")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { alerts: data ?? [] };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("alerts_fired")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Evaluator: scans recent signals, fires alerts ----------
// Idempotent: dedupes per (rule_key, hour) before insert.
async function maybeFire(rule: { key: string; severity: Severity; title: string; details: Record<string, unknown> }) {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("alerts_fired").select("id")
    .eq("rule_key", rule.key).gt("created_at", hourAgo).limit(1);
  if (existing && existing.length > 0) return false;
  const { error } = await supabaseAdmin.from("alerts_fired").insert({
    rule_key: rule.key,
    severity: rule.severity,
    title: rule.title,
    details: rule.details as never,
  });
  if (error) {
    await logEvent({ source: "server_fn", severity: "warn", eventType: "alert_insert_failed", message: error.message });
    return false;
  }
  return true;
}

export const evaluateAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return runEvaluation();
  });

export async function runEvaluation(): Promise<{ fired: string[] }> {
  const fired: string[] = [];
  const since = new Date(Date.now() - 3600_000).toISOString();

  // 1. Failed emails: >5 failures in 1h
  const { count: failedEmails } = await supabaseAdmin
    .from("resend_email_log").select("*", { count: "exact", head: true })
    .eq("status", "failed").gt("created_at", since);
  if ((failedEmails ?? 0) > 5) {
    if (await maybeFire({
      key: "email_failures_1h", severity: "error",
      title: `Email delivery degraded (${failedEmails} failures in last hour)`,
      details: { failedEmails },
    })) fired.push("email_failures_1h");
  }

  // 2. Webhook failures: >3 errors in 1h on source 'webhook'
  const { count: webhookErrors } = await supabaseAdmin
    .from("system_events").select("*", { count: "exact", head: true })
    .eq("source", "webhook").eq("severity", "error").gt("created_at", since);
  if ((webhookErrors ?? 0) > 3) {
    if (await maybeFire({
      key: "webhook_failures_1h", severity: "error",
      title: `Webhook failures spiking (${webhookErrors} in last hour)`,
      details: { webhookErrors },
    })) fired.push("webhook_failures_1h");
  }

  // 3. AI outage: >3 errors on ai source in 1h
  const { count: aiErrors } = await supabaseAdmin
    .from("system_events").select("*", { count: "exact", head: true })
    .eq("source", "ai").in("severity", ["error", "critical"]).gt("created_at", since);
  if ((aiErrors ?? 0) > 3) {
    if (await maybeFire({
      key: "ai_outage_1h", severity: "critical",
      title: `AI provider errors spiking (${aiErrors} in last hour)`,
      details: { aiErrors },
    })) fired.push("ai_outage_1h");
  }

  // 4. Auth spike: >20 signin_failed in 1h
  const { count: authFails } = await supabaseAdmin
    .from("auth_events").select("*", { count: "exact", head: true })
    .eq("event_type", "signin_failed").gt("created_at", since);
  if ((authFails ?? 0) > 20) {
    if (await maybeFire({
      key: "auth_failure_spike_1h", severity: "warn",
      title: `Auth failure spike: ${authFails} failed sign-ins in last hour`,
      details: { authFails },
    })) fired.push("auth_failure_spike_1h");
  }

  // 5. Database anomalies: any 'db' source error
  const { count: dbErrors } = await supabaseAdmin
    .from("system_events").select("*", { count: "exact", head: true })
    .eq("source", "db").in("severity", ["error", "critical"]).gt("created_at", since);
  if ((dbErrors ?? 0) > 0) {
    if (await maybeFire({
      key: "db_anomaly_1h", severity: "error",
      title: `Database errors detected (${dbErrors} in last hour)`,
      details: { dbErrors },
    })) fired.push("db_anomaly_1h");
  }

  // 6. Rate-limit alerts
  const { count: rateHits } = await supabaseAdmin
    .from("system_events").select("*", { count: "exact", head: true })
    .eq("source", "rate_limit").gt("created_at", since);
  if ((rateHits ?? 0) > 50) {
    if (await maybeFire({
      key: "rate_limit_pressure_1h", severity: "warn",
      title: `Rate limit pressure: ${rateHits} hits in last hour`,
      details: { rateHits },
    })) fired.push("rate_limit_pressure_1h");
  }

  return { fired };
}

// Type re-exports for consumers
export type { Severity, Source };
