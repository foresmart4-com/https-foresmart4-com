import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assetTypeToCategory, resolveQuote } from "./quote-resolver.server";

const ASSET_TYPES = ["US_STOCK","SAUDI_STOCK","CRYPTO","METAL","COMMODITY","BOND","ETF","CASH"] as const;
const CONDITIONS = ["price_above","price_below","change_above","change_below"] as const;

export type AlertCondition = typeof CONDITIONS[number];
export type AlertAssetType = typeof ASSET_TYPES[number];

export interface PriceAlertRow {
  id: string;
  symbol: string;
  name: string | null;
  asset_type: AlertAssetType;
  market: string | null;
  condition: AlertCondition;
  target_value: number;
  note: string | null;
  enabled: boolean;
  last_checked_at: string | null;
  last_price: number | null;
  last_status: "triggered" | "no_change" | "failed" | "pending" | null;
  last_error: string | null;
  triggered_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertEventRow {
  id: string;
  alert_id: string;
  status: "triggered" | "no_change" | "failed";
  price: number | null;
  message: string | null;
  created_at: string;
}

const CreateInput = z.object({
  symbol: z.string().trim().min(1).max(30).regex(/^[A-Z0-9./\-_]+$/i),
  name: z.string().trim().max(120).optional(),
  asset_type: z.enum(ASSET_TYPES),
  market: z.string().trim().max(40).optional(),
  condition: z.enum(CONDITIONS),
  target_value: z.number().finite(),
  note: z.string().trim().max(200).optional(),
});

const IdInput = z.object({ id: z.string().uuid() });
const ToggleInput = z.object({ id: z.string().uuid(), enabled: z.boolean() });
const UpdateInput = z.object({
  id: z.string().uuid(),
  condition: z.enum(CONDITIONS).optional(),
  target_value: z.number().finite().optional(),
  note: z.string().trim().max(200).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const listPriceAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alerts: PriceAlertRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_price_alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { alerts: (data ?? []) as PriceAlertRow[] };
  });

export const listAlertEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }): Promise<{ events: AlertEventRow[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_alert_events")
      .select("*")
      .eq("user_id", userId)
      .eq("alert_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { events: (rows ?? []) as AlertEventRow[] };
  });

export const createPriceAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("user_price_alerts").insert({
      user_id: userId,
      symbol: data.symbol.toUpperCase(),
      name: data.name ?? null,
      asset_type: data.asset_type,
      market: data.market ?? null,
      condition: data.condition,
      target_value: data.target_value,
      note: data.note ?? null,
      enabled: true,
      last_status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row?.id };
  });

export const updatePriceAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      condition?: AlertCondition;
      target_value?: number;
      note?: string | null;
      enabled?: boolean;
    } = {};
    if (data.condition !== undefined) patch.condition = data.condition;
    if (data.target_value !== undefined) patch.target_value = data.target_value;
    if (data.note !== undefined) patch.note = data.note;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("user_price_alerts")
      .update(patch).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePriceAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ToggleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_price_alerts")
      .update({ enabled: data.enabled })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePriceAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_price_alerts")
      .delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function evaluateCondition(condition: AlertCondition, target: number, price: number, changePct: number): boolean {
  switch (condition) {
    case "price_above": return price >= target;
    case "price_below": return price > 0 && price <= target;
    case "change_above": return changePct >= target;
    case "change_below": return changePct <= target;
  }
}

async function evaluateOne(alert: PriceAlertRow, userId: string): Promise<{ status: "triggered"|"no_change"|"failed"; price: number|null; message: string }> {
  const category = assetTypeToCategory(alert.asset_type);
  if (!category) {
    return { status: "failed", price: null, message: "نوع الأصل غير مدعوم للتسعير" };
  }
  let q;
  try {
    q = await resolveQuote(category, alert.symbol);
  } catch (e: any) {
    return { status: "failed", price: null, message: e?.message ?? "تعذر جلب السعر" };
  }
  if (q.mode === "mock" || !Number.isFinite(q.price) || q.price <= 0) {
    return { status: "failed", price: null, message: "المزود غير متاح حالياً" };
  }
  const hit = evaluateCondition(alert.condition, Number(alert.target_value), q.price, q.changePct);
  const labelMap: Record<AlertCondition, string> = {
    price_above: `السعر تجاوز ${alert.target_value}`,
    price_below: `السعر هبط دون ${alert.target_value}`,
    change_above: `التغير 24س تجاوز ${alert.target_value}%`,
    change_below: `التغير 24س دون ${alert.target_value}%`,
  };
  const msg = hit
    ? `${labelMap[alert.condition]} • السعر الحالي ${q.price} (${q.source})`
    : `لا تغير — السعر الحالي ${q.price} (${q.source})`;

  // Persist (admin client — RLS-protected user_alert_events)
  await supabaseAdmin.from("user_price_alerts").update({
    last_checked_at: new Date().toISOString(),
    last_price: q.price,
    last_status: hit ? "triggered" : "no_change",
    last_error: null,
    ...(hit ? { triggered_count: (alert.triggered_count ?? 0) + 1 } : {}),
  }).eq("id", alert.id).eq("user_id", userId);

  await supabaseAdmin.from("user_alert_events").insert({
    user_id: userId,
    alert_id: alert.id,
    status: hit ? "triggered" : "no_change",
    price: q.price,
    message: msg,
  });

  return { status: hit ? "triggered" : "no_change", price: q.price, message: msg };
}

export const checkPriceAlertNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_price_alerts")
      .select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error) throw new Error(error.message);
    const alert = row as PriceAlertRow;
    try {
      const res = await evaluateOne(alert, userId);
      return res;
    } catch (e: any) {
      const msg = e?.message ?? "فشل غير متوقع";
      await supabaseAdmin.from("user_price_alerts").update({
        last_checked_at: new Date().toISOString(),
        last_status: "failed",
        last_error: msg,
      }).eq("id", alert.id).eq("user_id", userId);
      await supabaseAdmin.from("user_alert_events").insert({
        user_id: userId, alert_id: alert.id, status: "failed", price: null, message: msg,
      });
      return { status: "failed" as const, price: null, message: msg };
    }
  });

export const checkAllPriceAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_price_alerts").select("*").eq("user_id", userId).eq("enabled", true);
    if (error) throw new Error(error.message);
    const alerts = (data ?? []) as PriceAlertRow[];
    let triggered = 0, failed = 0, checked = 0;
    for (const a of alerts) {
      checked++;
      try {
        const r = await evaluateOne(a, userId);
        if (r.status === "triggered") triggered++;
        else if (r.status === "failed") failed++;
      } catch { failed++; }
    }
    return { checked, triggered, failed };
  });
