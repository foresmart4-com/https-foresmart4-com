import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CONFIG_ID = "00000000-0000-0000-0000-000000000001";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin required");
}

export const getCompanyTradingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("company_trading_config")
      .select("*")
      .eq("id", CONFIG_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const UpdateInput = z.object({
  enabled: z.boolean().optional(),
  live_trading_enabled: z.boolean().optional(),
  broker_name: z.string().max(40).nullable().optional(),
  max_trade_size_usdt: z.number().positive().max(1_000_000).optional(),
  daily_loss_limit_usdt: z.number().positive().max(1_000_000).optional(),
  allowed_assets: z.array(z.string().min(1).max(20)).max(50).optional(),
  approval_required: z.boolean().optional(),
});

export const updateCompanyTradingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Fetch current to enforce live-trading guard
    const { data: current } = await supabaseAdmin
      .from("company_trading_config")
      .select("broker_connected")
      .eq("id", CONFIG_ID)
      .maybeSingle();

    const patch: Record<string, unknown> = { ...data, updated_by: context.userId, updated_at: new Date().toISOString() };

    // Hard guard: live trading cannot be turned on without a connected broker
    if (data.live_trading_enabled === true && !current?.broker_connected) {
      patch.live_trading_enabled = false;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("company_trading_config")
      .update(patch)
      .eq("id", CONFIG_ID)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("company_trading_audit").insert({
      actor_user_id: context.userId,
      action: "config_update",
      decision: "applied",
      status: "ok",
      context: data as never,
    } as never);

    return updated;
  });

export const listCompanyTradingAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("company_trading_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

const AuditInput = z.object({
  action: z.string().min(1).max(60),
  decision: z.string().max(60).optional(),
  symbol: z.string().max(20).optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  status: z.string().max(40).optional(),
  context: z.record(z.string().max(40), z.unknown()).optional(),
});

export const recordCompanyTradingAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AuditInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("company_trading_audit").insert({
      actor_user_id: context.userId,
      action: data.action,
      decision: data.decision ?? null,
      symbol: data.symbol ?? null,
      side: data.side ?? null,
      quantity: data.quantity ?? null,
      price: data.price ?? null,
      status: data.status ?? "recorded",
      context: (data.context ?? {}) as never,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
