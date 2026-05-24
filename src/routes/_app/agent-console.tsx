import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Activity, Shield, Eye, TrendingUp, BookOpen, Radio, Cpu } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/agent-console")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل وحدة الوكيل"><AgentConsolePage /></ErrorBoundary>,
  head: () => ({ meta: [{ title: "Genesis Agent Console — ForeSmart" }] }),
});

interface AgentHealthApi {
  plannerAgent: { nameAr: string; active: boolean; health: string };
  researchAgent: { nameAr: string; active: boolean; health: string };
  marketAgent: { nameAr: string; active: boolean; health: string };
  riskAgent: { nameAr: string; active: boolean; health: string };
  strategyAgent: { nameAr: string; active: boolean; health: string };
  learningAgent: { nameAr: string; active: boolean; health: string };
  mode: string;
  regime: string;
  memoryConnected: boolean;
  memorySize: number;
  confidenceEngine: boolean;
  executionEnabled: boolean;
  decisionsCount: number;
  lastCycleAt: string | null;
}

const MODE_AR: Record<string, string> = { observation: "مراقبة", advisory: "استشاري", execution_ready: "جاهز للتنفيذ" };
const REGIME_AR: Record<string, string> = { risk_on: "إقبال", risk_off: "تحفظ", mixed: "مختلط", defensive: "دفاعي", crisis: "أزمة" };
const HEALTH_COLOR: Record<string, string> = { healthy: "text-emerald-400 border-emerald-500/30", degraded: "text-amber-400 border-amber-500/30", offline: "text-rose-400 border-rose-500/30" };

function AgentConsolePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [data, setData] = useState<AgentHealthApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/agent-health")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!data) return <div className="p-6 text-center text-muted-foreground">{ar ? "تعذر تحميل بيانات الوكيل" : "Failed to load agent data"}</div>;

  const agents = [
    { key: "planner", icon: Brain, data: data.plannerAgent },
    { key: "research", icon: Radio, data: data.researchAgent },
    { key: "market", icon: Activity, data: data.marketAgent },
    { key: "risk", icon: Shield, data: data.riskAgent },
    { key: "strategy", icon: TrendingUp, data: data.strategyAgent },
    { key: "learning", icon: BookOpen, data: data.learningAgent },
  ];

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="h-6 w-6 text-amber-500" />{ar ? "وحدة تحكم الوكيل الذكي" : "Genesis Agent Console"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar ? "نظام وكلاء ذكاء اصطناعي متعدد العوامل — مراقبة وتحليل فقط" : "Multi-agent AI system — observation and analysis only"}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-400">{ar ? (MODE_AR[data.mode] ?? data.mode) : data.mode}</Badge>
          <Badge variant="outline" className="border-sky-500/30 text-sky-400">{ar ? (REGIME_AR[data.regime] ?? data.regime) : data.regime}</Badge>
          <Badge variant="outline" className="border-rose-500/30 text-rose-400">{ar ? "التنفيذ معطل" : "Execution disabled"}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const Icon = a.icon;
          const healthCls = HEALTH_COLOR[a.data.health] ?? "text-zinc-400 border-zinc-600";
          return (
            <Card key={a.key} className="border-amber-500/10 bg-zinc-900/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <Icon className="h-5 w-5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-200">{a.data.nameAr}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] ${healthCls}`}>{a.data.health === "healthy" ? (ar ? "نشط" : "Active") : a.data.health}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">{ar ? "محرك الثقة" : "Confidence Engine"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "المحرك" : "Engine"}</span><span className="text-emerald-400">{data.confidenceEngine ? (ar ? "نشط" : "Active") : (ar ? "معطل" : "Off")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "القرارات" : "Decisions"}</span><span>{data.decisionsCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "آخر دورة" : "Last cycle"}</span><span className="text-xs">{data.lastCycleAt ? new Date(data.lastCycleAt).toLocaleString() : "—"}</span></div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">{ar ? "ذاكرة الوكيل" : "Agent Memory"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "متصلة" : "Connected"}</span><span className="text-emerald-400">{data.memoryConnected ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "الحجم" : "Size"}</span><span>{data.memorySize} {ar ? "سجل" : "entries"}</span></div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">{ar ? "الأمان" : "Safety"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "التنفيذ" : "Execution"}</span><span className="text-rose-400">{ar ? "معطل" : "Disabled"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "السحب" : "Withdrawal"}</span><span className="text-rose-400">{ar ? "محظور" : "Blocked"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "التحويل الخارجي" : "External transfer"}</span><span className="text-rose-400">{ar ? "محظور" : "Blocked"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "عزل الخزينة" : "Treasury isolation"}</span><span className="text-emerald-400">{ar ? "مفعل" : "Active"}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/10 bg-zinc-900/60 p-4 text-center text-sm text-muted-foreground">
        {ar ? "الوكيل يعمل في وضع المراقبة فقط — لا ينفذ أوامر أو يحرك أموال. جميع القرارات تحليلية." : "Agent operates in observation mode only — no orders executed, no funds moved. All decisions are analytical."}
      </Card>
    </div>
  );
}
