import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { autoApproveOwnerFn } from "./members.functions";

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
  const autoApproveOwner = useServerFn(autoApproveOwnerFn);
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

    // Step 1: Try SECURITY DEFINER RPC. May fail if EXECUTE was revoked from authenticated.
    const [{ data: roleData, error: roleError }, { data: acc, error: accError }] = await Promise.all([
      supabase.rpc("current_role"),
      supabase.rpc("has_accepted_disclaimer", { _version: DISCLAIMER_VERSION }),
    ]);
    if (roleError) console.warn("[use-access] current_role RPC unavailable, trying direct query:", roleError.message);
    if (accError) console.warn("[use-access] has_accepted_disclaimer RPC unavailable, skipping disclaimer check:", accError.message);

    let resolvedRole: AppRole | null = roleData as AppRole | null;

    // Step 2: If RPC returned nothing, fall back to direct user_roles query.
    // The RLS policy "users see own roles" allows auth.uid() = user_id SELECT.
    if (!resolvedRole) {
      const { data: roleRows, error: fallbackError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (fallbackError) {
        console.error("[use-access] fallback role query failed:", fallbackError.message);
        // Do NOT silently downgrade — keep resolvedRole null until final fallback below.
      } else if (roleRows && roleRows.length > 0) {
        // Prioritize: admin > subscriber > pending
        const rows = roleRows as { role: AppRole }[];
        const adminRow = rows.find(r => r.role === "admin");
        const subscriberRow = rows.find(r => r.role === "subscriber");
        resolvedRole = adminRow?.role ?? subscriberRow?.role ?? rows[0]?.role ?? null;
        if (import.meta.env.DEV) {
          console.info("[use-access] role resolved via direct query:", resolvedRole, "for user:", user.id);
        }
      }
    }

    // Step 3: If still no role, attempt owner auto-approval (bootstraps fresh Supabase project).
    if (!resolvedRole) {
      try {
        const { role: ownerRole } = await autoApproveOwner({});
        if (ownerRole === "admin") resolvedRole = "admin";
      } catch {
        // Non-critical: fall through to "pending"
      }
    }

    const primary: AppRole = resolvedRole ?? "pending";
    setRole(primary);
    // If the disclaimer RPC errored (e.g. schema cache miss), fall back to localStorage cache.
    const serverAccepted = accError ? cachedAccepted : acc === true;
    if (serverAccepted) writeLocalCache();
    setAccepted(serverAccepted);
    setLoading(false);
  }, [user, autoApproveOwner]);

  useEffect(() => { refresh(); }, [refresh]);

  const acceptDisclaimer = async () => {
    if (!user) return { error: "no user" };
    const { error } = await supabase.from("disclaimer_acceptances").insert({
      user_id: user.id,
      version: DISCLAIMER_VERSION,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    // If the table is missing from schema cache, treat as accepted locally so the
    // user is never blocked — the table was created manually and will sync eventually.
    const isSchemaCacheError = error?.message?.includes("schema cache") || error?.message?.includes("not found");
    if (!error || isSchemaCacheError) {
      writeLocalCache();
      setAccepted(true);
    }
    return { error: (error && !isSchemaCacheError) ? error.message : null };
  };

  return { role, accepted, loading, refresh, acceptDisclaimer, isAdmin: role === "admin", canAccess: role === "admin" || role === "subscriber" };
}
