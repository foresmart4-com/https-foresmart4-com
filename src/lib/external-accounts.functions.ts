import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listExternalAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("external_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const addExternalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      provider: z.enum(["crypto_wallet", "lean", "snaptrade", "plaid", "paypal", "wise"]),
      label: z.string().max(80).optional(),
      address: z.string().max(200).optional(),
      network: z.string().max(40).optional(),
      currency: z.string().max(10).optional(),
      external_id: z.string().max(200).optional(),
      metadata: z.record(z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("external_accounts")
      .insert({ user_id: userId, ...data, metadata: data.metadata ?? {} })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeExternalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("external_accounts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
