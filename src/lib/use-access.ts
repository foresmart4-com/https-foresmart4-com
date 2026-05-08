import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export const DISCLAIMER_VERSION = "2026-05-08-v1";

export type AppRole = "admin" | "subscriber" | "pending";

export function useAccess() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: roles }, { data: acc }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("disclaimer_acceptances").select("id").eq("user_id", user.id).eq("version", DISCLAIMER_VERSION).limit(1),
    ]);
    const rs = (roles ?? []).map((r) => r.role as AppRole);
    const primary: AppRole = rs.includes("admin") ? "admin" : rs.includes("subscriber") ? "subscriber" : "pending";
    setRole(primary);
    setAccepted((acc?.length ?? 0) > 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const acceptDisclaimer = async () => {
    if (!user) return { error: "no user" };
    const { error } = await supabase.from("disclaimer_acceptances").insert({
      user_id: user.id,
      version: DISCLAIMER_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (!error) setAccepted(true);
    return { error: error?.message ?? null };
  };

  return { role, accepted, loading, refresh, acceptDisclaimer, isAdmin: role === "admin", canAccess: role === "admin" || role === "subscriber" };
}
