// Top-level orchestrator: ingests all sources, runs every engine, builds consensus,
// emits opportunities and records predictions for accuracy tracking.
import { ingestAll } from "./ingestion";
import { processGeopolitical } from "./geopoliticalEngine";
import { processEconomic } from "./economicEngine";
import { processWeather } from "./weatherEngine";
import { scanOpportunities } from "./opportunityEngine";
import { buildConsensus } from "./multiAgentConsensus";
import { metrics, recordPredictions } from "./accuracyEngine";
import { globalBus, globalCache } from "./scalability";
import type { GlobalIntelSnapshot } from "./types";

const SNAPSHOT_TTL = 30_000;

export async function runGlobalIntel(force = false): Promise<GlobalIntelSnapshot> {
  const cached = !force ? (globalCache.get("snapshot") as GlobalIntelSnapshot | null) : null;
  if (cached) return cached;

  const { signals, sources, latencyMs } = await ingestAll();
  const geoEvents = processGeopolitical(signals);
  const econEvents = processEconomic(signals);
  const weatherEvents = processWeather(signals);
  const opportunities = scanOpportunities(signals, geoEvents, econEvents, weatherEvents);
  const consensus = buildConsensus(opportunities, { geo: geoEvents, econ: econEvents, weather: weatherEvents });

  recordPredictions(consensus);

  const snap: GlobalIntelSnapshot = {
    generatedAt: Date.now(),
    ingestion: { sources, eventsLastHour: signals.length, latencyMs: Math.round(latencyMs) },
    geoEvents, econEvents, weatherEvents,
    opportunities, consensus,
    accuracy: metrics(),
  };

  globalCache.set("snapshot", snap, SNAPSHOT_TTL);
  globalBus.emit("snapshot", snap);
  return snap;
}

export function subscribeGlobalIntel(fn: (s: GlobalIntelSnapshot) => void) {
  return globalBus.on("snapshot", fn as (m: unknown) => void);
}
