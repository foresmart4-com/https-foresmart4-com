import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { askAdvisor, type AdvisorStructuredReply, type TimelineSection, type TimelineRecommendation } from "@/lib/ai-advisor.functions";
import { getMarketData } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain, Send, Sparkles, Clock, CalendarDays, Hourglass,
  TrendingUp, TrendingDown, Pause, Eye, AlertTriangle, Wallet, Briefcase, Target, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AIDecisionPanel } from "@/components/AIDecisionPanel";
import { AutoTradingControlPanel } from "@/components/AutoTradingControlPanel";
import { AIDecisionTester } from "@/components/AIDecisionTester";

export const Route = createFileRoute("/_app/advisor")({
  component: AdvisorPage,
});

function AdvisorPage() {
  const { t, lang } = useI18n();
  const ask = useServerFn(askAdvisor);
  const marketFn = useServerFn(getMarketData);
  const { data: market } = useQuery({ queryKey: ["market"], queryFn: () => marketFn() });
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<AdvisorStructuredReply | null>(null);
  const [rawFallback, setRawFallback] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!q.trim()) return;
    setBusy(true); setReply(null); setRawFallback("");
    try {
      const ctx = (market?.assets ?? [])
        .slice(0, 12)
        .map((a) => `${a.symbol}: ${a.price} (${a.changePct.toFixed(2)}%)`)
        .join("\n");
      const res = await ask({ data: { question: q, language: lang, context: ctx } });
      if (res.error === "rate_limited") return toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit, try again");
      if (res.error === "payment_required") return toast.error(lang === "ar" ? "أضف رصيداً في إعدادات Lovable AI" : "Add credits in Lovable AI settings");
      if (res.error) return toast.error(res.error);
      if (res.structured) setReply(res.structured);
      else setRawFallback(res.raw);
    } catch (error: any) {
      console.error(error);
      toast.error(lang === "ar" ? "تعذر الاتصال بالمستشار" : "Could not reach advisor");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = lang === "ar"
    ? ["حلّل السوق السعودي اليوم", "قارن بين الذهب وناسداك", "ما مخاطر شراء أرامكو؟", "اقترح توزيع محفظة متوازن"]
    : ["Analyze the Saudi market today", "Compare Gold vs Nasdaq", "What are the risks of buying Aramco?", "Suggest a balanced portfolio allocation"];

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border gradient-card p-6 shadow-card">
        <div className="absolute -top-16 -end-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              ForeSmart AI Analyst
            </div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
              <span className="text-gradient">{t("advisor")}</span>
            </h1>
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1 text-[11px] text-warning">
              <AlertTriangle className="h-3 w-3" />
              {lang === "ar" ? "التحليل مساعد ولا يعتبر توصية مالية ملزمة." : "Analysis is assistive only — not binding financial advice."}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {lang === "ar"
                ? "إجابات مرتبة على شكل جدول زمني — قصير، متوسط، وطويل المدى — مع توصيات شراء/بيع، مستويات دخول، وقف خسارة وأهداف ربح."
                : "Answers organized into a clear timeline — short, medium and long-term — with buy/sell calls, entries, stop-loss and profit targets."}
            </p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-2xl border border-border gradient-card p-5 shadow-card">
        <Textarea
          rows={4}
          placeholder={t("advisorPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="resize-none border-border/60 bg-background/40 text-base"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={send} disabled={busy} className="gradient-primary text-primary-foreground shadow-glow">
            <Send className="me-2 h-4 w-4" />
            {busy ? t("loading") : t("send")}
          </Button>
        </div>
      </div>

      {busy && <ThinkingState lang={lang} />}

      {reply && <StructuredReply data={reply} lang={lang} />}

      {!reply && rawFallback && (
        <div className="mt-6 whitespace-pre-wrap rounded-xl border border-border gradient-card p-6 text-sm shadow-card">
          {rawFallback}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <AIDecisionPanel />
        <AIDecisionTester />
        <AutoTradingControlPanel />
      </div>
    </div>
  );
}

function ThinkingState({ lang }: { lang: "ar" | "en" }) {
  return (
    <div className="mt-6 grid gap-3 rounded-2xl border border-border gradient-card p-6 shadow-card">
      <div className="flex items-center gap-2 text-sm text-primary">
        <Activity className="h-4 w-4 animate-pulse" />
        {lang === "ar" ? "جارٍ تحليل الأسواق والعوامل المؤثرة..." : "Analyzing markets and macro drivers..."}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[0,1,2].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

const horizonMeta = {
  short:  { ar: "قصير المدى", en: "Short term", sub: { ar: "أيام – أسابيع", en: "Days – weeks" }, icon: Clock,        accent: "text-warning bg-warning/10 ring-warning/30" },
  medium: { ar: "متوسط المدى", en: "Medium term", sub: { ar: "أسابيع – أشهر", en: "Weeks – months" }, icon: Hourglass, accent: "text-primary bg-primary/10 ring-primary/30" },
  long:   { ar: "طويل المدى", en: "Long term",  sub: { ar: "أشهر – سنوات", en: "Months – years" }, icon: CalendarDays,  accent: "text-accent bg-accent/10 ring-accent/30" },
} as const;

function StructuredReply({ data, lang }: { data: AdvisorStructuredReply; lang: "ar" | "en" }) {
  const ordered = ["short", "medium", "long"].map(h => data.timeline?.find(s => s.horizon === h)).filter(Boolean) as TimelineSection[];

  return (
    <div className="mt-8 space-y-6">
      {/* Headline */}
      {data.headline && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">{lang === "ar" ? "الخلاصة" : "Headline"}</div>
          <h2 className="mt-1 font-display text-2xl font-bold leading-snug">{data.headline}</h2>
          {data.marketSnapshot && <p className="mt-2 text-sm text-muted-foreground">{data.marketSnapshot}</p>}
        </div>
      )}

      {/* Factors */}
      {data.factors?.length > 0 && (
        <section>
          <SectionTitle icon={Sparkles} label={lang === "ar" ? "العوامل المؤثرة" : "Key macro factors"} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.factors.map((f, i) => (
              <div key={i} className="rounded-xl border border-border gradient-card p-4 shadow-card">
                <div className="text-sm font-semibold text-foreground">{f.name}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.impact}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      {ordered.length > 0 && (
        <section>
          <SectionTitle icon={Clock} label={lang === "ar" ? "الجدول الزمني للتوصيات" : "Recommendations timeline"} />
          <div className="grid gap-5 lg:grid-cols-3">
            {ordered.map((s) => <TimelineCard key={s.horizon} section={s} lang={lang} />)}
          </div>
        </section>
      )}

      {/* Capital plans */}
      {(data.smallCapitalPlan || data.midCapitalPlan) && (
        <section>
          <SectionTitle icon={Briefcase} label={lang === "ar" ? "خطط حسب رأس المال" : "Plans by capital size"} />
          <div className="grid gap-4 md:grid-cols-2">
            {data.smallCapitalPlan && (
              <PlanCard icon={Wallet} title={lang === "ar" ? "رأس مال صغير (< 10,000$)" : "Small capital (< $10k)"} body={data.smallCapitalPlan} tone="success" />
            )}
            {data.midCapitalPlan && (
              <PlanCard icon={Briefcase} title={lang === "ar" ? "رأس مال متوسط (10K–100K$)" : "Mid capital ($10k–$100k)"} body={data.midCapitalPlan} tone="primary" />
            )}
          </div>
        </section>
      )}

      {/* Risks */}
      {data.risks?.length > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            {lang === "ar" ? "المخاطر التي يجب مراقبتها" : "Risks to monitor"}
          </div>
          <ul className="grid gap-1.5 ps-4 text-sm text-foreground/90">
            {data.risks.map((r, i) => <li key={i} className="list-disc">{r}</li>)}
          </ul>
        </section>
      )}

      {data.disclaimer && (
        <p className="text-center text-xs italic text-muted-foreground">{data.disclaimer}</p>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h3 className="font-display text-lg font-bold">{label}</h3>
    </div>
  );
}

function TimelineCard({ section, lang }: { section: TimelineSection; lang: "ar" | "en" }) {
  const meta = horizonMeta[section.horizon] ?? horizonMeta.medium;
  const Icon = meta.icon;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border gradient-card p-5 shadow-card">
      <div className={cn("absolute inset-x-0 top-0 h-1", section.horizon === "short" ? "bg-warning" : section.horizon === "medium" ? "bg-primary" : "bg-accent")} />
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{lang === "ar" ? meta.sub.ar : meta.sub.en}</div>
          <div className="mt-0.5 font-display text-lg font-bold">{lang === "ar" ? meta.ar : meta.en}</div>
        </div>
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl ring-1", meta.accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </header>

      {section.title && <div className="mt-3 text-sm font-semibold">{section.title}</div>}
      {section.summary && <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>}

      {section.keyDrivers?.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-muted-foreground">{lang === "ar" ? "محركات رئيسية" : "Key drivers"}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {section.keyDrivers.map((d, i) => (
              <span key={i} className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs">{d}</span>
            ))}
          </div>
        </div>
      )}

      {section.recommendations?.length > 0 && (
        <div className="mt-4 space-y-2">
          {section.recommendations.map((r, i) => <RecommendationRow key={i} rec={r} lang={lang} />)}
        </div>
      )}
    </article>
  );
}

const actionMeta = {
  buy:   { icon: TrendingUp,   cls: "text-success bg-success/15 ring-success/30",  ar: "شراء", en: "Buy"   },
  sell:  { icon: TrendingDown, cls: "text-danger bg-danger/15 ring-danger/30",     ar: "بيع",  en: "Sell"  },
  hold:  { icon: Pause,        cls: "text-warning bg-warning/15 ring-warning/30",  ar: "احتفاظ", en: "Hold" },
  watch: { icon: Eye,          cls: "text-primary bg-primary/15 ring-primary/30",  ar: "مراقبة", en: "Watch" },
} as const;

function RecommendationRow({ rec, lang }: { rec: TimelineRecommendation; lang: "ar" | "en" }) {
  const m = actionMeta[rec.action] ?? actionMeta.watch;
  const Icon = m.icon;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1", m.cls)}>
            <Icon className="h-3 w-3" />
            {lang === "ar" ? m.ar : m.en}
          </span>
          <span className="font-semibold">{rec.asset}</span>
        </div>
        {rec.riskPct && <span className="text-xs text-muted-foreground">{lang === "ar" ? "مخاطرة" : "Risk"}: {rec.riskPct}</span>}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.rationale}</p>
      {(rec.entry || rec.stopLoss || rec.targets?.length) && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
          <Stat label={lang === "ar" ? "دخول" : "Entry"} value={rec.entry} />
          <Stat label={lang === "ar" ? "وقف" : "Stop"} value={rec.stopLoss} tone="danger" />
          <Stat label={lang === "ar" ? "أهداف" : "Targets"} value={rec.targets?.join(" / ")} tone="success" icon={Target} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value?: string; tone?: "success" | "danger"; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-1.5 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 inline-flex items-center gap-1 font-medium", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {Icon && <Icon className="h-3 w-3" />}
        {value || "—"}
      </div>
    </div>
  );
}

function PlanCard({ icon: Icon, title, body, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; tone: "success" | "primary" }) {
  return (
    <div className="rounded-2xl border border-border gradient-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg ring-1",
          tone === "success" ? "bg-success/10 text-success ring-success/30" : "bg-primary/10 text-primary ring-primary/30")}>
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="font-display text-base font-bold">{title}</h4>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}
