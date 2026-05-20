import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ApiKeyInput = z.object({
  provider: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i),
  apiKey: z.string().min(8).max(500),
});

const GENERIC_ERROR = "Unable to process API key request"; // never leak schema/column/table info

export interface UserApiKeyMeta {
  id: string;
  provider: string;
  /** Length-only placeholder — NEVER any substring of the real key. */
  key_hint: string;
  created_at: string;
  last_used_at: string | null;
  last_test_at: string | null;
  last_test_result: string | null;
}

export interface ApiKeyAuditEntry {
  id: string;
  action: "add" | "remove" | "test";
  provider: string;
  result: string | null;
  created_at: string;
}

function audit(opts: {
  userId: string;
  action: "add" | "remove" | "test";
  provider: string;
  result?: string;
}) {
  const ip = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = getRequestHeader("user-agent") ?? null;
  return supabaseAdmin.from("api_key_audit").insert({
    user_id: opts.userId,
    action: opts.action,
    provider: opts.provider,
    result: opts.result ?? null,
    ip_address: ip,
    user_agent: ua,
  });
}

export const listUserApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_api_keys")
        .select("id, provider, created_at, last_used_at, last_test_at, last_test_result")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[apiKeys.list] db error", error);
        throw new Error(GENERIC_ERROR);
      }

      const keys = (data ?? []).map((k) => ({
        id: k.id as string,
        provider: k.provider as string,
        created_at: k.created_at as string,
        last_used_at: (k.last_used_at as string | null) ?? null,
        last_test_at: (k.last_test_at as string | null) ?? null,
        last_test_result: (k.last_test_result as string | null) ?? null,
        key_hint: "•••••••• (hidden)",
      })) satisfies UserApiKeyMeta[];

      return { keys };
    } catch (e) {
      if (e instanceof Error && e.message === GENERIC_ERROR) throw e;
      console.error("[apiKeys.list] unexpected", e);
      throw new Error(GENERIC_ERROR);
    }
  });

export const saveUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApiKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { encryptSecret, maskKey } = await import("@/services/security/encryption");
      const encrypted = encryptSecret(data.apiKey);
      const { error } = await supabaseAdmin
        .from("user_api_keys")
        .upsert({
          user_id: context.userId,
          provider: data.provider,
          encrypted_api_key: encrypted.ciphertext,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          key_hint: maskKey(data.apiKey),
        }, { onConflict: "user_id,provider" });

      if (error) {
        console.error("[apiKeys.save] db error", error);
        await audit({ userId: context.userId, action: "add", provider: data.provider, result: "error" });
        throw new Error(GENERIC_ERROR);
      }

      await audit({ userId: context.userId, action: "add", provider: data.provider, result: "ok" });
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.message === GENERIC_ERROR) throw e;
      console.error("[apiKeys.save] unexpected", e);
      throw new Error(GENERIC_ERROR);
    }
  });

export const removeUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: row } = await context.supabase
        .from("user_api_keys")
        .select("provider")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();

      const { error } = await context.supabase
        .from("user_api_keys")
        .delete()
        .eq("id", data.id)
        .eq("user_id", context.userId);

      if (error) {
        console.error("[apiKeys.remove] db error", error);
        throw new Error(GENERIC_ERROR);
      }

      await audit({
        userId: context.userId,
        action: "remove",
        provider: (row?.provider as string) ?? "unknown",
        result: "ok",
      });
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.message === GENERIC_ERROR) throw e;
      console.error("[apiKeys.remove] unexpected", e);
      throw new Error(GENERIC_ERROR);
    }
  });

export const testUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: row, error: readErr } = await context.supabase
        .from("user_api_keys")
        .select("provider, encrypted_api_key, iv, auth_tag")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();

      if (readErr || !row) {
        throw new Error(GENERIC_ERROR);
      }

      const { decryptSecret } = await import("@/services/security/encryption");
      let ok = false;
      let errMsg: string | null = null;
      try {
        const key = decryptSecret({
          ciphertext: row.encrypted_api_key as string,
          iv: row.iv as string,
          authTag: row.auth_tag as string,
        });
        ok = typeof key === "string" && key.length >= 8;
      } catch {
        errMsg = "decrypt_failed";
      }

      const result = ok ? "ok" : "failed";
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("user_api_keys")
        .update({
          last_test_at: now,
          last_test_result: result,
          last_test_error: errMsg,
          last_used_at: ok ? now : (row as any).last_used_at ?? null,
        })
        .eq("id", data.id);

      await audit({
        userId: context.userId,
        action: "test",
        provider: row.provider as string,
        result,
      });

      return { ok, result, at: now };
    } catch (e) {
      if (e instanceof Error && e.message === GENERIC_ERROR) throw e;
      console.error("[apiKeys.test] unexpected", e);
      throw new Error(GENERIC_ERROR);
    }
  });

export const getApiKeyAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data, error } = await context.supabase
        .from("api_key_audit")
        .select("id, action, provider, result, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[apiKeys.audit] db error", error);
        throw new Error(GENERIC_ERROR);
      }
      return { entries: (data ?? []) as ApiKeyAuditEntry[] };
    } catch (e) {
      if (e instanceof Error && e.message === GENERIC_ERROR) throw e;
      console.error("[apiKeys.audit] unexpected", e);
      throw new Error(GENERIC_ERROR);
    }
  });
