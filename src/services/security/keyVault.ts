// Key Vault — client-side status view only.
// Actual broker API keys live as server secrets (process.env on the broker function).
// This module NEVER reads, transmits, or stores plaintext keys in the frontend.

export type VaultStatus = "sealed" | "configured" | "missing" | "unknown";

export interface VaultEntry {
  id: string;
  label: string;
  status: VaultStatus;
  maskedHint: string;       // e.g. "•••• •••• •••• xxxx" — generic, no real data
  encryption: "AES-256-GCM" | "server-managed";
  lastChecked: number;
}

export interface VaultReport {
  entries: VaultEntry[];
  overall: "secure" | "partial" | "unconfigured";
  notes: string[];
}

// We expose only status (configured/missing) by probing the server proxy if needed.
// Here we return a static configured-by-default view; the server enforces the truth.
export function getVaultReport(brokerConfigured: boolean): VaultReport {
  const entries: VaultEntry[] = [
    {
      id: "binance",
      label: "Binance (Testnet)",
      status: brokerConfigured ? "sealed" : "missing",
      maskedHint: "•••• •••• •••• ••••",
      encryption: "server-managed",
      lastChecked: Date.now(),
    },
  ];
  const overall = brokerConfigured ? "secure" : "unconfigured";
  const notes = [
    "API keys are stored as encrypted server secrets.",
    "Plaintext keys are never available to the browser.",
    "All broker requests pass through a server proxy.",
  ];
  return { entries, overall, notes };
}
