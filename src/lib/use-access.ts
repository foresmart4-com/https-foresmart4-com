import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export const DISCLAIMER_VERSION = "2026-05-08-v1";
const ACCEPT_CACHE_PREFIX = "fs-disclaimer-accepted:";

function cacheKey(userId: string) {
  return `${ACCEPT_CACHE_PREFIX}${userId}:${DISCLAIMER_VERSION}`;
}

function readCachedAccept(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(cacheKey(userId)) === "1"; } catch { return false; }
}

function writeCachedAccept(userId: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(cacheKey(userId), "1"); } catch { /* ignore */ }
}

// localStorage key scoped to the disclaimer version so re-versioning clears the cache.
const LS_KEY = `foresmart_disclaimer_accepted_${DISCLAIMER_VERSION}`;

function readLocalCache(): boolean {
  try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
}
function writeLocalCache(): void {
  try { localStorage.setItem(LS_KEY, "1"); } catch { /* storage blocked */ }
}

export type AppRole = "admin" | "subscriber" | "pending";

export function useAccess() {
  const { user } = useAuth();
  // Hydrate optimistically from localStorage so the disclaimer modal does not
  // re-flash on every page load for users who have already accepted it.
  const [role, setRole] = useState<AppRole | null>(null);
  // Fast-path: seed from localStorage so already-accepted users skip the blocking gate
  // on every hard refresh while the Supabase round-trip completes in the background.
  const [accepted, setAccepted] = useState<boolean | null>(() => readLocalCache() ? true : null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // If localStorage says accepted, skip blocking; still validate in background.
    const cachedAccepted = readLocalCache();
    if (!cachedAccepted) setLoading(true);
    const [{ data: roles }, { data: acc }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.rpc("has_accepted_disclaimer", { _version: DISCLAIMER_VERSION }),
    ]);
    const rs = (roles ?? []).map((r) => r.role as AppRole);
    const primary: AppRole = rs.includes("admin") ? "admin" : rs.includes("subscriber") ? "subscriber" : "pending";
    setRole(primary);
    const serverAccepted = acc === true;
    if (serverAccepted) writeLocalCache();
    setAccepted(serverAccepted);
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
    if (!error) {
      writeLocalCache();
      setAccepted(true);
    }
    return { error: error?.message ?? null };
  };

  return { role, accepted, loading, refresh, acceptDisclaimer, isAdmin: role === "admin", canAccess: role === "admin" || role === "subscriber" };
}
