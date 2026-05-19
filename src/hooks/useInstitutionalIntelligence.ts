import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketIntel } from "@/services/analysis";
import { runInstitutionalStrategy, type InstitutionalView } from "@/services/agents";
import { startRealtimePipeline, type PipelineStatus } from "@/services/agents/realtimePipeline";

const DEFAULT_STREAMS = ["btcusdt@trade", "ethusdt@trade"];

export function useInstitutionalIntelligence(
  intel: MarketIntel | undefined,
  language: "ar" | "en",
  opts?: { streams?: string[]; debounceMs?: number },
) {
  const [view, setView] = useState<InstitutionalView | null>(null);
  const [status, setStatus] = useState<PipelineStatus>("connecting");
  const intelRef = useRef(intel);
  intelRef.current = intel;

  // Initial compute + recompute when intel changes
  useEffect(() => {
    if (!intel) return;
    setView(runInstitutionalStrategy({ intel, language }));
  }, [intel, language]);

  // Realtime pipeline triggers recompute when prices move materially
  useEffect(() => {
    const handle = startRealtimePipeline({
      streams: opts?.streams ?? DEFAULT_STREAMS,
      debounceMs: opts?.debounceMs ?? 2000,
      onStatus: setStatus,
      onTick: () => {
        const i = intelRef.current;
        if (!i) return;
        setView(runInstitutionalStrategy({ intel: i, language }));
      },
    });
    return () => handle.close();
  }, [language, opts?.streams, opts?.debounceMs]);

  return useMemo(() => ({ view, status }), [view, status]);
}
