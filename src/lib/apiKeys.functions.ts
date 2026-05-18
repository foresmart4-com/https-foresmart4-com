import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveDeterministicKeyId, encryptSecret, maskKey } from "@/services/security/encryption";

const ApiKeyInput = z.object({
  provider: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i),
  apiKey: z.string().min(8).max(500),
});

export interface UserApiKeyMeta {
  id: string;
  provider: string;
  key_hint: string;
}

export const listUserApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_api_keys")
      .select("id, provider, key_hint")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Unable to load API key metadata");
    return { keys: (data ?? []) as UserApiKeyMeta[] };
  });

export const saveUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApiKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    const encrypted = encryptSecret(data.apiKey);
    const id = deriveDeterministicKeyId(data.provider, data.apiKey);
    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert({
        id,
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
  .inputValidator((input: unknown) => z.object({ id: z.string().min(32).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error("Unable to delete API key");
    return { ok: true };
  });
