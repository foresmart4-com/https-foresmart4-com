// AES-256-GCM encryption helpers — SERVER ONLY. Keys never touch the client.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";

const ALGO = "aes-256-gcm";

function getSecret(): string {
  const secret = process.env.VAULT_MASTER_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("VAULT_MASTER_KEY missing");
  return secret;
}

function getKey(): Buffer {
  // Deterministic 32-byte key derivation from the master secret.
  return scryptSync(getSecret(), "foresmart.vault.v1", 32);
}

export function deriveDeterministicKeyId(provider: string, plaintext: string): string {
  return createHash("sha256")
    .update(getSecret())
    .update("foresmart.user-api-key.v1")
    .update(provider)
    .update(plaintext)
    .digest("hex");
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(p: EncryptedPayload): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(p.iv, "base64"));
  decipher.setAuthTag(Buffer.from(p.authTag, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(p.ciphertext, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
