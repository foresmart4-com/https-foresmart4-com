import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

// Client may only declare WHAT happened. Identity (user_id/email) is derived
// server-side from the Supabase session — never trusted from the client.
const EventType = z.enum([
  "signup",
  "signup_failed",
  "signin",
  "signin_failed",
  "signout",
  "password_reset_request",
  "password_update",
]);

const Input = z.object({
  event_type: EventType,
  status: z.enum(["ok", "error"]).default("ok"),
  error_message: z.string().max(500).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// In-memory IP rate limiter (best-effort per Worker instance).
const RL_WINDOW_MS = 60_000;
const RL_MAX_PER_IP = 20;
const rlMap = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = rlMap.get(ip);
  if (!cur || cur.resetAt < now) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > RL_MAX_PER_IP;
}

async function deriveIdentityFromSession(): Promise<{ user_id: string | null; email: string | null }> {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) return { user_id: null, email: null };
    const token = authHeader.slice(7).trim();
    if (!token) return { user_id: null, email: null };
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { user_id: null, email: null };
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return { user_id: null, email: null };
    return { user_id: data.user.id, email: data.user.email ?? null };
  } catch {
    return { user_id: null, email: null };
  }
}

export const logAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    try {
      const ip =
        getRequestHeader("cf-connecting-ip") ||
        getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      const ua = getRequestHeader("user-agent") ?? null;

      if (rateLimited(ip)) {
        return { ok: false, rate_limited: true };
      }

      const { user_id, email } = await deriveIdentityFromSession();

      await supabaseAdmin.from("auth_events").insert({
        event_type: data.event_type,
        status: data.status,
        user_id,
        email,
        error_message: data.error_message ?? null,
        ip_address: ip === "unknown" ? null : ip,
        user_agent: ua,
        metadata: data.metadata ?? {},
      });
      return { ok: true };
    } catch (err) {
      console.error("logAuthEvent failed", err);
      return { ok: false };
    }
  });
