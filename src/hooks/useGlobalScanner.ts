import { useEffect, useState } from "react";
import { getSnapshot, subscribeScanner } from "@/services/global-scanner";
import type { ScannerSnapshot } from "@/services/global-scanner";

export function useGlobalScanner() {
  const [snapshot, setSnapshot] = useState<ScannerSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "live">("loading");

  useEffect(() => {
    setStatus("loading");
    let mounted = true;
    void getSnapshot().then((s) => { if (mounted) { setSnapshot(s); setStatus("live"); } });
    const unsub = subscribeScanner((s) => mounted && setSnapshot(s));
    return () => { mounted = false; unsub(); };
  }, []);

  const refresh = async () => {
    setStatus("loading");
    const s = await getSnapshot(true);
    setSnapshot(s);
    setStatus("live");
  };

  return { snapshot, status, refresh };
}
