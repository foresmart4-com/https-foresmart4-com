import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { runDbHealthCheck } from "@/lib/db-health.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/db-diagnostics")({
  component: DbDiagnosticsPage,
});

type Section = Record<string, number | string>;
interface Report {
  generated_at: string;
  totals: Section;
  orphans: Section;
  missing_links: Section;
  duplicates: Section;
  rls: Section;
  recent_auth_24h: Section;
}

function DbDiagnosticsPage() {
  const fn = useServerFn(runDbHealthCheck);
  const q = useQuery({
    queryKey: ["db-health"],
    queryFn: () => fn({ data: undefined as never }),
    refetchOnWindowFocus: false,
  });

  const report = (q.data as { report: Report } | undefined)?.report;
  const issues = report ? countIssues(report) : 0;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Database Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Production readiness — orphans, duplicates, RLS coverage, and recent auth activity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {q.isLoading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Running health check…</Card>
      ) : q.isError ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{(q.error as Error).message}</span>
          </div>
        </Card>
      ) : !report ? null : (
        <>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              {issues === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              )}
              <div>
                <div className="text-lg font-semibold">
                  {issues === 0 ? "All checks passed" : `${issues} issue${issues > 1 ? "s" : ""} detected`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Generated {new Date(report.generated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="Table Totals" icon={<Activity className="h-4 w-4" />} data={report.totals} />
            <SectionCard title="RLS Coverage" icon={<ShieldCheck className="h-4 w-4" />} data={report.rls} highlightZero="public_tables_without_rls" />
            <SectionCard title="Orphaned Rows" data={report.orphans} flagNonZero />
            <SectionCard title="Missing Links" data={report.missing_links} flagNonZero />
            <SectionCard title="Duplicates" data={report.duplicates} flagNonZero />
            <SectionCard title="Auth Activity (24h)" data={report.recent_auth_24h} />
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({
  title,
  data,
  icon,
  flagNonZero,
  highlightZero,
}: {
  title: string;
  data: Section;
  icon?: React.ReactNode;
  flagNonZero?: boolean;
  highlightZero?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </div>
      <ul className="space-y-1.5 text-sm">
        {Object.entries(data).map(([k, v]) => {
          const n = Number(v);
          const bad = flagNonZero && n > 0;
          const okHighlight = highlightZero === k && n === 0;
          return (
            <li key={k} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{k}</span>
              <Badge variant={bad ? "destructive" : okHighlight ? "default" : "secondary"}>{String(v)}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function countIssues(r: Report): number {
  const sum = (s: Section) => Object.values(s).reduce<number>((a, v) => a + (Number(v) > 0 ? 1 : 0), 0);
  return sum(r.orphans) + sum(r.duplicates) + (Number(r.rls.public_tables_without_rls) > 0 ? 1 : 0) + (Number(r.rls.tables_rls_no_policy) > 0 ? 1 : 0);
}
