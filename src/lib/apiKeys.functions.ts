import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApiKeyInput = z.object({
  provider: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i),
  apiKey: z.string().min(8).max(500),
});

export interface UserApiKeyMeta {
  id: string;
  provider: string;
  /** Length-only placeholder — NEVER any substring of the real key. */
  key_hint: string;
  created_at: string;
}

export const listUserApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Explicit column allowlist — encrypted_api_key / iv / auth_tag are
    // never selected, even though RLS would block direct client reads too.
    const { data, error } = await context.supabase
      .from("user_api_keys")
      .select("id, provider, key_hint, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Unable to load API key metadata");

    // Defense-in-depth: strip key_hint to a length-only marker before returning,
    // so even a legacy row with old-style hints cannot leak characters.
    const keys = (data ?? []).map((k) => ({
      id: k.id as string,
      provider: k.provider as string,
      created_at: k.created_at as string,
      key_hint: "•••••••• (hidden)",
    })) satisfies UserApiKeyMeta[];

    return { keys };
  });

export const saveUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApiKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { encryptSecret, maskKey } = await import("@/services/security/encryption");
    const encrypted = encryptSecret(data.apiKey);
    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert({
        user_id: context.userId,
        provider: data.provider,
        encrypted_api_key: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        key_hint: maskKey(data.apiKey),
      }, { onConflict: "user_id,provider" });

    if (error) throw new Error("Unable to save API key securely");
    return { ok: true };
  });

export const removeUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error("Unable to delete API key");
    return { ok: true };
  });
