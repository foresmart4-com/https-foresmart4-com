import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { microCapitalPlan, type MicroCapitalPlan } from "@/lib/asset-analysis.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Sprout, Target, Calendar, ShieldAlert, CheckCircle2, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/growth-plan")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><GrowthPlanPage /></ErrorBoundary>,
});

const FOCUS_OPTS: { id: "crypto" | "stocks" | "metals" | "fx" | "savings"; ar: string; en: string }[] = [
  { id: "crypto", ar: "العملات الرقمية", en: "Crypto" },
  { id: "stocks", ar: "الأسهم", en: "Stocks" },
  { id: "metals", ar: "الذهب والمعادن", en: "Metals" },
  { id: "fx", ar: "العملات", en: "Forex" },
  { id: "savings", ar: "ادخار/سيولة", en: "Savings" },
];

function GrowthPlanPage() {
  const { lang } = useI18n();
  const [capital, setCapital] = useState(500);
  const [risk, setRisk] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [months, setMonths] = useState(6);
  const [focus, setFocus] = useState<("crypto" | "stocks" | "metals" | "fx" | "savings")[]>(["crypto", "stocks", "metals"]);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<MicroCapitalPlan | null>(null);
  const buildPlan = useServerFn(microCapitalPlan);

  const run = async () => {
    if (capital < 50) {
      toast.error(lang === "ar" ? "الحد الأدنى 50 ريال" : "Minimum 50 SAR");
      return;
    }
    if (focus.length === 0) {
      toast.error(lang === "ar" ? "اختر مجالاً واحداً على الأقل" : "Pick at least one focus");
      return;
    }
    setBusy(true); setPlan(null);
    try {
      const res = await buildPlan({
        data: { capitalSar: capital, riskAppetite: risk, monthsHorizon: months, focus, language: lang },
      });
      if (res.error === "rate_limited") toast.error(lang === "ar" ? "تم تجاوز الحد، حاول بعد قليل" : "Rate limited, try again shortly");
      else if (res.error === "payment_required") toast.error(lang === "ar" ? "أضف رصيداً في Lovable AI" : "Add Lovable AI credits");
      else if (res.error || !res.plan) {
        const detail = (res as any).detail ? ` — ${(res as any).detail}` : "";
        toast.error((lang === "ar" ? "تعذر إنشاء الخطة" : "Failed to build plan") + detail);
      } else {
        setPlan(res.plan);
        toast.success(lang === "ar" ? "تم إعداد خطة محسّنة بالذكاء الاصطناعي" : "AI-refined plan ready");
      }
    } catch (e: any) {
      console.error(e);
      toast.error((lang === "ar" ? "خطأ غير متوقع: " : "Unexpected error: ") + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const toggleFocus = (id: typeof FOCUS_OPTS[number]["id"]) => {
    setFocus((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border gradient-card p-6 shadow-card">
        <div className="absolute -top-16 -end-16 h-48 w-48 rounded-full bg-success/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-success/15 text-success ring-1 ring-success/30">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">
              {lang === "ar" ? "خطة تنمية رأس المال الصغير" : "Micro-Capital Growth Plan"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {lang === "ar"
                ? "خطة عملية مصممة لرؤوس الأموال من 50 إلى 5000 ريال — توزيع، خطوات أسبوعية، وقواعد لإدارة المخاطر."
                : "A practical plan for 50–5000 SAR portfolios — allocations, weekly steps, and risk rules."}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-border gradient-card p-5 shadow-card">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "رأس المال (ريال سعودي)" : "Capital (SAR)"}</Label>
            <Input
              type="number"
              min={50}
              max={50000}
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value) || 0)}
            />
            <Slider min={50} max={5000} step={50} value={[Math.min(capital, 5000)]} onValueChange={(v) => setCapital(v[0])} />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>50</span><span>2,500</span><span>5,000+</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{lang === "ar" ? "المدة (شهر)" : "Horizon (months)"}</Label>
            <Slider min={1} max={24} step={1} value={[months]} onValueChange={(v) => setMonths(v[0])} />
            <div className="text-sm text-muted-foreground">{months} {lang === "ar" ? "شهر" : "months"}</div>
          </div>

          <div className="space-y-2">
            <Label>{lang === "ar" ? "تقبّل المخاطرة" : "Risk appetite"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["conservative", "balanced", "aggressive"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    risk === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40",
                  )}
                >
                  {lang === "ar"
                    ? r === "conservative" ? "محافظ" : r === "balanced" ? "متوازن" : "هجومي"
                    : r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{lang === "ar" ? "مجالات التركيز" : "Focus areas"}</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFocus(f.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    focus.includes(f.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {lang === "ar" ? f.ar : f.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={run} disabled={busy} className="gradient-primary text-primary-foreground shadow-glow">
            {busy
              ? (lang === "ar" ? "يتم بناء الخطة..." : "Building...")
              : (lang === "ar" ? "أنشئ خطتي" : "Generate plan")}
          </Button>
        </div>
      </div>

      {busy && (
        <div className="rounded-2xl border border-border gradient-card p-6 text-sm text-primary shadow-card">
          <Activity className="me-2 inline h-4 w-4 animate-pulse" />
          {lang === "ar" ? "يتم تخصيص خطة مناسبة لرأس مالك..." : "Tailoring your plan..."}
        </div>
      )}

      {plan && <PlanView plan={plan} lang={lang} capital={capital} />}
    </div>
  );
}

function PlanView({ plan, lang, capital }: { plan: MicroCapitalPlan; lang: "ar" | "en"; capital: number }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {lang === "ar" ? "الخلاصة" : "Headline"}
        </div>
        <h2 className="mt-1 font-display text-xl font-bold leading-snug">{plan.headline}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat icon={TrendingUp} label={lang === "ar" ? "هدف شهري" : "Monthly target"} value={plan.monthlyTargetPct} />
          <Stat icon={Calendar} label={lang === "ar" ? "هدف سنوي" : "Yearly target"} value={plan.yearlyTargetPct} />
          <Stat icon={Target} label={lang === "ar" ? "رأس المال" : "Capital"} value={`${capital} SAR`} />
        </div>
      </section>

      {/* Allocations */}
      <section>
        <h3 className="mb-3 font-display text-lg font-bold">{lang === "ar" ? "التوزيع" : "Allocations"}</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {plan.allocations.map((a, i) => (
            <div key={i} className="rounded-xl border border-border gradient-card p-4 shadow-card">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{a.bucket}</div>
                <div className="font-display text-lg font-bold text-primary">{a.pct}</div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.why}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {a.examples.map((e, j) => (
                  <span key={j} className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px]">{e}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly steps */}
      <section>
        <h3 className="mb-3 font-display text-lg font-bold">{lang === "ar" ? "الخطوات الزمنية" : "Step-by-step"}</h3>
        <div className="space-y-2">
          {plan.weeklySteps.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-border gradient-card p-4 shadow-card">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{s.week}</div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    s.risk === "low" && "bg-success/15 text-success",
                    s.risk === "medium" && "bg-warning/15 text-warning",
                    s.risk === "high" && "bg-danger/15 text-danger",
                  )}>{s.risk}</span>
                  <span className="text-xs text-muted-foreground">{s.expectedReturn}</span>
                </div>
                <div className="text-sm font-medium">{s.goal}</div>
                <div className="text-sm text-muted-foreground">{s.action}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules + Warnings + Exits */}
      <section className="grid gap-4 lg:grid-cols-3">
        <RuleCard icon={CheckCircle2} title={lang === "ar" ? "قواعد ذهبية" : "Golden rules"} items={plan.rules} tone="success" />
        <RuleCard icon={AlertTriangle} title={lang === "ar" ? "تحذيرات" : "Warnings"} items={plan.warnings} tone="warning" />
        <RuleCard icon={ShieldAlert} title={lang === "ar" ? "متى تخرج" : "Exit conditions"} items={plan.exitConditions} tone="danger" />
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function RuleCard({ icon: Icon, title, items, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; items: string[]; tone: "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "border-success/30 bg-success/5 text-success" : tone === "warning" ? "border-warning/30 bg-warning/5 text-warning" : "border-danger/30 bg-danger/5 text-danger";
  return (
    <div className={cn("rounded-2xl border p-4", cls)}>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="h-4 w-4" />{title}
      </div>
      <ul className="ms-4 space-y-1 text-sm text-foreground/90">
        {items.map((it, i) => <li key={i} className="list-disc">{it}</li>)}
      </ul>
    </div>
  );
}
