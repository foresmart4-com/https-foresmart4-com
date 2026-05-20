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
  metadata: z
    .record(
      z.string().max(40),
      z.union([z.string().max(200), z.number(), z.boolean(), z.null()]),
    )
    .refine((v) => Object.keys(v).length <= 10, {
      message: "metadata exceeds 10 keys",
    })
    .optional(),
});

// In-memory IP rate limiter (per-Worker fast path). Authoritative limit
// below uses Postgres atomic counters and is consistent across all Workers.
const RL_WINDOW_MS = 60_000;
const RL_MAX_PER_IP = 10;
const RL_GLOBAL_MAX = 200;
const rlMap = new Map<string, { count: number; resetAt: number }>();
function localRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = rlMap.get(ip);
  if (!cur || cur.resetAt < now) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > RL_MAX_PER_IP;
}
function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) | 0;
  return `ip_${(h >>> 0).toString(16)}`;
}
async function distributedRateLimited(ip: string): Promise<boolean> {
  try {
    const windowSec = Math.floor(RL_WINDOW_MS / 1000);
    const ipHash = hashIp(ip);
    const [ipR, globalR] = await Promise.all([
      supabaseAdmin.rpc("rate_limit_hit", {
        _bucket_key: `auth_event:ip:${ipHash}`,
        _window_seconds: windowSec,
        _max_hits: RL_MAX_PER_IP,
      }),
      supabaseAdmin.rpc("rate_limit_hit", {
        _bucket_key: "auth_event:global",
        _window_seconds: windowSec,
        _max_hits: RL_GLOBAL_MAX,
      }),
    ]);
    const ipAllowed = ipR.data?.[0]?.allowed ?? true;
    const globalAllowed = globalR.data?.[0]?.allowed ?? true;
    return !ipAllowed || !globalAllowed;
  } catch {
    // Fail-closed: prefer dropping events over allowing flood under DB error.
    return true;
  }
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

      if (localRateLimited(ip) || (await distributedRateLimited(ip))) {
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
