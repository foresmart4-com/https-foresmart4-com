import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";

const Input = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  interested_plan: z.enum(["trial", "quarterly", "semi_annual", "annual"]).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const RL_WINDOW_SEC = 3600; // 1 hour
const RL_MAX_PER_IP = 5;
const RL_GLOBAL_MAX = 500;

function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) | 0;
  return `ip_${(h >>> 0).toString(16)}`;
}

function getClientIp(): string {
  try {
    const req = getRequest();
    const xff = req?.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const cf = req?.headers.get("cf-connecting-ip");
    if (cf) return cf;
  } catch {}
  return "unknown";
}

export const submitInterestLead = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const ipHash = hashIp(ip);

    try {
      const [ipR, globalR] = await Promise.all([
        supabaseAdmin.rpc("rate_limit_hit", {
          _bucket_key: `interest_lead:ip:${ipHash}`,
          _window_seconds: RL_WINDOW_SEC,
          _max_hits: RL_MAX_PER_IP,
        }),
        supabaseAdmin.rpc("rate_limit_hit", {
          _bucket_key: "interest_lead:global",
          _window_seconds: RL_WINDOW_SEC,
          _max_hits: RL_GLOBAL_MAX,
        }),
      ]);
      const ipAllowed = ipR.data?.[0]?.allowed ?? true;
      const globalAllowed = globalR.data?.[0]?.allowed ?? true;
      if (!ipAllowed || !globalAllowed) {
        throw new Error("RATE_LIMITED");
      }
    } catch (e: any) {
      if (e?.message === "RATE_LIMITED") {
        throw new Error("Too many submissions. Please try again later.");
      }
      // Fail-closed on RPC error
      throw new Error("Service temporarily unavailable. Please try again.");
    }

    const { error } = await supabaseAdmin.from("interest_leads").insert({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      interested_plan: data.interested_plan ?? null,
      notes: data.notes || null,
      status: "new",
    });

    if (error) {
      throw new Error("Could not submit. Please try again.");
    }
    return { ok: true };
  });
