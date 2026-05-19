import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  symbol: z.string().trim().min(1).max(20).regex(/^[A-Z0-9._-]+$/i),
  asset_name: z.string().trim().min(1).max(120),
  condition: z.enum(["above", "below"]),
  target_price: z.number().positive().finite().max(1e12),
});

const IdInput = z.object({ id: z.string().uuid() });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("alerts").insert({
      user_id: userId,
      symbol: data.symbol.toUpperCase(),
      asset_name: data.asset_name,
      condition: data.condition,
      target_price: data.target_price,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership enforced both by explicit filter and RLS.
    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
