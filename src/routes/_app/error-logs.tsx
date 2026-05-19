import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorLogs } from "@/lib/observability/observability.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/error-logs")({
  component: ErrorLogsPage,
});

type Severity = "all" | "info" | "warn" | "error" | "critical";

function ErrorLogsPage() {
  const fn = useServerFn(getErrorLogs);
  const [severity, setSeverity] = useState<Severity>("error");
  const [source, setSource] = useState<string>("");

  const q = useQuery({
    queryKey: ["error-logs", severity, source],
    queryFn: () => fn({ data: { severity, source: source || undefined, limit: 200 } }),
    refetchInterval: 30_000,
  });
  const rows = ((q.data as any)?.rows ?? []) as any[];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Error Logs</h1>
          <p className="text-sm text-muted-foreground">Frontend crashes, API failures, AI errors, DB anomalies.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <div className="flex gap-1">
          {(["all", "info", "warn", "error", "critical"] as Severity[]).map((s) => (
            <Button key={s} size="sm" variant={severity === s ? "default" : "ghost"} onClick={() => setSeverity(s)}>
              {s}
            </Button>
          ))}
        </div>
        <input
          className="ml-auto h-9 w-48 rounded-md border bg-background px-3 text-sm"
          placeholder="source (e.g. ai)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </Card>

      <Card className="p-0">
        {q.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No events match.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <details key={r.id} className="p-4 text-sm">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <Badge variant={r.severity === "critical" || r.severity === "error" ? "destructive" : "secondary"}>
                    {r.severity}
                  </Badge>
                  <Badge variant="outline">{r.source}</Badge>
                  <span className="font-medium">{r.event_type}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </summary>
                {r.message && <p className="mt-2 text-muted-foreground">{r.message}</p>}
                {r.context && Object.keys(r.context).length > 0 && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
{JSON.stringify(r.context, null, 2)}
                  </pre>
                )}
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
