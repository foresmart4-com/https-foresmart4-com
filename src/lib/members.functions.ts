import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RoleEnum = z.enum(["admin", "subscriber", "pending"]);

const Input = z.object({
  user_id: z.string().uuid(),
  role: RoleEnum,
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin required");
}

export const setUserRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Never modify admin role assignments through this endpoint
    if (data.role === "admin") {
      throw new Error("Admin role cannot be assigned via this endpoint");
    }

    // Remove existing non-admin roles
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .neq("role", "admin");
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });
