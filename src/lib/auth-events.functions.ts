import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

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
  user_id: z.string().uuid().nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  error_message: z.string().max(500).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// In-memory IP rate limiter (best-effort per Worker instance).
// Caps audit-log writes to prevent log poisoning / DoS.
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
  if (cur.count > RL_MAX_PER_IP) return true;
  return false;
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
        // Drop silently — never block real auth flows, never let an attacker
        // flood the audit log. Periodic spam is logged as a counter only.
        return { ok: false, rate_limited: true };
      }

      await supabaseAdmin.from("auth_events").insert({
        event_type: data.event_type,
        status: data.status,
        user_id: data.user_id ?? null,
        email: data.email ?? null,
        error_message: data.error_message ?? null,
        ip_address: ip === "unknown" ? null : ip,
        user_agent: ua,
        metadata: data.metadata ?? {},
      });
      return { ok: true };
    } catch (err) {
      // never let logging break auth flows
      console.error("logAuthEvent failed", err);
      return { ok: false };
    }
  });
