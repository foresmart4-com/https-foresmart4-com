/**
 * Provider Capability Registry.
 *
 * Declarative matrix of what each provider can quote. The router consults
 * this BEFORE attempting a provider so we never send a symbol to an API
 * that has no chance of returning it (e.g. Saudi tickers to Finnhub free).
 *
 * Pure / stateless — safe to import anywhere.
 */

import type { AssetClass, ProviderId } from "@/lib/market/router";

export interface ProviderCapabilities {
  supportsSaudi: boolean;
  supportsMetals: boolean;
  supportsCommodities: boolean;
  supportsForex: boolean;
  supportsCrypto: boolean;
  supportsUsStock: boolean;
  supportsEtf: boolean;
  supportsBond: boolean;
  supportsRealtime: boolean; // true = live, false = delayed/EOD
}

const F: ProviderCapabilities = {
  supportsSaudi: false, supportsMetals: false, supportsCommodities: false,
  supportsForex: false, supportsCrypto: false, supportsUsStock: false,
  supportsEtf: false, supportsBond: false, supportsRealtime: false,
};

export const CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  finnhub:      { ...F, supportsUsStock: true, supportsEtf: true, supportsForex: true,
                  supportsMetals: true, supportsCommodities: true, supportsRealtime: true },
  twelvedata:   { ...F, supportsUsStock: true, supportsEtf: true, supportsForex: true,
                  supportsMetals: true, supportsCommodities: true, supportsCrypto: true,
                  supportsSaudi: true, supportsBond: true, supportsRealtime: true },
  alphavantage: { ...F, supportsUsStock: true, supportsEtf: true, supportsForex: true,
                  supportsMetals: true, supportsCommodities: true, supportsSaudi: true,
                  supportsBond: true, supportsRealtime: false /* delayed */ },
  binance:      { ...F, supportsCrypto: true, supportsRealtime: true },
  coingecko:    { ...F, supportsCrypto: true, supportsRealtime: false /* near-real */ },
  alpaca:       { ...F, supportsUsStock: true, supportsEtf: true, supportsRealtime: true },
  tradingview:  { ...F, supportsUsStock: true, supportsEtf: true, supportsCrypto: true,
                  supportsForex: true, supportsMetals: true, supportsCommodities: true,
                  supportsSaudi: true, supportsBond: true, supportsRealtime: true },
  sahmk:        { ...F, supportsSaudi: true, supportsRealtime: true },
};

const CLASS_TO_CAP: Record<AssetClass, keyof ProviderCapabilities | null> = {
  us_stock:    "supportsUsStock",
  saudi_stock: "supportsSaudi",
  crypto:      "supportsCrypto",
  metal:       "supportsMetals",
  commodity:   "supportsCommodities",
  etf:         "supportsEtf",
  bond:        "supportsBond",
  forex:       "supportsForex",
  unknown:     null,
};

/** Returns true if `provider` declares support for `assetClass`. */
export function supports(provider: ProviderId, assetClass: AssetClass): boolean {
  const key = CLASS_TO_CAP[assetClass];
  if (!key) return true; // unknown — try anyway
  return CAPABILITIES[provider]?.[key] === true;
}

/** Human-readable reason used in diagnostics when a provider is skipped. */
export function unsupportedReason(provider: ProviderId, assetClass: AssetClass): string {
  return `${provider} does not support ${assetClass}`;
}

/** Realtime flag for mode classification (live vs delayed). */
export function isRealtime(provider: ProviderId): boolean {
  return CAPABILITIES[provider]?.supportsRealtime === true;
}
