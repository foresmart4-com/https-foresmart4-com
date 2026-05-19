// Resend email service — server-side only.
// Hardened: rate-limit, retries, provider response capture, plain-text fallback,
// List-Unsubscribe header, language auto-detect, structured logging.

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
  renderWelcome,
  renderTrial,
  renderNotification,
  htmlToText,
  type Lang,
  type AiAlertPayload,
  type RiskAlertPayload,
  type SubscriptionPayload,
  type SecurityNoticePayload,
  type InvitationPayload,
  type WelcomePayload,
  type TrialPayload,
  type NotificationPayload,
} from "./templates.server";

const RESEND_API = "https://api.resend.com/emails";
export const PRIMARY_SENDER = "ForeSmart <foresmart4@foresmart4.com>";
const UNSUBSCRIBE_URL = "https://foresmart4.com/settings#notifications";

export type EmailCategory =
  | "test" | "auth" | "otp" | "password_reset" | "welcome" | "trial"
  | "ai_alert" | "risk_alert" | "subscription" | "security" | "invitation" | "notification";

// Per-recipient rate limits per 1h sliding window (anti-abuse / loop protection)
const RATE_LIMITS: Partial<Record<EmailCategory, number>> = {
  test: 5,
  otp: 6,
  password_reset: 5,
  auth: 6,
  welcome: 2,
  trial: 4,
  ai_alert: 30,
  risk_alert: 20,
  subscription: 10,
  security: 10,
  invitation: 10,
  notification: 30,
};
const GLOBAL_RECIPIENT_LIMIT_PER_HOUR = 60;

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
  rateLimited?: boolean;
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
  provider_response?: unknown;
}
async function logUpdate(id: string, patch: LogPatch): Promise<void> {
  await supabaseAdmin.from("resend_email_log").update(patch as any).eq("id", id);
}

// ============ Rate limiting ============

async function checkRateLimit(recipient: string, category: EmailCategory): Promise<{ allowed: boolean; reason?: string }> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("resend_email_log")
    .select("category")
    .eq("recipient", recipient)
    .gte("created_at", since);
  if (error) return { allowed: true }; // fail-open on logger error, but emit warning
  const rows = data ?? [];
  if (rows.length >= GLOBAL_RECIPIENT_LIMIT_PER_HOUR) {
    return { allowed: false, reason: `Global hourly limit reached (${GLOBAL_RECIPIENT_LIMIT_PER_HOUR})` };
  }
  const catLimit = RATE_LIMITS[category];
  if (catLimit) {
    const catCount = rows.filter((r: any) => r.category === category).length;
    if (catCount >= catLimit) {
      return { allowed: false, reason: `Category limit reached: ${category} (${catLimit}/h)` };
    }
  }
  return { allowed: true };
}

async function recordRateLimitHit(recipient: string, userId: string | null | undefined, category: EmailCategory, reason: string): Promise<void> {
  try {
    await supabaseAdmin.from("email_rate_limit").insert({
      recipient, user_id: userId ?? null, category, count: 1,
    });
    console.warn(`[email] rate-limited`, { recipient, category, reason });
  } catch (e) {
    console.error("[email] failed to record rate limit", e);
  }
}

// ============ Provider call ============

