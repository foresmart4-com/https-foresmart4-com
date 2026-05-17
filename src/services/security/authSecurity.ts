// Auth Security — client-side helpers around Supabase session lifecycle.
import { supabase } from "@/integrations/supabase/client";

export interface SessionSecurityState {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  expiresAt: number | null;       // epoch seconds
  expiresInSec: number;
  refreshing: boolean;
  lastRefreshAt: number | null;
  riskScore: number;              // 0-100
  flags: string[];
}

let LAST_REFRESH: number | null = null;
let REFRESHING = false;

export async function readSessionSecurity(): Promise<SessionSecurityState> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const now = Math.floor(Date.now() / 1000);
  const exp = session?.expires_at ?? null;
  const flags: string[] = [];
  let risk = 0;

  if (!session) {
    return {
      authenticated: false, userId: null, email: null, expiresAt: null,
      expiresInSec: 0, refreshing: REFRESHING, lastRefreshAt: LAST_REFRESH, riskScore: 0, flags: ["unauthenticated"],
    };
  }
  const expiresInSec = Math.max(0, (exp ?? now) - now);
  if (expiresInSec < 120) { flags.push("session-expiring"); risk += 30; }
  if (expiresInSec === 0) { flags.push("session-expired"); risk += 60; }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/HeadlessChrome|PhantomJS|bot|spider/i.test(ua)) { flags.push("suspicious-agent"); risk += 40; }

  return {
    authenticated: true,
    userId: session.user.id,
    email: session.user.email ?? null,
    expiresAt: exp,
    expiresInSec,
    refreshing: REFRESHING,
    lastRefreshAt: LAST_REFRESH,
    riskScore: Math.min(100, risk),
    flags,
  };
}

export async function rotateSession(): Promise<boolean> {
  REFRESHING = true;
  try {
    const { error } = await supabase.auth.refreshSession();
    if (!error) { LAST_REFRESH = Date.now(); return true; }
    return false;
  } finally { REFRESHING = false; }
}

export async function forceLogout(): Promise<void> {
  await supabase.auth.signOut();
}
