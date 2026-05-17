// Edge Command Center — adds 5 new institutional discovery sections to the AI dashboard:
// Early Momentum Radar, Breakout Probability, Liquidity Rotation, Whale Activity, Top Ranked Opportunities.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Radar, Zap, Waves, AlertOctagon, Crown, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import type { MarketIntel } from "@/services/analysis";

interface Props { data: MarketIntel; ar: boolean }

function Panel({ icon, title, subtitle, children, className }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
      "transition-all hover:border-primary/40", className,
    )}>
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">{icon}</span>
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function DirArrow({ dir }: { dir: "up" | "down" | "long" | "short" | "neutral" }) {
  if (dir === "up" || dir === "long")
    return <ArrowUpRight className="h-3.5 w-3.5 text-success" />;
  if (dir === "down" || dir === "short")
    return <ArrowDownRight className="h-3.5 w-3.5 text-danger" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function EdgeCommandCenter({ data, ar }: Props) {
  const early = data.earlyMomentum.slice(0, 5);
  const breakouts = data.breakouts.slice(0, 5);
  const ranked = data.rankedOpportunities.slice(0, 5);
  const whales = data.whales.signals.slice(0, 4);
  const liq = data.liquidity;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-glow">
          <Radar className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">
            {ar ? "مركز الاكتشاف المتقدم" : "Edge Discovery Center"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "إشارات مبكرة، اختراقات محتملة، تدفق السيولة، نشاط الحيتان وتصنيف الفرص"
              : "Early signals, breakout setups, liquidity rotation, whale activity & ranked opportunities"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Early Momentum Radar */}
        <Panel
          icon={<Radar className="h-4 w-4" />}
          title={ar ? "رادار الزخم المبكر" : "Early Momentum Radar"}
          subtitle={ar ? "كشف الزخم قبل التحرك" : "Detect momentum before expansion"}
        >
          <div className="space-y-2.5">
            {early.map((e) => (
              <div key={e.asset} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/30 font-mono">{e.asset}</Badge>
                    <span className="text-sm font-semibold">{e.assetName}</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    e.warning === "imminent" ? "border-danger/40 text-danger" :
                    e.warning === "watch" ? "border-warning/40 text-warning" :
                    "border-muted-foreground/30 text-muted-foreground",
                  )}>
                    {e.warning === "imminent" ? (ar ? "وشيك" : "Imminent")
                      : e.warning === "watch" ? (ar ? "مراقبة" : "Watch")
                      : (ar ? "هادئ" : "Calm")}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div>
                    <div>{ar ? "الزخم" : "Momentum"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{e.score}</div>
                  </div>
                  <div>
                    <div>{ar ? "اختراق" : "Breakout"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{e.breakoutProbability}%</div>
                  </div>
                  <div>
                    <div>{ar ? "الثقة" : "Confidence"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{e.confidence}%</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{e.note}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Breakout Probability */}
        <Panel
          icon={<Zap className="h-4 w-4" />}
          title={ar ? "احتمالية الاختراق" : "Breakout Probability"}
          subtitle={ar ? "ضغط التذبذب واتجاه التحرك" : "Squeeze + directional pressure"}
        >
          <div className="space-y-2.5">
            {breakouts.map((b) => (
              <div key={b.asset} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/30 font-mono">{b.asset}</Badge>
                    <DirArrow dir={b.direction} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {b.direction === "neutral" ? (ar ? "محايد" : "Neutral") : b.direction}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    b.riskLevel === "high" ? "border-danger/40 text-danger" :
                    b.riskLevel === "medium" ? "border-warning/40 text-warning" :
                    "border-success/40 text-success",
                  )}>
                    {ar ? "مخاطر" : "Risk"}: {b.riskLevel}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div>
                    <div>{ar ? "الثقة" : "Confidence"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{b.confidence}%</div>
                  </div>
                  <div>
                    <div>{ar ? "الضغط" : "Squeeze"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{b.squeeze}</div>
                  </div>
                  <div>
                    <div>{ar ? "حركة متوقعة" : "Est. Move"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{b.estimatedMovePct}%</div>
                  </div>
                </div>
                <Progress value={b.confidence} className="mt-2 h-1" />
              </div>
            ))}
          </div>
        </Panel>

        {/* Liquidity Rotation */}
        <Panel
          icon={<Waves className="h-4 w-4" />}
          title={ar ? "تدفق السيولة" : "Liquidity Rotation"}
          subtitle={liq.note}
        >
          <div className="mb-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
              <div>{ar ? "الميل" : "Bias"}</div>
              <div className={cn("mt-0.5 font-mono text-sm font-bold",
                liq.bias === "risk-on" ? "text-success" :
                liq.bias === "risk-off" ? "text-danger" :
                liq.bias === "defensive" ? "text-warning" : "text-foreground",
              )}>{liq.bias}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
              <div>{ar ? "الأقوى" : "Strongest"}</div>
              <div className="mt-0.5 text-sm font-bold text-success">{liq.strongestSector}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
              <div>{ar ? "الأضعف" : "Weakest"}</div>
              <div className="mt-0.5 text-sm font-bold text-danger">{liq.weakestSector}</div>
            </div>
          </div>
          <div className="space-y-2">
            {liq.sectors.map((s) => {
              const positive = s.flowScore >= 0;
              const pct = Math.min(100, Math.abs(s.flowScore));
              return (
                <div key={s.sector} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{s.sector}</span>
                    <span className={cn("font-mono", positive ? "text-success" : "text-danger")}>
                      {positive ? "+" : ""}{s.flowScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                    <div className={cn("h-full transition-all", positive ? "bg-success" : "bg-danger")}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            {ar ? "تركيز السيولة" : "Concentration"}: <span className="font-mono text-foreground">{liq.concentration}/100</span>
          </div>
        </Panel>

        {/* Whale Activity */}
        <Panel
          icon={<AlertOctagon className="h-4 w-4" />}
          title={ar ? "نشاط الحيتان" : "Whale Activity Alerts"}
          subtitle={ar ? "تحركات غير اعتيادية وعدم توازن" : "Abnormal activity & imbalance"}
        >
          <div className="space-y-2.5">
            {whales.map((w) => (
              <div key={w.asset} className={cn(
                "rounded-lg border p-3",
                w.severity === "critical" ? "border-danger/40 bg-danger/5" :
                w.severity === "warning" ? "border-warning/40 bg-warning/5" :
                "border-border/40 bg-muted/10",
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-primary/30 font-mono">{w.asset}</Badge>
                    <DirArrow dir={w.directionalBias} />
                    <span className="text-xs font-semibold">{w.assetName}</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] uppercase",
                    w.severity === "critical" ? "border-danger/40 text-danger" :
                    w.severity === "warning" ? "border-warning/40 text-warning" :
                    "border-muted-foreground/30 text-muted-foreground",
                  )}>{w.severity}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div>
                    <div>{ar ? "النشاط" : "Activity"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{w.activityScore}</div>
                  </div>
                  <div>
                    <div>{ar ? "تلاعب" : "Manip. Risk"}</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{w.manipulationRisk}</div>
                  </div>
                  <div>
                    <div>{ar ? "عدم توازن" : "Imbalance"}</div>
                    <div className={cn("mt-0.5 font-mono text-sm font-bold",
                      w.imbalance > 0 ? "text-success" : w.imbalance < 0 ? "text-danger" : "text-foreground")}>
                      {w.imbalance > 0 ? "+" : ""}{w.imbalance}
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{w.note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Top Ranked Opportunities — full width */}
      <Panel
        icon={<Crown className="h-4 w-4" />}
        title={ar ? "أفضل الفرص المصنّفة" : "Top Ranked Opportunities"}
        subtitle={ar ? "تصنيف مؤسسي يدمج الزخم والثقة والاختراق والسيولة" : "Institutional rank fusing momentum, confidence, breakout & flows"}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ranked.map((o) => (
            <div key={o.asset} className="rounded-xl border border-border/40 bg-gradient-to-br from-muted/10 to-transparent p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 font-mono text-xs font-bold text-primary">
                    #{o.rank}
                  </span>
                  <Badge variant="outline" className="border-primary/30 font-mono">{o.asset}</Badge>
                </div>
                <DirArrow dir={o.direction} />
              </div>
              <div className="mt-2 text-sm font-semibold">{o.assetName}</div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{ar ? "الدرجة" : "Score"}</span>
                  <span className="font-mono text-sm font-bold text-foreground">{o.score}</span>
                </div>
                <Progress value={o.score} className="mt-1 h-1.5" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div>
                  <div>{ar ? "التوقيت" : "Timing"}</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-foreground">{o.timingQuality}</div>
                </div>
                <div>
                  <div>{ar ? "مخاطرة/عائد" : "R/R"}</div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-foreground">{o.riskReward}</div>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 text-[10px] text-muted-foreground">{o.rationale}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
