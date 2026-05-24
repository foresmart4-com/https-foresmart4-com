import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Cpu, Scale, ShieldAlert, Sparkles, GitMerge, Activity,
  TrendingUp, TrendingDown, Minus, Clock, History, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import type { DecisionPacket, Recommendation, LifecycleStatus } from "@/services/decision-engine";
import type { Bias } from "@/services/agents/types";
import {
  setStatus as setRecStatus, resolveRec, compareHistorical, lifecycleStats,
  type AuditEntry,
} from "@/services/decision-engine/lifecycle";

const T = (ar: boolean, en: string, arT: string) => (ar ? arT : en);

const BIAS: Record<Bias, { cls: string; icon: typeof TrendingUp }> = {
  bullish: { cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: TrendingUp },
  bearish: { cls: "text-rose-400 border-rose-500/30 bg-rose-500/10", icon: TrendingDown },
  neutral: { cls: "text-slate-300 border-slate-500/30 bg-slate-500/10", icon: Minus },
};

const STATUS_CLS: Record<LifecycleStatus, string> = {
  active: "bg-primary/15 text-primary border-primary/30",
  triggered: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  expired: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  stopped: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  superseded: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

interface Props {
  packet: DecisionPacket | null;
  stats: ReturnType<typeof lifecycleStats>;
  audit: AuditEntry[];
  status: string;
  onRefresh: () => void;
  ar?: boolean;
}

export function DecisionEnginePanel({ packet, stats, audit, status, onRefresh, ar = false }: Props) {
  const [tab, setTab] = useState("composite");
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const composite = packet?.composite;
  const BiasIcon = composite ? (BIAS[composite.bias]?.icon ?? Minus) : Minus;

  const explainEdges = useMemo(() => packet?.explain.edges ?? [], [packet]);

  if (!packet) {
    return (
      <Card dir={ar ? "rtl" : "ltr"}>
        <CardHeader><CardTitle>{T(ar, "Decision Engine", "محرك القرار")}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {T(ar, "Initialising institutional decision engine…", "جارٍ تهيئة محرك القرار المؤسسي…")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-background via-background to-primary/5" dir={ar ? "rtl" : "ltr"}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Cpu className="h-5 w-5 text-primary" />
            {T(ar, "Institutional Decision Engine", "محرك القرار المؤسسي")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <Activity className="me-1 h-3 w-3" /> {status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {T(ar, "Regime", "النظام")}: {packet.regime}
            </Badge>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              {T(ar, "Recompute", "إعادة الحساب")}
            </Button>
          </div>
        </div>

        {composite && (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className={`rounded-lg border p-3 ${BIAS[composite.bias]?.cls ?? ""}`}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
                <BiasIcon className="h-3.5 w-3.5" /> {T(ar, "Composite bias", "الاتجاه المركّب")}
              </div>
              <div className="mt-1 text-xl font-bold">{composite.bias} · {composite.score.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {T(ar, "Calibrated confidence", "ثقة معايَرة")}
              </div>
              <div className="mt-1 text-xl font-bold">{composite.confidence}%</div>
              <Progress value={composite.confidence} className="mt-2 h-1.5" />
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {T(ar, "Uncertainty", "عدم اليقين")}
              </div>
              <div className="mt-1 text-sm">
                σ {packet.uncertainty.stdev} · {T(ar, "entropy", "إنتروبيا")} {(packet.uncertainty.entropy * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                [{packet.uncertainty.low.toFixed(1)} … {packet.uncertainty.high.toFixed(1)}]
              </div>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {T(ar, "Lifecycle", "دورة الحياة")}
              </div>
              <div className="mt-1 text-sm">
                {stats.active}/{stats.total} {T(ar, "active", "نشط")} · {T(ar, "hit", "إصابة")} {(stats.hitRate * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                {T(ar, "avg return", "متوسط العائد")} {stats.avgRealized.toFixed(2)}%
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="composite"><Brain className="me-1 h-3.5 w-3.5" />{T(ar, "Consensus", "التوافق")}</TabsTrigger>
            <TabsTrigger value="recs"><Sparkles className="me-1 h-3.5 w-3.5" />{T(ar, "Recommendations", "التوصيات")}</TabsTrigger>
            <TabsTrigger value="scenarios"><Scale className="me-1 h-3.5 w-3.5" />{T(ar, "Scenarios", "السيناريوهات")}</TabsTrigger>
            <TabsTrigger value="conflicts"><ShieldAlert className="me-1 h-3.5 w-3.5" />{T(ar, "Conflicts", "التعارضات")}</TabsTrigger>
            <TabsTrigger value="explain"><GitMerge className="me-1 h-3.5 w-3.5" />{T(ar, "Explainability", "التفسير")}</TabsTrigger>
            <TabsTrigger value="audit"><History className="me-1 h-3.5 w-3.5" />{T(ar, "Audit", "السجل")}</TabsTrigger>
          </TabsList>

          {/* Consensus */}
          <TabsContent value="composite" className="mt-4 space-y-2">
            {packet.consensus.map((c) => {
              const Icon = BIAS[c.bias]?.icon ?? Minus;
              return (
                <div key={c.agentId} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-2.5">
                  <Badge variant="outline" className={`${BIAS[c.bias]?.cls ?? ""} text-[10px]`}>
                    <Icon className="me-1 h-3 w-3" /> {c.bias}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c.label}</span>
                      <span className="text-xs text-muted-foreground">
                        w {(c.weight * 100).toFixed(0)}% · {T(ar, "conf", "ثقة")} {c.confidence}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{T(ar, "score", "النتيجة")} {c.score}</span>
                      <span>·</span>
                      <span>{T(ar, "contribution", "المساهمة")} {c.contribution}</span>
                      {c.agreement && (
                        <Badge variant="outline" className="ms-auto h-5 text-[9px] text-emerald-300 border-emerald-500/30">
                          {T(ar, "agrees", "متفق")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground">
              {composite?.rationale}
            </div>
          </TabsContent>

          {/* Recommendations + lifecycle */}
          <TabsContent value="recs" className="mt-4 space-y-2">
            {packet.recommendations.map((r) => (
              <RecRow key={r.id} r={r} ar={ar}
                onTriggered={() => { setRecStatus(r.id, "triggered"); onRefresh(); }}
                onStopped={() => { setRecStatus(r.id, "stopped"); onRefresh(); }}
                onResolve={(pct) => { resolveRec(r.id, pct); onRefresh(); }}
                onCompare={() => setHistoryOf(r.asset)}
              />
            ))}

            {historyOf && (
              <div className="mt-3 rounded-lg border border-border/50 bg-card/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {T(ar, "History for", "السجل لـ")} {historyOf}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setHistoryOf(null)}>
                    {T(ar, "close", "إغلاق")}
                  </Button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {compareHistorical(historyOf, 8).map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                      <Badge variant="outline" className={STATUS_CLS[h.status]}>{h.status}</Badge>
                      <span>{h.action} · {h.sizePct}% · conf {h.confidence}%</span>
                      <span className={h.realizedReturnPct && h.realizedReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {h.realizedReturnPct != null ? `${h.realizedReturnPct.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Scenarios */}
          <TabsContent value="scenarios" className="mt-4 space-y-2">
            {packet.scenarios.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/50 bg-card/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{s.label}</div>
                  <Badge variant="outline">{(s.probability * 100).toFixed(0)}% · {s.expectedReturnPct.toFixed(2)}%</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <div><span className="font-medium">{T(ar, "Trigger", "المحفز")}:</span> {s.trigger}</div>
                  <div><span className="font-medium">{T(ar, "Defence", "الدفاع")}:</span> {s.defence}</div>
                </div>
                {s.children && (
                  <div className="ms-3 mt-2 space-y-1.5 border-s border-border/40 ps-3">
                    {s.children.map((c) => (
                      <div key={c.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 text-[10px]">{(c.probability * 100).toFixed(0)}%</Badge>
                          <span className="font-medium">{c.label}</span>
                          <span className="text-muted-foreground">· {c.expectedReturnPct.toFixed(2)}%</span>
                        </div>
                        <div className="text-muted-foreground">↳ {c.trigger}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {/* Conflicts */}
          <TabsContent value="conflicts" className="mt-4 space-y-2">
            {packet.conflicts.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                <CheckCircle2 className="me-1 inline h-4 w-4" />
                {T(ar, "No agent conflicts detected.", "لا توجد تعارضات بين الوكلاء.")}
              </div>
            ) : packet.conflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <div className="font-semibold text-amber-300">
                  <AlertTriangle className="me-1 inline h-3.5 w-3.5" />
                  {c.pair[0]} ↔ {c.pair[1]} · Δ {c.delta}
                </div>
                <div className="mt-1 text-muted-foreground">{c.resolution}</div>
              </div>
            ))}
          </TabsContent>

          {/* Explainability */}
          <TabsContent value="explain" className="mt-4">
            <div className="grid gap-2 md:grid-cols-2">
              {packet.explain.nodes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border/50 bg-card/40 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{n.label}</span>
                    <Badge variant="outline" className="h-5 text-[10px]">{n.kind}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{n.detail}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>w {(n.weight * 100).toFixed(0)}%</span>
                    <span>·</span>
                    <span>{T(ar, "contrib", "مساهمة")} {n.contribution}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              {T(ar, "Edges", "العلاقات")}: {explainEdges.length}
            </div>
          </TabsContent>

          {/* Audit */}
          <TabsContent value="audit" className="mt-4 space-y-1.5">
            {audit.length === 0 ? (
              <div className="text-sm text-muted-foreground">{T(ar, "No audit entries yet.", "لا يوجد سجل بعد.")}</div>
            ) : audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-card/30 p-2 text-[11px]">
                <span className="font-mono text-muted-foreground">{new Date(a.ts).toLocaleTimeString()}</span>
                <Badge variant="outline" className="h-5 text-[10px]">{a.kind}</Badge>
                <span className="truncate text-muted-foreground">{a.note ?? JSON.stringify(a.after ?? a.before ?? {})}</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RecRow({
  r, ar, onTriggered, onStopped, onResolve, onCompare,
}: {
  r: Recommendation; ar: boolean;
  onTriggered: () => void; onStopped: () => void;
  onResolve: (pct: number) => void; onCompare: () => void;
}) {
  const aged = Math.round(r.agingScore * 100);
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
          <span className="font-semibold">{r.assetName ?? r.asset}</span>
          <span className="text-xs text-muted-foreground">· {r.sizePct}%</span>
          <Badge variant="outline" className={STATUS_CLS[r.status]}>{r.status}</Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{T(ar, "aging", "العمر")} {aged}%</span>
          <span>· {T(ar, "conf", "ثقة")} {r.confidence}%</span>
        </div>
      </div>
      <Progress value={aged} className="mt-2 h-1" />
      <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{r.rationale}</div>

      {r.status === "active" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onTriggered}>
            <CheckCircle2 className="me-1 h-3 w-3" /> {T(ar, "Mark triggered", "تم التفعيل")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onStopped}>
            <XCircle className="me-1 h-3 w-3" /> {T(ar, "Stop", "إيقاف")}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onCompare}>
            <History className="me-1 h-3 w-3" /> {T(ar, "Compare", "مقارنة")}
          </Button>
        </div>
      )}
      {(r.status === "triggered" || r.status === "active") && (
        <ResolveInline onResolve={onResolve} ar={ar} />
      )}
    </div>
  );
}

function ResolveInline({ onResolve, ar }: { onResolve: (pct: number) => void; ar: boolean }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px]">
      <input
        type="number" step="0.01" value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={T(ar, "realised %", "النسبة المحققة %")}
        className="h-7 w-28 rounded border border-border/50 bg-background px-2 text-[11px]"
      />
      <Button
        size="sm" variant="ghost" className="h-7 text-[11px]"
        disabled={val === "" || isNaN(Number(val))}
        onClick={() => { onResolve(Number(val)); setVal(""); }}
      >
        {T(ar, "Resolve", "تسجيل النتيجة")}
      </Button>
    </div>
  );
}
