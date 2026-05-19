import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const runDbHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    // admin check via RLS-scoped client
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) {
      throw new Error("admin required");
    }
    const { data, error } = await supabaseAdmin.rpc("db_health_check");
    if (error) throw new Error(error.message);
    return { report: data as unknown };
  });
