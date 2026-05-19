import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketIntel } from "@/services/analysis";
import { runDecisionEngine, type DecisionPacket } from "@/services/decision-engine";
import { reconcileLifecycle, lifecycleStats, loadAudit, type LifecycleStats } from "@/services/decision-engine/lifecycle";
import { startRealtimePipeline, type PipelineStatus } from "@/services/agents/realtimePipeline";

const STREAMS = ["btcusdt@trade", "ethusdt@trade"];

export function useDecisionEngine(intel: MarketIntel | undefined, language: "ar" | "en") {
  const [packet, setPacket] = useState<DecisionPacket | null>(null);
  const [stats, setStats] = useState<LifecycleStats>(() => lifecycleStats());
  const [audit, setAudit] = useState(() => loadAudit().slice(0, 30));
  const [status, setStatus] = useState<PipelineStatus>("connecting");
  const intelRef = useRef(intel);
  intelRef.current = intel;

  const refresh = (i?: MarketIntel) => {
    const src = i ?? intelRef.current;
    if (!src) return;
    const p = runDecisionEngine(src, language);
    setPacket(p);
    setStats(lifecycleStats());
    setAudit(loadAudit().slice(0, 30));
  };

  // Initial + on language/intel change
  useEffect(() => { refresh(intel); }, [intel, language]);

  // Aging tick — every 30s reconcile lifecycle so expiries flip without a recompute.
  useEffect(() => {
    const t = setInterval(() => {
      reconcileLifecycle();
      setStats(lifecycleStats());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // Realtime: recompute when material price ticks arrive
  useEffect(() => {
    const handle = startRealtimePipeline({
      streams: STREAMS, debounceMs: 2500,
      onStatus: setStatus,
      onTick: () => refresh(),
    });
    return () => handle.close();
  }, [language]);

  return useMemo(() => ({ packet, stats, audit, status, refresh }), [packet, stats, audit, status]);
}
