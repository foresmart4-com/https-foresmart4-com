// Secure API key vault — server-side persistence of broker credentials.
// Plaintext keys never leave this module's boundary.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret, maskKey } from "./encryption";

export type BrokerName = "binance";
export type BrokerMode = "testnet" | "live";

export interface VaultRecordMeta {
  id: string;
  broker: BrokerName;
  mode: BrokerMode;
  label: string | null;
  isActive: boolean;
  hint: string;        // masked, safe for UI
  updatedAt: string;
}

export interface VaultCredentials {
  apiKey: string;
  apiSecret: string;
}

export async function storeBrokerCredentials(
  userId: string,
  broker: BrokerName,
  mode: BrokerMode,
  apiKey: string,
  apiSecret: string,
  label?: string,
): Promise<VaultRecordMeta> {
  const k = encryptSecret(apiKey);
  const s = encryptSecret(apiSecret);
  // Use the IV/authTag from the secret payload (api key has its own ciphertext).
  // Combine both into a single record by storing the api-key encryption and
  // packing the secret's iv/authTag inside ciphertext (delimited base64).
  const packedSecret = `${s.ciphertext}.${s.iv}.${s.authTag}`;
  const { data, error } = await supabaseAdmin
    .from("broker_credentials")
    .upsert({
      user_id: userId,
      broker, mode,
      encrypted_api_key: k.ciphertext,
      encrypted_api_secret: packedSecret,
      iv: k.iv,
      auth_tag: k.authTag,
      label: label ?? null,
      is_active: true,
    }, { onConflict: "user_id,broker,mode" })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("vault: upsert failed");
  return toMeta(data, apiKey);
}

export async function loadBrokerCredentials(
  userId: string,
  broker: BrokerName,
  mode: BrokerMode,
): Promise<VaultCredentials | null> {
  const { data } = await supabaseAdmin
    .from("broker_credentials")
    .select("*").eq("user_id", userId).eq("broker", broker).eq("mode", mode)
    .eq("is_active", true).maybeSingle();
  if (!data) return null;
  const apiKey = decryptSecret({
    ciphertext: data.encrypted_api_key, iv: data.iv, authTag: data.auth_tag,
  });
  const [ct, iv, authTag] = String(data.encrypted_api_secret).split(".");
  const apiSecret = decryptSecret({ ciphertext: ct, iv, authTag });
  return { apiKey, apiSecret };
}

export async function listBrokerCredentials(userId: string): Promise<VaultRecordMeta[]> {
  const { data } = await supabaseAdmin
    .from("broker_credentials").select("*").eq("user_id", userId);
  return (data ?? []).map((r) => toMeta(r));
}

export async function revokeBrokerCredentials(userId: string, id: string): Promise<void> {
  await supabaseAdmin.from("broker_credentials").update({ is_active: false })
    .eq("id", id).eq("user_id", userId);
}

function toMeta(row: Record<string, unknown>, plain?: string): VaultRecordMeta {
  return {
    id: String(row.id),
    broker: row.broker as BrokerName,
    mode: row.mode as BrokerMode,
    label: (row.label as string | null) ?? null,
    isActive: Boolean(row.is_active),
    hint: plain ? maskKey(plain) : "•••• •••• •••• ••••",
    updatedAt: String(row.updated_at),
  };
}
