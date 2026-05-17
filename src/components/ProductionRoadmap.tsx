import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { DataStatusBadge, type DataStatus } from "@/components/DataStatusBadge";
import { Rocket, Database, CreditCard, LineChart, Briefcase, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Phase = {
  id: string;
  Icon: any;
  title_ar: string; title_en: string;
  status: DataStatus;
  required_ar: string[]; required_en: string[];
  risks_ar: string[]; risks_en: string[];
};

const PHASES: Phase[] = [
  {
    id: "backend", Icon: Database,
    title_ar: "المرحلة 1 — Backend وقاعدة البيانات", title_en: "Phase 1 — Backend & Database",
    status: "not_connected",
    required_ar: ["Supabase أو Backend مخصص", "حفظ المستخدمين والمحافظ", "حفظ Journal", "حفظ طلبات الإيداع والسحب"],
    required_en: ["Supabase or custom backend", "Persist users & portfolios", "Persist Journal", "Persist deposit/withdrawal requests"],
    risks_ar: ["RLS غير مضبوط = تسريب بيانات", "غياب backups = فقدان سجلات", "Audit logs ناقصة = فقدان أثر التشغيل"],
    risks_en: ["Missing RLS = data leaks", "No backups = lost records", "Missing audit logs = no trail"],
  },
  {
    id: "payments", Icon: CreditCard,
    title_ar: "المرحلة 2 — تكامل الدفع", title_en: "Phase 2 — Payment Integration",
    status: "not_connected",
    required_ar: ["Stripe أو Moyasar أو PayTabs أو Tap", "Payment Links", "Webhooks", "تحديث حالة الإيداع تلقائيًا"],
    required_en: ["Stripe / Moyasar / PayTabs / Tap", "Payment Links", "Webhooks", "Auto-update deposit status"],
    risks_ar: ["Webhook بدون توقيع = احتيال", "غياب reconciliation = فقد أموال", "تخزين بطاقات = مخالفة PCI"],
    risks_en: ["Unsigned webhook = fraud", "No reconciliation = lost funds", "Storing cards = PCI breach"],
  },
  {
    id: "marketdata", Icon: LineChart,
    title_ar: "المرحلة 3 — مزودي بيانات الأسواق", title_en: "Phase 3 — Market Data Providers",
    status: "mock",
    required_ar: ["CoinGecko (مفعّل)", "Alpha Vantage", "Twelve Data", "Finnhub", "مزود سعودي للأسهم", "News API"],
    required_en: ["CoinGecko (live)", "Alpha Vantage", "Twelve Data", "Finnhub", "Saudi market provider", "News API"],
    risks_ar: ["Rate limits", "تكاليف مفاتيح", "تأخر البيانات", "اعتماد على مصدر واحد"],
    risks_en: ["Rate limits", "Key costs", "Stale data", "Single-source dependence"],
  },
  {
    id: "broker", Icon: Briefcase,
    title_ar: "المرحلة 4 — ربط الوسيط", title_en: "Phase 4 — Broker Integration",
    status: "ready_later",
    required_ar: ["Broker API", "أوامر حقيقية", "مفاتيح آمنة في Secrets", "حدود مخاطر", "Audit Logs", "إيقاف طوارئ إنتاجي"],
    required_en: ["Broker API", "Real orders", "Secrets-stored keys", "Risk limits", "Audit logs", "Production E-Stop"],
    risks_ar: ["تنفيذ خاطئ = خسارة فورية", "تسرّب مفاتيح = استيلاء", "غياب حدود = مخاطر كارثية"],
    risks_en: ["Bad execution = instant loss", "Leaked keys = takeover", "No limits = catastrophic risk"],
  },
];

export function ProductionRoadmap() {
  const { lang } = useI18n();
  return (
    <Card className="gradient-card p-5 shadow-card space-y-4">
      <header className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">{lang === "ar" ? "خارطة طريق الإنتاج" : "Production Roadmap"}</h2>
        <Badge variant="outline" className="text-[10px]">{lang === "ar" ? "تخطيط" : "Plan"}</Badge>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {PHASES.map((p) => {
          const Icon = p.Icon;
          const showDetails = () => {
            const req = (lang === "ar" ? p.required_ar : p.required_en).map((x) => `• ${x}`).join("\n");
            const risks = (lang === "ar" ? p.risks_ar : p.risks_en).map((x) => `⚠ ${x}`).join("\n");
            toast.message(lang === "ar" ? p.title_ar : p.title_en, {
              description: `${lang === "ar" ? "المطلوب:" : "Required:"}\n${req}\n\n${lang === "ar" ? "المخاطر:" : "Risks:"}\n${risks}`,
            });
          };
          return (
            <div key={p.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <div className="font-semibold text-sm flex-1">{lang === "ar" ? p.title_ar : p.title_en}</div>
                <DataStatusBadge status={p.status} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/80">{lang === "ar" ? "المطلوب" : "Required"}:</div>
                <ul className="ms-3 list-disc">
                  {(lang === "ar" ? p.required_ar : p.required_en).slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="text-[11px] flex items-start gap-1 text-warning">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{(lang === "ar" ? p.risks_ar : p.risks_en)[0]}</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={showDetails}>
                {lang === "ar" ? "عرض التفاصيل" : "View details"}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
        {lang === "ar"
          ? "هذه المراحل مستقبلية ولن تتفعّل تلقائيًا. التداول الحقيقي والدفع الحقيقي مغلقان حتى يكتمل ربط Backend وSecrets."
          : "Future phases — not auto-enabled. Real trading and real payments remain disabled until backend & secrets are wired."}
      </p>
    </Card>
  );
}
