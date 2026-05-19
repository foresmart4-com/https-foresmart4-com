// Unified entry point for the Financial Data Fusion engine.
export * from "./types";
export { fusionBus } from "./eventBus";
export { normalizeSymbol, providerSymbol } from "./symbolNormalizer";
export { PROVIDERS, providersFor, getProvider } from "./providers";
export {
  recordTick, recordError, snapshotHealth, allHealth, selectProvider, failover, scanStaleFeeds,
} from "./providerHealth";
export { ingestQuote, lastFused } from "./quoteFusion";
export {
  cacheQuote, getCachedQuote, cacheOHLC, getCachedOHLC, cacheStats,
  compressSeries, decompressSeries, type CompressedSeries,
} from "./cache";
export { classifyRegime, classifyVolatility, updateMacro, getMacro, adjustForMacro } from "./regime";
export {
  subscribe, unsubscribe, listSubscriptions, start, stop, getMergedSeries, setProviderAdapters,
} from "./orchestrator";
