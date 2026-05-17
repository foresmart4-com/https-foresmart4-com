import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfidenceBar, RiskHeat } from "@/components/dashboard/ConfidenceBar";
import {
  Target, GitBranch, CalendarClock, BrainCircuit, BellRing,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
} from "lucide-react";
import type { MarketIntel } from "@/services/analysis";

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn(
      "border-border/50 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all hover:border-primary/40",
      className,
    )}>
      {children}
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, tone = "primary" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; tone?: "primary" | "accent" | "warning" | "danger" | "success";
}) {
  const toneMap = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    success: "bg-success/15 text-success",
  };
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneMap[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function DirArrow({ d }: { d: "bullish" | "bearish" | "mixed" }) {
  if (d === "bullish") return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (d === "bearish") return <TrendingDown className="h-3.5 w-3.5 text-danger" />;
  return <Minus className="h-3.5 w-3.5 text-warning" />;
}

const urgencyClass: Record<string, string> = {
  Critical: "border-danger/50 text-danger bg-danger/10",
  High: "border-warning/50 text-warning bg-warning/10",
  Medium: "border-primary/40 text-primary bg-primary/10",
  Low: "border-muted-foreground/30 text-muted-foreground",
};

export function AICommandCenter({ data, ar }: { data: MarketIntel; ar: boolean }) {
  return (
    <div className="space-y-6">
      {/* Opportunity Scanner */}
      <section>
        <SectionHeader
          icon={Target}
          title={ar ? "ماسح الفرص الذكي" : "Opportunity Scanner"}
          subtitle={ar ? "فرص ذات احتمالية مرتفعة بلغة الاحتمالات" : "Probability-weighted setups across the universe"}
          tone="success"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.opportunities.length === 0 && (
            <Panel className="p-4 text-sm text-muted-foreground">
              {ar ? "لا توجد فرص بارزة الآن — السوق في حالة توازن." : "No standout setups right now — market in balance."}
            </Panel>
          )}
          {data.opportunities.map((o) => (
            <Panel key={o.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{o.asset}</div>
                  <div className="font-semibold">{o.assetName}</div>
                </div>
                <Badge variant="outline" className="border-accent/40 text-accent">{o.kind}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{ar ? "قوة الفرصة" : "Opportunity score"}</span>
                    <span className="font-bold text-primary">{o.score}</span>
                  </div>
                  <ConfidenceBar value={o.score} />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{ar ? "الثقة" : "Confidence"}: <span className="font-bold text-foreground">{o.confidence}%</span></span>
                  <span className="text-muted-foreground">{ar ? "الإلحاح" : "Urgency"}: <span className="font-bold text-foreground">{o.urgency}</span></span>
                </div>
                <Badge variant="outline" className="border-primary/30 text-[10px]">{o.entryBias}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{o.explanation}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Correlation Matrix + Event Impact Feed */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader
            icon={GitBranch}
            title={ar ? "مصفوفة الارتباط" : "Correlation Matrix"}
            subtitle={ar ? "علاقات الأصول الرئيسية" : "Lead/lag relationships across the universe"}
            tone="accent"
          />
          <Panel className="divide-y divide-border/40">
            {data.correlations.map((c) => {
              const tone =
                c.kind === "positive" ? "text-success" :
                c.kind === "inverse" ? "text-danger" : "text-muted-foreground";
              return (
                <div key={`${c.a}-${c.b}`} className="p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{c.a}</span>
                      <span className="text-muted-foreground">↔</span>
                      <span>{c.b}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-mono text-xs tabular-nums", tone)}>{c.coefficient.toFixed(2)}</span>
                      <Badge variant="outline" className={cn("border-current text-[10px]", tone)}>{c.kind}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 max-w-[80%]">
                    <RiskHeat value={c.strength} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{c.explanation}</p>
                </div>
              );
            })}
          </Panel>
        </div>

        <div>
          <SectionHeader
            icon={CalendarClock}
            title={ar ? "تأثير الأحداث" : "Event Impact Feed"}
            subtitle={ar ? "تصنيف الأحداث الكلية والمالية" : "Macro & financial event classification"}
            tone="warning"
          />
          <Panel className="divide-y divide-border/40">
            {data.events.slice(0, 6).map((e) => (
              <div key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <DirArrow d={e.direction} />
                      <span>{e.category}</span>
                      <span>· {e.duration}</span>
                    </div>
                    <h4 className="text-sm font-semibold leading-snug">{e.headline}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.reasoning}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <Badge variant="outline" className="border-primary/30">{e.strength}</Badge>
                    <div className="flex flex-wrap justify-end gap-1">
                      {e.affectedAssets.slice(0, 3).map((a) => (
                        <span key={a} className="rounded bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {data.events.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">{ar ? "لا توجد أحداث ذات تأثير قوي حالياً." : "No high-impact events right now."}</div>
            )}
          </Panel>
        </div>
      </div>

      {/* AI Reasoning Feed + Smart Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader
            icon={BrainCircuit}
            title={ar ? "تفكير الذكاء الاصطناعي" : "AI Reasoning Feed"}
            subtitle={ar ? "تحليل بأسلوب صناديق التحوط" : "Hedge-fund-style narrative with probabilistic framing"}
            tone="primary"
          />
          <Panel className="divide-y divide-border/40">
            {data.reasoning.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{r.title}</h4>
                  <Badge variant="outline" className="border-primary/30 text-[10px]">{r.kind}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.body}</p>
                <div className="mt-2 max-w-[60%]">
                  <ConfidenceBar value={r.confidence} />
                </div>
              </div>
            ))}
          </Panel>
        </div>

        <div>
          <SectionHeader
            icon={BellRing}
            title={ar ? "التنبيهات الذكية" : "Smart Alerts"}
            subtitle={ar ? "تحركات وفرص ومخاطر فورية" : "Momentum, news, opportunities & risk shifts"}
            tone="danger"
          />
          <Panel className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
            {data.alerts.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">{ar ? "لا توجد تنبيهات حرجة." : "No critical alerts."}</div>
            )}
            {data.alerts.map((a) => (
              <div key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn("mt-0.5 h-4 w-4", a.urgency === "Critical" ? "text-danger" : a.urgency === "High" ? "text-warning" : "text-primary")} />
                    <div>
                      <h4 className="text-sm font-semibold leading-snug">{a.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{a.explanation}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.affectedAssets.map((x) => (
                          <span key={x} className="rounded bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold">{x}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={cn("text-[10px]", urgencyClass[a.urgency])}>{a.urgency}</Badge>
                    <span className="text-[10px] text-muted-foreground">{a.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
