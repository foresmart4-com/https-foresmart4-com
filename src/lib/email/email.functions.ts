// Client-callable server functions for Resend email (auth-protected).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendTestEmail,
  sendAiAlertEmail,
  sendRiskAlertEmail,
  sendSubscriptionEmail,
  sendSecurityEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  getEmailHealth,
} from "./resend.server";

const langSchema = z.enum(["ar", "en"]).default("en");
const emailSchema = z.string().email().max(320);

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// Authenticated user sends test to themselves
export const sendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: emailSchema.optional(), lang: langSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: { user } } = await context.supabase.auth.getUser();
    const recipient = data.to ?? user?.email;
    if (!recipient) throw new Error("No recipient email available");
    // Non-admins may only send test to themselves
    if (!(await isAdmin(context.userId)) && recipient !== user?.email) {
      throw new Error("Forbidden: can only test your own email");
    }
    return sendTestEmail(recipient, data.lang, context.userId);
  });

export const sendOtpEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: emailSchema,
    code: z.string().min(4).max(10).regex(/^[A-Za-z0-9]+$/),
    minutes: z.number().int().min(1).max(60).default(10),
    lang: langSchema,
  }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden");
    return sendOtpEmail(data.to, data.code, data.lang, context.userId, data.minutes);
  });

export const sendPasswordResetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: emailSchema, resetUrl: z.string().url(), lang: langSchema }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden");
    return sendPasswordResetEmail(data.to, data.resetUrl, data.lang, context.userId);
  });

export const sendAiAlertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: emailSchema.optional(),
    symbol: z.string().min(1).max(20),
    signal: z.string().min(1).max(40),
    confidence: z.number().min(0).max(100).optional(),
    price: z.string().max(40).optional(),
    reason: z.string().max(300).optional(),
    lang: langSchema,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: { user } } = await context.supabase.auth.getUser();
    const to = data.to ?? user?.email;
    if (!to) throw new Error("No recipient");
    if (!(await isAdmin(context.userId)) && to !== user?.email) throw new Error("Forbidden");
    return sendAiAlertEmail(to, { symbol: data.symbol, signal: data.signal, confidence: data.confidence, price: data.price, reason: data.reason }, data.lang, context.userId);
  });

export const sendRiskAlertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: emailSchema.optional(),
    severity: z.enum(["info", "warning", "critical"]),
    message: z.string().min(1).max(500),
    metric: z.string().max(80).optional(),
    value: z.string().max(80).optional(),
    lang: langSchema,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: { user } } = await context.supabase.auth.getUser();
    const to = data.to ?? user?.email;
    if (!to) throw new Error("No recipient");
    if (!(await isAdmin(context.userId)) && to !== user?.email) throw new Error("Forbidden");
    return sendRiskAlertEmail(to, { severity: data.severity, message: data.message, metric: data.metric, value: data.value }, data.lang, context.userId);
  });

export const sendSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: emailSchema.optional(),
    event: z.enum(["trial_started", "renewed", "canceled", "past_due", "upgraded"]),
    planName: z.string().min(1).max(80),
    endsAt: z.string().max(40).optional(),
    lang: langSchema,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: { user } } = await context.supabase.auth.getUser();
    const to = data.to ?? user?.email;
    if (!to) throw new Error("No recipient");
    if (!(await isAdmin(context.userId)) && to !== user?.email) throw new Error("Forbidden");
    return sendSubscriptionEmail(to, { event: data.event, planName: data.planName, endsAt: data.endsAt }, data.lang, context.userId);
  });

export const sendSecurityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: emailSchema.optional(),
    event: z.string().min(1).max(200),
    ip: z.string().max(64).optional(),
    device: z.string().max(120).optional(),
    location: z.string().max(120).optional(),
    at: z.string().max(40).optional(),
    lang: langSchema,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: { user } } = await context.supabase.auth.getUser();
    const to = data.to ?? user?.email;
    if (!to) throw new Error("No recipient");
    if (!(await isAdmin(context.userId)) && to !== user?.email) throw new Error("Forbidden");
    return sendSecurityEmail(to, { event: data.event, ip: data.ip, device: data.device, location: data.location, at: data.at }, data.lang, context.userId);
  });

// Health check — admins only
export const getEmailHealthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ windowHours: z.number().int().min(1).max(168).default(24) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden: admin only");
    return getEmailHealth(data.windowHours);
  });
