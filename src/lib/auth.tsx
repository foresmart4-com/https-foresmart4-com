import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth-events.functions";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

type AuthEventType =
  | "signup" | "signup_failed"
  | "signin" | "signin_failed"
  | "signout"
  | "password_reset_request" | "password_update";

interface LogPayload {
  event_type: AuthEventType;
  status?: "ok" | "error";
  user_id?: string | null;
  email?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

function fireLog(payload: LogPayload) {
  void logAuthEvent({ data: payload as never }).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      fireLog({ event_type: "signin_failed", status: "error", email, error_message: error.message });
    } else {
      fireLog({ event_type: "signin", status: "ok", email, user_id: data.user?.id ?? null });
    }
    return { error: error?.message ?? null };
  };

  const signUp: AuthCtx["signUp"] = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { display_name: displayName },
      },
    });
    if (error) {
      fireLog({ event_type: "signup_failed", status: "error", email, error_message: error.message });
    } else {
      fireLog({ event_type: "signup", status: "ok", email, user_id: data.user?.id ?? null });
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const uid = user?.id ?? null;
    const em = user?.email ?? null;
    await supabase.auth.signOut();
    fireLog({ event_type: "signout", status: "ok", user_id: uid, email: em });
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    fireLog({
      event_type: "password_reset_request",
      status: error ? "error" : "ok",
      email,
      error_message: error?.message ?? null,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthCtx["updatePassword"] = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    fireLog({
      event_type: "password_update",
      status: error ? "error" : "ok",
      user_id: data?.user?.id ?? user?.id ?? null,
      email: user?.email ?? null,
      error_message: error?.message ?? null,
    });
    return { error: error?.message ?? null };
  };

  return <Ctx.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
