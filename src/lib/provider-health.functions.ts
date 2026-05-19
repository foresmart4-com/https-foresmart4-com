/**
 * Server functions for archiving + reading provider health samples per user.
 * Writes use the service-role admin client (RLS allows only service_role to write).
 * Reads use the authenticated supabase client (RLS restricts to own rows).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SampleInput = z.object({
  provider: z.string().min(1).max(40),
  status: z.enum(["healthy", "degraded", "down", "unknown"]),
  staleState: z.enum(["fresh", "stale", "down"]).nullable().optional(),
  avgLatencyMs: z.number().int().min(0).max(120000).nullable().optional(),
  errorRate: z.number().min(0).max(1).nullable().optional(),
  rateLimited: z.number().int().min(0).max(1_000_000),
  lastSuccessAgeS: z.number().int().min(0).max(86400 * 7).nullable().optional(),
});

export const logProviderHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SampleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin.from("provider_health_log").insert({
      user_id: userId,
      provider: data.provider,
      status: data.status,
      stale_state: data.staleState ?? null,
      avg_latency_ms: data.avgLatencyMs ?? null,
      error_rate: data.errorRate ?? null,
      rate_limited: data.rateLimited,
      last_success_age_s: data.lastSuccessAgeS ?? null,
      metadata: {},
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const TimelineInput = z.object({
  hours: z.number().int().min(1).max(168).default(24),
  provider: z.string().min(1).max(40).default("finnhub"),
});

export const getProviderHealthTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TimelineInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();
    const { data: rows, error } = await supabase
      .from("provider_health_log")
      .select("id, provider, status, stale_state, avg_latency_ms, error_rate, rate_limited, last_success_age_s, recorded_at")
      .eq("provider", data.provider)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false as const, error: error.message, rows: [] };
    return { ok: true as const, rows: rows ?? [] };
  });
