import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import {
  Brain, LineChart, Activity, Sparkles, ShieldCheck, Bot,
  Briefcase, Crosshair, Eye, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — ForeSmart" },
      { name: "description", content: "AI-powered financial analytics and educational market intelligence: signals, smart alerts, portfolio tracking, simulations and AI recommendations. No brokerage or investment management." },
      { property: "og:title", content: "Services — ForeSmart" },
      { property: "og:description", content: "AI market analytics, smart alerts, portfolio tracking, educational simulations — analytics SaaS, not a broker." },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/services" }],
  }),
  component: ServicesPage,
});

interface Service {
  icon: LucideIcon;
  titleAr: string; titleEn: string;
  ar: string; en: string;
  pointsAr: string[]; pointsEn: string[];
}

const SERVICES: Service[] = [
  {
    icon: Brain,
    titleAr: "ذكاء السوق بالذكاء الاصطناعي",
    titleEn: "AI Market Intelligence",
    ar: "تحليل متعدّد الطبقات للسياق الكلي، الاتجاهات، الأخبار، ودوران رأس المال عبر فئات الأصول.",
    en: "Multi-layer analysis of macro context, regimes, news, and capital rotation across asset classes.",
    pointsAr: ["تحليل احتمالي وليس تأكيدي", "سياق متعدد الأصول", "ربط الأخبار بالحركة"],
    pointsEn: ["Probabilistic, never deterministic", "Cross-asset context", "News ↔ price linkage"],
  },
  {
    icon: LineChart,
    titleAr: "التحليل الكمّي",
    titleEn: "Quantitative Analysis",
    ar: "محركات كمّية متعددة الإطارات الزمنية: كشف الأنظمة، قياس الثقة، وتقييم الجودة المؤسسية للإشارات.",
    en: "Multi-timeframe quantitative engines: regime detection, confidence scoring, and institutional signal-quality grading.",
    pointsAr: ["كشف نظام السوق", "محرك ثقة موزون", "تقييم جودة الإشارة"],
    pointsEn: ["Regime detection", "Weighted confidence engine", "Signal-quality scoring"],
  },
  {
    icon: Activity,
    titleAr: "المراقبة اللحظية",
    titleEn: "Real-Time Market Monitoring",
    ar: "تدفقات بيانات حية للأسهم، العملات الرقمية، الفوركس، المعادن والنفط مع تنبيهات ذكية.",
    en: "Live data streams across stocks, crypto, FX, metals and oil with intelligent alerting.",
    pointsAr: ["تدفقات لحظية", "تنبيهات ذكية", "مؤشرات حرارة"],
    pointsEn: ["Live streams", "Smart alerts", "Heatmap intelligence"],
  },
  {
    icon: Sparkles,
    titleAr: "كشف الفرص بالذكاء الاصطناعي",
    titleEn: "AI Opportunity Detection",
    ar: "مسح مستمر للفرص بناءً على الزخم المبكر، السيولة، نشاط الحيتان وكسور النطاق.",
    en: "Continuous opportunity scanning driven by early momentum, liquidity flow, whale activity and breakout dynamics.",
    pointsAr: ["زخم مبكر", "تدفق السيولة", "تتبع الحيتان"],
    pointsEn: ["Early momentum", "Liquidity flow", "Whale tracking"],
  },
  {
    icon: ShieldCheck,
    titleAr: "أنظمة إدارة المخاطر",
    titleEn: "Risk Management Systems",
    ar: "محرك مخاطر عالمي بحدود يومية، حدود انكشاف، وإيقاف تلقائي عند تجاوز التقلبات أو الخسائر.",
    en: "Global risk engine with daily limits, exposure caps, and automatic shutdown on volatility or loss breaches.",
    pointsAr: ["حدود انكشاف", "حماية رأس المال", "إيقاف طارئ"],
    pointsEn: ["Exposure caps", "Capital preservation", "Emergency shutdown"],
  },
  {
    icon: Bot,
    titleAr: "محاكاة تداول تعليمية",
    titleEn: "Educational Trading Simulations",
    ar: "بيئة محاكاة افتراضية لاختبار الاستراتيجيات والتعلم — بدون أموال حقيقية وبدون أي تنفيذ فعلي للصفقات.",
    en: "A sandboxed simulation environment for learning and strategy testing — no real money, no live order execution.",
    pointsAr: ["محفظة تجريبية", "بدون تنفيذ حقيقي", "أداة تعليمية"],
    pointsEn: ["Demo portfolio", "No live execution", "Educational tool"],
  },
  {
    icon: Briefcase,
    titleAr: "تتبع المحفظة وتحليلها",
    titleEn: "Portfolio Tracking & Analytics",
    ar: "تحليل ارتباطات، تتبع التوزيع، وقياس الأداء على مستوى المحفظة الشخصية لأغراض تحليلية — لست وسيطاً ولا حافظاً للأصول.",
    en: "Correlation analytics, allocation tracking, and portfolio-level performance metrics for analysis only — we are not a broker or custodian.",
    pointsAr: ["ارتباطات الأصول", "تتبع التوزيع", "مؤشرات تحليلية"],
    pointsEn: ["Asset correlations", "Allocation tracking", "Analytical metrics"],
  },
  {
    icon: Crosshair,
    titleAr: "توصيات تحليلية",
    titleEn: "AI Recommendations",
    ar: "محركات تحلل مناطق الاهتمام والتوقيت والحجم وتقدم توصيات تعليمية — القرار النهائي والتنفيذ يبقى دائماً للمستخدم على منصته الخاصة.",
    en: "Engines that surface interest zones, timing, and sizing as educational recommendations — final decision and execution always remain with the user on their own platform.",
    pointsAr: ["مناطق اهتمام", "توصيات تعليمية", "بدون تنفيذ"],
    pointsEn: ["Interest zones", "Educational recs", "No execution"],
  },
  {
    icon: Eye,
    titleAr: "المراقبة المؤسسية",
    titleEn: "Institutional Monitoring",
    ar: "سجل قرارات بالذكاء الاصطناعي، تدقيق صفقات، مؤشر استقرار النظام، ومركز قيادة للحوادث.",
    en: "AI decision log, trade audit, system stability index, and an incident command center for full transparency.",
    pointsAr: ["سجل قرارات", "تدقيق صفقات", "مؤشر استقرار"],
    pointsEn: ["Decision log", "Trade audit", "Stability index"],
  },
  {
    icon: Lock,
    titleAr: "الأمان والحماية",
    titleEn: "Security & Protection",
    ar: "خزنة مفاتيح مشفّرة، تحديد معدّل الطلبات، مراقبة تهديدات لحظية، وأدوات إيقاف طارئة متعددة المستويات.",
    en: "Encrypted key vault, rate limiting, real-time threat monitoring, and multi-layer emergency stop controls.",
    pointsAr: ["خزنة مشفّرة", "مراقبة تهديدات", "إيقاف متعدد المستويات"],
    pointsEn: ["Encrypted vault", "Threat monitor", "Multi-tier kill-switch"],
  },
];

function ServicesPage() {
  return (
    <LegalPageShell
      titleAr="الخدمات"
      titleEn="Services"
      subtitleAr="طبقات ذكاء اصطناعي مؤسسي مصمّمة للوضوح، الانضباط، وحماية رأس المال."
      subtitleEn="Institutional AI intelligence layers — engineered for clarity, discipline, and capital protection."
      badgeAr="منصة ذكاء اصطناعي مؤسسية"
      badgeEn="Institutional AI Platform"
    >
      {(lang) => (
        <div className="grid gap-5 md:grid-cols-2">
          {SERVICES.map((s, i) => (
            <LegalSection key={s.titleEn} number={i + 1} titleAr={s.titleAr} titleEn={s.titleEn} lang={lang}>
              <div className="-mt-1 mb-3 flex items-center gap-2">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <p>{lang === "ar" ? s.ar : s.en}</p>
              <ul className="mt-3 space-y-1.5">
                {(lang === "ar" ? s.pointsAr : s.pointsEn).map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </LegalSection>
          ))}
        </div>
      )}
    </LegalPageShell>
  );
}
