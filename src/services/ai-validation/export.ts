// CSV / JSON export helpers for AI validation analytics.
import type { CombinedRecord } from "./types";

export function recordsToCSV(records: CombinedRecord[]): string {
  const head = [
    "id","ts","symbol","agent","regime","action","predictedDirection","confidence",
    "entryPrice","horizonHrs","resolvedAt","exitPrice","realizedReturnPct","actualDirection","correct","ageHrs",
  ];
  const rows = records.map((r) => [
    r.id, new Date(r.ts).toISOString(), r.symbol, r.agent, r.regime ?? "",
    r.action, r.predictedDirection, r.confidence, r.entryPrice, r.horizonHrs,
    r.outcome ? new Date(r.outcome.resolvedAt).toISOString() : "",
    r.outcome?.exitPrice ?? "", r.outcome?.realizedReturnPct ?? "",
    r.outcome?.actualDirection ?? "", r.outcome ? (r.outcome.correct ? "1" : "0") : "",
    r.outcome?.ageHrs ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return [head.join(","), ...rows].join("\n");
}

export function download(filename: string, content: string, mime = "text/csv") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
