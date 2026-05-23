import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { onAlert, recentAlerts, emitAlert, type AlertEvent } from "@/services/alerts/alertEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, Zap, Filter } from "lucide-react";

export const Route = createFileRoute("/_app/alert-center")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><AlertCenterPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Alert Center — ForeSmart" },
      { name: "description", content: "Proactive AI alerting: market, macro, volatility and risk events." },
    ],
  }),
});

function AlertCenterPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [items, setItems] = useState<AlertEvent[]>(() => recentAlerts(100));
  const [filter, setFilter] = useState<"all" | "critical" | "warn" | "info">("all");

  useEffect(() => {
    const off = onAlert((e) => setItems((prev) => [e, ...prev].slice(0, 200)));
    return () => { off(); };
  }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.severity === filter);

  const counts = {
    critical: items.filter((i) => i.severity === "critical").length,
    warn: items.filter((i) => i.severity === "warn").length,
    info: items.filter((i) => i.severity === "info").length,
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {ar ? "مركز التنبيهات الذكي" : "AI Alert Center"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "تنبيهات استباقية: السوق، الماكرو، التذبذب، والمخاطر." : "Proactive: market, macro, volatility and risk events."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => emitAlert({
          title: ar ? "اختبار التنبيه" : "Test alert",
          body: ar ? "تنبيه تجريبي من مركز التنبيهات." : "Test alert from the center.",
          severity: "info", category: "system", channels: ["browser"],
        })}>
          <Zap className="h-3 w-3 mr-1" /> {ar ? "إرسال تجريبي" : "Send test"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label={ar ? "حرجة" : "Critical"} value={counts.critical} onClick={() => setFilter("critical")} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} label={ar ? "تحذير" : "Warning"} value={counts.warn} onClick={() => setFilter("warn")} />
        <StatCard icon={<Info className="h-4 w-4 text-primary" />} label={ar ? "معلوماتية" : "Info"} value={counts.info} onClick={() => setFilter("info")} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />{ar ? "البث المباشر" : "Live Stream"}
          </CardTitle>
          <div className="flex gap-1">
            {(["all", "critical", "warn", "info"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? (ar ? "الكل" : "All") : f}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {ar ? "لا توجد تنبيهات بعد" : "No alerts yet"}
            </p>
          )}
          {filtered.map((a) => (
            <div key={a.id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "warn" ? "outline" : "secondary"}>
                    {a.severity}
                  </Badge>
                  <span className="text-sm font-medium truncate">{a.title}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.ts).toLocaleTimeString(ar ? "ar-SA" : "en-US")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{a.body}</p>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                {a.channels.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </CardContent>
      </Card>
    </button>
  );
}