async function sendOnce(args: SendArgs): Promise<{ id: string; raw: unknown }> {
  const text = htmlToText(args.html);
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
      text,
      headers: {
        "List-Unsubscribe": `<${UNSUBSCRIBE_URL}>, <mailto:foresmart4@foresmart4.com?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": crypto.randomUUID(),
      },
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  const raw: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = raw?.message ?? raw?.error ?? `HTTP ${res.status}`;
    const retryable = res.status === 429 || res.status >= 500;
    const err: any = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.retryable = retryable;
    err.providerResponse = { status: res.status, body: raw };
    throw err;
  }
  return { id: raw?.id ?? "", raw: { status: res.status, body: raw } };
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!isValidEmail(args.to)) {
    throw new Error("Invalid recipient email");
  }

  // Pre-send rate limit check
  const rl = await checkRateLimit(args.to, args.category);
  if (!rl.allowed) {
    await recordRateLimitHit(args.to, args.userId, args.category, rl.reason ?? "");
    const logId = await logInsert(args);
    await logUpdate(logId, { status: "rate_limited", error_message: rl.reason ?? "rate limit" });
    return { success: false, error: rl.reason ?? "rate limit", logId, attempts: 0, rateLimited: true };
  }

  const logId = await logInsert(args);
  const maxAttempts = 3;
  let lastErr: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { id, raw } = await sendOnce(args);
      await logUpdate(logId, {
        status: "sent",
        provider_message_id: id,
        attempts: attempt,
        error_message: null,
        provider_response: raw,
      });
      return { success: true, messageId: id, logId, attempts: attempt };
    } catch (e: any) {
      lastErr = e;
      const retryable = !!e?.retryable;
      // Persist last provider response on every attempt so admins see context
      await logUpdate(logId, {
        attempts: attempt,
        error_message: String(e?.message ?? "unknown").slice(0, 500),
        provider_response: e?.providerResponse ?? null,
      });
      if (!retryable || attempt === maxAttempts) break;
      const backoff = 400 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : "unknown error";
  await logUpdate(logId, {
    status: "failed",
    error_message: errMsg.slice(0, 500),
    provider_response: lastErr?.providerResponse ?? null,
  });
  // Surface failure in server logs so it never silently disappears
  console.error("[email] send failed", { to: args.to, category: args.category, error: errMsg });
  return { success: false, error: errMsg, logId, attempts: maxAttempts };
}

// ============ Language auto-detection ============

export async function detectLang(userId?: string | null, acceptLanguage?: string | null): Promise<Lang> {
  if (userId) {
    try {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("language")
        .eq("id", userId)
        .maybeSingle();
      const l = (data as any)?.language;
      if (l === "ar" || l === "en") return l;
    } catch { /* fall through */ }
  }
  if (acceptLanguage && /\bar\b/i.test(acceptLanguage)) return "ar";
  return "en";
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

export function sendWelcomeEmail(to: string, payload: WelcomePayload = {}, lang: Lang = "en", userId?: string) {
  const t = renderWelcome(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "welcome", category: "welcome", lang, userId });
}

export function sendTrialEmail(to: string, payload: TrialPayload, lang: Lang = "en", userId?: string) {
  const t = renderTrial(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "trial", category: "trial", lang, userId });
}

export function sendNotificationEmail(to: string, payload: NotificationPayload, lang: Lang = "en", userId?: string) {
  const t = renderNotification(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "notification", category: "notification", lang, userId });
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

export function sendInvitationEmail(to: string, payload: InvitationPayload, lang: Lang = "en", userId?: string) {
  const t = renderInvitation(lang, payload);
  return sendEmail({ to, subject: t.subject, html: t.html, template: "invitation", category: "invitation", lang, userId });
}

// ============ Admin diagnostics ============

export interface EmailHealth {
  configured: boolean;
  sender: string;
  windowHours: number;
  totals: { sent: number; failed: number; pending: number; rateLimited: number; total: number };
  successRate: number;
  status: "ok" | "degraded" | "down" | "unconfigured";
  lastError?: string | null;
  lastSentAt?: string | null;
  lastSent?: { recipient: string; subject: string; template: string; sentAt: string } | null;
  dnsHints: { spf: string; dkim: string; dmarc: string };
}

export async function getEmailHealth(windowHours = 24): Promise<EmailHealth> {
  const configured = !!process.env.RESEND_API_KEY;
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("resend_email_log")
    .select("status, error_message, updated_at, recipient, subject, template")
    .gte("created_at", since)
    .order("updated_at", { ascending: false })
    .limit(1000);

  const dnsHints = {
    spf: 'v=spf1 include:_spf.resend.com ~all (TXT @ foresmart4.com)',
    dkim: 'resend._domainkey CNAME (provided in Resend dashboard for foresmart4.com)',
    dmarc: 'v=DMARC1; p=quarantine; rua=mailto:foresmart4@foresmart4.com (TXT _dmarc.foresmart4.com)',
  };

  if (error) {
    return {
      configured, sender: PRIMARY_SENDER, windowHours,
      totals: { sent: 0, failed: 0, pending: 0, rateLimited: 0, total: 0 },
      successRate: 0, status: configured ? "degraded" : "unconfigured",
      lastError: error.message, lastSent: null, dnsHints,
    };
  }

  const rows = data ?? [];
  const sent = rows.filter((r: any) => r.status === "sent").length;
  const failed = rows.filter((r: any) => r.status === "failed").length;
  const pending = rows.filter((r: any) => r.status === "pending").length;
  const rateLimited = rows.filter((r: any) => r.status === "rate_limited").length;
  const total = rows.length;
  const successRate = total ? sent / total : 1;

  const lastFailed = rows.find((r: any) => r.status === "failed");
  const lastSent = rows.find((r: any) => r.status === "sent");

  let status: EmailHealth["status"] = "ok";
  if (!configured) status = "unconfigured";
  else if (total > 0 && successRate < 0.5) status = "down";
  else if (total > 0 && successRate < 0.9) status = "degraded";

  return {
    configured, sender: PRIMARY_SENDER, windowHours,
    totals: { sent, failed, pending, rateLimited, total },
    successRate: Math.round(successRate * 1000) / 1000,
    status,
    lastError: lastFailed?.error_message ?? null,
    lastSentAt: lastSent?.updated_at ?? null,
    lastSent: lastSent ? {
      recipient: (lastSent as any).recipient,
      subject: (lastSent as any).subject,
      template: (lastSent as any).template,
      sentAt: (lastSent as any).updated_at,
    } : null,
    dnsHints,
  };
}

export interface RecentEmailRow {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  category: string;
  lang: string;
  status: string;
  attempts: number;
  error_message: string | null;
  provider_message_id: string | null;
  provider_response: any;
  created_at: string;
  updated_at: string;
}

export async function getRecentEmails(limit = 50, status?: string): Promise<RecentEmailRow[]> {
  let q = supabaseAdmin
    .from("resend_email_log")
    .select("id, recipient, subject, template, category, lang, status, attempts, error_message, provider_message_id, provider_response, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RecentEmailRow[];
}

// Retry a previously failed email by re-sending via the same template/category.
export async function retryEmail(logId: string): Promise<SendResult> {
  const { data, error } = await supabaseAdmin
    .from("resend_email_log")
    .select("recipient, subject, template, category, lang, user_id, status")
    .eq("id", logId)
    .maybeSingle();
  if (error || !data) throw new Error("Email log not found");
  if (data.status === "sent") throw new Error("Already sent");
  // We can only resend a generic notification re-render because the original payload isn't stored.
  // We render a minimal notification reusing the original subject so the admin can manually re-trigger.
  const lang = (data.lang === "ar" ? "ar" : "en") as Lang;
  const t = renderNotification(lang, {
    title: data.subject,
    message: lang === "ar" ? "إعادة إرسال يدوية من قبل المسؤول." : "Manual resend triggered by an administrator.",
  });
  return sendEmail({
    to: data.recipient,
    subject: t.subject,
    html: t.html,
    template: data.template,
    category: data.category as EmailCategory,
    lang,
    userId: data.user_id,
  });
}
