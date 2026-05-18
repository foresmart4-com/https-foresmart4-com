// Resend email service — server-side only.
// Handles delivery via Resend API with retry, exponential backoff, and DB logging.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  renderTest,
  renderOtp,
  renderPasswordReset,
  renderAuthConfirm,
  renderAiAlert,
  renderRiskAlert,
  renderSubscriptionNotice,
  renderSecurityNotice,
  renderInvitation,
  type Lang,
  type AiAlertPayload,
  type RiskAlertPayload,
  type SubscriptionPayload,
  type SecurityNoticePayload,
  type InvitationPayload,
} from "./templates.server";

const RESEND_API = "https://api.resend.com/emails";
export const PRIMARY_SENDER = "ForeSmart <foresmart4@foresmart4.com>";

export type EmailCategory =
  | "test" | "auth" | "otp" | "password_reset"
  | "ai_alert" | "risk_alert" | "subscription" | "security" | "invitation";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  template: string;
  category: EmailCategory;
  lang: Lang;
  userId?: string | null;
  replyTo?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  logId: string;
  attempts: number;
}

function getApiKey(): string {
  const k = process.env.RESEND_API_KEY;
  if (!k) throw new Error("RESEND_API_KEY is not configured");
  return k;
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function logInsert(args: SendArgs): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("resend_email_log")
    .insert({
      user_id: args.userId ?? null,
      recipient: args.to,
      subject: args.subject,
      template: args.template,
      category: args.category,
      lang: args.lang,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Log insert failed: ${error?.message}`);
  return data.id as string;
}

interface LogPatch {
  status?: string;
  provider_message_id?: string | null;
  attempts?: number;
  error_message?: string | null;
}
async function logUpdate(id: string, patch: LogPatch): Promise<void> {
  await supabaseAdmin.from("resend_email_log").update(patch).eq("id", id);
}

async function sendOnce(args: SendArgs): Promise<{ id: string }> {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PRIMARY_SENDER,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`;
    const retryable = res.status === 429 || res.status >= 500;
    const err = new Error(msg);
    (err as any).retryable = retryable;
    throw err;
  }
  return { id: json?.id ?? "" };
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!isValidEmail(args.to)) {
    throw new Error("Invalid recipient email");
  }

  const logId = await logInsert(args);
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { id } = await sendOnce(args);
      await logUpdate(logId, {
        status: "sent",
        provider_message_id: id,
        attempts: attempt,
        error_message: null,
      });
      return { success: true, messageId: id, logId, attempts: attempt };
    } catch (e: any) {
      lastErr = e;
      const retryable = !!e?.retryable;
      if (!retryable || attempt === maxAttempts) break;
      const backoff = 400 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : "unknown error";
  await logUpdate(logId, {
    status: "failed",
    attempts: maxAttempts,
    error_message: errMsg.slice(0, 500),
  });
  return { success: false, error: errMsg, logId, attempts: maxAttempts };
}

// ============ Typed high-level senders ============

export function sendTestEmail(to: string, lang: Lang = "en", userId?: string) {
  const t = renderTest(lang);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "test", category: "test", lang, userId });
}

export function sendOtpEmail(to: string, code: string, lang: Lang = "en", userId?: string, minutes = 10) {
  const t = renderOtp(lang, code, minutes);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "otp", category: "otp", lang, userId });
}

export function sendPasswordResetEmail(to: string, resetUrl: string, lang: Lang = "en", userId?: string) {
  const t = renderPasswordReset(lang, resetUrl);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "password_reset", category: "password_reset", lang, userId });
}

export function sendAuthConfirmEmail(to: string, confirmUrl: string, lang: Lang = "en", userId?: string) {
  const t = renderAuthConfirm(lang, confirmUrl);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "auth_confirm", category: "auth", lang, userId });
}

export function sendAiAlertEmail(to: string, payload: AiAlertPayload, lang: Lang = "en", userId?: string) {
  const t = renderAiAlert(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "ai_alert", category: "ai_alert", lang, userId });
}

export function sendRiskAlertEmail(to: string, payload: RiskAlertPayload, lang: Lang = "en", userId?: string) {
  const t = renderRiskAlert(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "risk_alert", category: "risk_alert", lang, userId });
}

export function sendSubscriptionEmail(to: string, payload: SubscriptionPayload, lang: Lang = "en", userId?: string) {
  const t = renderSubscriptionNotice(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "subscription", category: "subscription", lang, userId });
}

export function sendSecurityEmail(to: string, payload: SecurityNoticePayload, lang: Lang = "en", userId?: string) {
  const t = renderSecurityNotice(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "security", category: "security", lang, userId });
}

// ============ Health monitoring ============

export interface EmailHealth {
  configured: boolean;
  sender: string;
  windowHours: number;
  totals: { sent: number; failed: number; pending: number; total: number };
  successRate: number;
  status: "ok" | "degraded" | "down" | "unconfigured";
  lastError?: string | null;
  lastSentAt?: string | null;
}

export async function getEmailHealth(windowHours = 24): Promise<EmailHealth> {
  const configured = !!process.env.RESEND_API_KEY;
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("resend_email_log")
    .select("status, error_message, updated_at")
    .gte("created_at", since)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    return {
      configured, sender: PRIMARY_SENDER, windowHours,
      totals: { sent: 0, failed: 0, pending: 0, total: 0 },
      successRate: 0, status: configured ? "degraded" : "unconfigured",
      lastError: error.message,
    };
  }

  const rows = data ?? [];
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const total = rows.length;
  const successRate = total ? sent / total : 1;

  const lastFailed = rows.find((r) => r.status === "failed");
  const lastSent = rows.find((r) => r.status === "sent");

  let status: EmailHealth["status"] = "ok";
  if (!configured) status = "unconfigured";
  else if (total > 0 && successRate < 0.5) status = "down";
  else if (total > 0 && successRate < 0.9) status = "degraded";

  return {
    configured, sender: PRIMARY_SENDER, windowHours,
    totals: { sent, failed, pending, total },
    successRate: Math.round(successRate * 1000) / 1000,
    status,
    lastError: lastFailed?.error_message ?? null,
    lastSentAt: lastSent?.updated_at ?? null,
  };
}

export function sendInvitationEmail(to: string, payload: InvitationPayload, lang: Lang = "en", userId?: string) {
  const t = renderInvitation(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "invitation", category: "invitation", lang, userId });
}
