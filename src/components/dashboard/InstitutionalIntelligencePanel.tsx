import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Brain, Globe, LineChart, Sigma, Newspaper, PieChart, Cpu, Activity,
  TrendingUp, TrendingDown, Minus, ShieldAlert, Sparkles, Radio,
} from "lucide-react";
import type { MarketIntel } from "@/services/analysis";
import { useInstitutionalIntelligence } from "@/hooks/useInstitutionalIntelligence";
import { memoryAgent, type RiskAppetite } from "@/services/agents/memoryAgent";
import type { AgentId, Bias } from "@/services/agents/types";

interface Props { intel: MarketIntel | undefined; ar?: boolean }
const T = (ar: boolean, en: string, arT: string) => (ar ? arT : en);

const AGENT_ICON: Record<AgentId, typeof Brain> = {
  macro: Globe, technical: LineChart, quant: Sigma,
  sentiment: Newspaper, portfolio: PieChart, strategy: Brain,
};

const BIAS_COLOR: Record<Bias, string> = {
  bullish: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  bearish: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  neutral: "text-slate-300 border-slate-500/30 bg-slate-500/10",
};
const BIAS_ICON = { bullish: TrendingUp, bearish: TrendingDown, neutral: Minus } as const;

const STATUS_COLOR: Record<string, string> = {
  live: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  connecting: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  degraded: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  stale: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  closed: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

export function InstitutionalIntelligencePanel({ intel, ar = false }: Props) {
  const language: "ar" | "en" = ar ? "ar" : "en";
  const { view, status } = useInstitutionalIntelligence(intel, language);
  const [risk, setRisk] = useState<RiskAppetite>(() => memoryAgent.getProfile().riskAppetite);

  const setAppetite = (r: RiskAppetite) => { memoryAgent.setRiskAppetite(r); setRisk(r); };

  const composite = view?.composite;
  const obs = view?.observability;
  const BiasIcon = composite ? (BIAS_ICON[composite.bias] ?? Minus) : Minus;

  const totalContribution = useMemo(
    () => (view?.agents ?? []).reduce((s, a) => s + Math.abs(a.score * a.weight), 0) || 1,
    [view],
  );

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-background via-background to-primary/5" dir={ar ? "rtl" : "ltr"}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Cpu className="w-5 h-5 text-primary" />
            {T(ar, "Institutional Intelligence", "الذكاء المؤسسي")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STATUS_COLOR[status]}>
              <Radio className={`w-3 h-3 ${ar ? "ml-1" : "mr-1"} ${status === "live" ? "animate-pulse" : ""}`} />
              {status.toUpperCase()}
            </Badge>
            {composite && (
              <Badge variant="outline" className={BIAS_COLOR[composite.bias]}>
                <BiasIcon className={`w-3 h-3 ${ar ? "ml-1" : "mr-1"}`} />
                {composite.bias.toUpperCase()} · {composite.score.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!view && (
          <div className="text-sm text-muted-foreground p-4">
            {T(ar, "Initialising multi-agent intelligence…", "تهيئة الذكاء متعدد الوكلاء…")}
          </div>
        )}

        {view && (
          <>
            {/* Composite */}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {T(ar, "Composite institutional view", "الرأي المؤسسي المركّب")}
                  </div>
                  <div className="text-lg font-bold mt-0.5 truncate">
                    {composite!.bias === "bullish"
                      ? T(ar, "Risk-positive posture", "موقف إيجابي تجاه المخاطر")
                      : composite!.bias === "bearish"
                      ? T(ar, "Defensive posture", "موقف دفاعي")
                      : T(ar, "Balanced posture", "موقف متوازن")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{composite!.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {T(ar, "Confidence", "الثقة")}
                  </div>
                  <div className="text-2xl font-bold">{composite!.confidence}%</div>
                </div>
              </div>
              <Progress value={composite!.confidence} className="h-1.5 mt-3" />
            </div>

            {/* Agent ensemble */}
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {T(ar, "Specialised agents", "الوكلاء المتخصصون")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {view.agents.map((a) => {
                  const Icon = AGENT_ICON[a.id] ?? Activity;
                  const BI = BIAS_ICON[a.bias] ?? Minus;
                  const contribPct = Math.round((Math.abs(a.score * a.weight) / totalContribution) * 100);
                  return (
                    <div key={a.id} className="p-3 rounded-md border border-border/50 bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm font-semibold truncate">{a.label}</span>
                        </div>
                        <Badge variant="outline" className={`${BIAS_COLOR[a.bias]} shrink-0`}>
                          <BI className="w-3 h-3" />
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.headline}</p>
                      <div className="flex items-center justify-between text-[10px] mt-2 text-muted-foreground">
                        <span>{T(ar, "Confidence", "الثقة")} {a.confidence.toFixed(0)}%</span>
                        <span>{T(ar, "Weight", "الوزن")} {Math.round(a.weight * 100)}%</span>
                        <span>{T(ar, "Impact", "الأثر")} {contribPct}%</span>
                      </div>
                      {a.flags && a.flags.length > 0 && (
                        <div className="mt-2 text-[10px] text-amber-300 flex items-start gap-1">
                          <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="truncate">{a.flags[0]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <div className="text-sm font-medium mb-2">
                {T(ar, "Risk-adjusted recommendations", "توصيات معدّلة بالمخاطر")}
              </div>
              <div className="space-y-1.5 max-h-56 overflow-auto">
                {view.recommendations.slice(0, 6).map((r) => (
                  <div key={r.asset} className="text-xs p-2 rounded border border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{r.asset} · {r.action}</span>
                      <span className="text-muted-foreground shrink-0">
                        {T(ar, "Size", "الحجم")} {r.sizePct}% · {T(ar, "Conf", "ثقة")} {r.confidence}%
                      </span>
                    </div>
                    <p className="opacity-80 mt-1">{r.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenarios */}
            <div>
              <div className="text-sm font-medium mb-2">
                {T(ar, "Scenario forecasting", "توقعات السيناريوهات")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {view.scenarios.map((s) => (
                  <div key={s.name} className="p-2.5 rounded-md border border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s.probability}%</span>
                    </div>
                    <Progress value={s.probability} className="h-1 mt-1.5" />
                    <div className={`text-xs mt-1.5 ${s.expectedReturnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {s.expectedReturnPct >= 0 ? "+" : ""}{s.expectedReturnPct.toFixed(2)}%
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.trigger}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning tree */}
            <div>
              <div className="text-sm font-medium mb-2">
                {T(ar, "Reasoning tree", "شجرة الاستدلال")}
              </div>
              <div className="text-xs space-y-1 max-h-48 overflow-auto p-2 rounded border border-border/50 bg-muted/20">
                {view.reasoningTree.children?.map((node) => (
                  <details key={node.id} className="border border-border/40 rounded p-1.5">
                    <summary className="cursor-pointer flex items-center justify-between gap-2">
                      <span className="font-medium">{node.label}</span>
                      <span className={node.contribution >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {node.contribution >= 0 ? "+" : ""}{node.contribution.toFixed(1)}
                      </span>
                    </summary>
                    <ul className={`mt-1.5 space-y-0.5 ${ar ? "pr-3" : "pl-3"}`}>
                      {node.children?.map((c) => (
                        <li key={c.id} className="text-muted-foreground">• {c.label}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>

            {/* Observability + user adaptation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-border/50 bg-muted/20">
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {T(ar, "AI Observability", "مراقبة الذكاء الاصطناعي")}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label={T(ar, "Quality", "الجودة")} value={`${obs!.qualityScore}`} tone={obs!.qualityScore >= 65 ? "good" : "warn"} />
                  <Metric label={T(ar, "Hallucination", "هلوسة")} value={`${obs!.hallucinationRisk}`} tone={obs!.hallucinationRisk <= 25 ? "good" : "warn"} />
                  <Metric label={T(ar, "Drift", "الانحراف")} value={`${obs!.driftScore}`} tone={obs!.driftScore <= 40 ? "good" : "warn"} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  {T(ar, "Track record", "السجل")} · {obs!.accuracyWindow.trades} {T(ar, "calls", "صفقات")} ·
                  {" "}{T(ar, "Win rate", "نسبة الفوز")} {(obs!.accuracyWindow.winRate * 100).toFixed(0)}%
                </div>
                {obs!.warnings.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {obs!.warnings.slice(0, 3).map((w, i) => (
                      <div key={i} className="text-[10px] text-amber-300 flex items-start gap-1">
                        <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-md border border-border/50 bg-muted/20">
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  {T(ar, "AI Memory · Risk appetite", "ذاكرة AI · شهية المخاطر")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["conservative", "balanced", "aggressive"] as RiskAppetite[]).map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={risk === r ? "default" : "outline"}
                      onClick={() => setAppetite(r)}
                      className="text-xs h-8"
                    >
                      {T(ar,
                        r === "conservative" ? "Conservative" : r === "balanced" ? "Balanced" : "Aggressive",
                        r === "conservative" ? "محافظ" : r === "balanced" ? "متوازن" : "هجومي",
                      )}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {T(ar,
                    "Recommendation sizing adapts to your risk profile and historical accuracy.",
                    "أحجام التوصيات تتكيّف مع شهية المخاطر والأداء التاريخي.")}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" }) {
  return (
    <div className={`p-2 rounded border ${tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-amber-500/30 bg-amber-500/5"}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
