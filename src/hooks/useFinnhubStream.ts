/**
 * Client hook: subscribe to Finnhub trade ticks via the server-side SSE bridge.
 * The API key never leaves the server.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FinnhubTick { s: string; p: number; t: number; v: number }

export type StreamStatus = "idle" | "connecting" | "open" | "closed" | "error";

export function useFinnhubStream(symbols: string[]) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [last, setLast] = useState<Record<string, FinnhubTick>>({});
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (symbols.length === 0) { setStatus("idle"); return; }
    setStatus("connecting");

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setStatus("error"); return; }

      const qs = encodeURIComponent(symbols.join(","));
      // EventSource does not support custom headers; pass token via query param fallback is unsafe.
      // Instead use fetch streaming.
      const ctrl = new AbortController();
      try {
        const res = await fetch(`/api/finnhub/stream?symbols=${qs}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) { setStatus("error"); return; }
        setStatus("open");
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split("\n");
            let event = "message"; let dataStr = "";
            for (const l of lines) {
              if (l.startsWith("event:")) event = l.slice(6).trim();
              else if (l.startsWith("data:")) dataStr += l.slice(5).trim();
            }
            if (!dataStr) continue;
            try {
              const payload = JSON.parse(dataStr);
              if (event === "trade" && Array.isArray(payload)) {
                setLast((prev) => {
                  const next = { ...prev };
                  for (const t of payload as FinnhubTick[]) next[t.s] = t;
                  return next;
                });
              }
            } catch { /* ignore */ }
          }
        }
        if (!cancelled) setStatus("closed");
      } catch {
        if (!cancelled) setStatus("error");
      }
      return () => ctrl.abort();
    })();

    return () => { cancelled = true; esRef.current?.close(); };
  }, [symbols.join(",")]);

  return { status, last };
}
