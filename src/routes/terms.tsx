import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ForeSmart" },
      { name: "description", content: "ForeSmart Terms of Service. AI-powered market analytics and decision-support tools. No financial advice. Trading involves risk." },
      { property: "og:title", content: "Terms of Service — ForeSmart" },
      { property: "og:description", content: "Professional terms covering platform use, autonomous trading, risk, and user responsibility." },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/terms" }],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    titleAr: "غرض المنصة",
    titleEn: "Platform Purpose",
    ar: "تقدّم ForeSmart أدوات تحليل ذكاء اصطناعي ودعم اتخاذ القرار للأسواق المالية العالمية. المنصة ليست وسيطاً مالياً ولا تحتفظ بأموال المستخدمين.",
    en: "ForeSmart provides AI-powered analytical tooling and decision-support intelligence for global financial markets. The platform is not a broker and does not custody user funds.",
  },
  {
    titleAr: "ليست نصيحة مالية",
    titleEn: "No Financial Advice",
    ar: "جميع المخرجات والإشارات والرؤى تُقدَّم لأغراض معلوماتية فقط، ولا تُعتبر نصيحة استثمارية أو مالية أو قانونية أو ضريبية. لا توجد ضمانات للأرباح.",
    en: "All outputs, signals, and insights are provided for informational purposes only and do not constitute investment, financial, legal, or tax advice. No profit guarantees are made or implied.",
  },
  {
    titleAr: "إفصاح المخاطر",
    titleEn: "Risk Disclosure",
    ar: "ينطوي التداول في الأسواق المالية والعملات الرقمية على مخاطر كبيرة وقد يؤدي إلى فقدان رأس المال بالكامل. الأداء السابق لا يضمن النتائج المستقبلية. تداول فقط بما يمكنك تحمل خسارته.",
    en: "Trading in financial markets and crypto assets carries substantial risk and can result in the total loss of capital. Past performance does not guarantee future results. Only deploy capital you can afford to lose.",
  },
  {
    titleAr: "مسؤولية المستخدم",
    titleEn: "User Responsibility",
    ar: "يبقى المستخدم المسؤول الوحيد عن جميع قرارات التداول، وإعدادات الحساب، والمفاتيح المستخدمة. يجب مراجعة كل توصية بشكل مستقل قبل التنفيذ.",
    en: "The user remains solely responsible for all trading decisions, account configuration, and API credentials. Every signal should be evaluated independently before any execution.",
  },
  {
    titleAr: "إخلاء التداول الآلي",
    titleEn: "Autonomous Trading Disclaimer",
    ar: "ميزات الأتمتة اختيارية ومتحكَّم بها من المستخدم. التفعيل يتم بإرادة المستخدم وعلى مسؤوليته، مع إعدادات مخاطر ووضع تجريبي افتراضي.",
    en: "Automation features are optional and entirely user-controlled. Enabling them is voluntary and at the user's own risk, with built-in risk limits and TESTNET defaults active by default.",
  },
  {
    titleAr: "أمان مفاتيح API",
    titleEn: "API Key Security Notice",
    ar: "تُخزَّن مفاتيح API للوسطاء كأسرار مشفّرة على الخادم فقط. يوصى بشدة بتعطيل صلاحية السحب وتقييد المفاتيح بصلاحيات التداول فقط.",
    en: "Broker API keys are stored as encrypted secrets on the server only. We strongly recommend disabling withdrawal permissions and restricting keys to trading scope only.",
  },
  {
    titleAr: "الاشتراك والفوترة",
    titleEn: "Subscription & Billing",
    ar: "تتم الفوترة عبر مزود مدفوعات مرخّص. تُجدَّد الاشتراكات تلقائياً ما لم يتم إلغاؤها قبل نهاية الفترة. تخضع المبالغ المسترَدة لسياسة الاسترداد المعمول بها.",
    en: "Billing is processed by a licensed third-party payment provider. Subscriptions renew automatically unless cancelled before period end. Refunds are subject to the prevailing refund policy.",
  },
  {
    titleAr: "حدود المسؤولية",
    titleEn: "Limitation of Liability",
    ar: "إلى أقصى حد يسمح به القانون، لا تتحمّل ForeSmart أي مسؤولية عن أي خسارة مباشرة أو غير مباشرة أو تبعية ناتجة عن استخدام المنصة أو الاعتماد على مخرجاتها.",
    en: "To the maximum extent permitted by law, ForeSmart shall not be liable for any direct, indirect, incidental, or consequential losses arising from use of, or reliance on, the platform's outputs.",
  },
  {
    titleAr: "توفر المنصة",
    titleEn: "Platform Availability",
    ar: "نسعى لتقديم خدمة موثوقة، لكن لا نضمن توفراً متواصلاً 100%. قد تحدث صيانة مجدولة أو انقطاعات في خدمات الطرف الثالث (الأسواق، الوسطاء، مزودي البيانات).",
    en: "We strive for high reliability but do not guarantee 100% uninterrupted availability. Scheduled maintenance or outages in third-party services (markets, brokers, data providers) may occur.",
  },
  {
    titleAr: "الاستخدامات المحظورة",
    titleEn: "Prohibited Use",
    ar: "يُحظر استخدام المنصة لأي نشاط غير قانوني أو احتيالي، أو لمحاولة اختراق الأنظمة، أو إساءة استخدام واجهات API، أو إعادة بيع البيانات دون إذن خطي.",
    en: "Using the platform for any unlawful or fraudulent activity, attempting to compromise systems, abusing API endpoints, or reselling data without written authorization is strictly prohibited.",
  },
  {
    titleAr: "تعديلات الشروط",
    titleEn: "Changes to Terms",
    ar: "قد نقوم بتحديث هذه الشروط من وقت لآخر. يستمر الاستخدام بعد التحديث في تأكيد القبول. سيتم إشعار المستخدمين بالتغييرات الجوهرية.",
    en: "These terms may be updated from time to time. Continued use after updates constitutes acceptance. Material changes will be communicated to users.",
  },
  {
    titleAr: "التواصل",
    titleEn: "Contact Information",
    ar: "للاستفسارات القانونية أو الدعم، يُرجى التواصل عبر البريد الإلكتروني للدعم المتاح داخل لوحة التحكم.",
    en: "For legal inquiries or support, please contact us via the support email available inside your dashboard.",
  },
];

function TermsPage() {
  return (
    <LegalPageShell
      titleAr="الشروط والأحكام"
      titleEn="Terms of Service"
      subtitleAr="الشروط القانونية التي تحكم استخدام منصة ForeSmart للذكاء الاصطناعي المؤسسي."
      subtitleEn="The legal terms governing your use of the ForeSmart institutional AI intelligence platform."
      badgeAr="آخر تحديث: 2026"
      badgeEn="Last updated: 2026"
    >
      {(lang) => (
        <>
          {SECTIONS.map((s, i) => (
            <LegalSection key={s.titleEn} number={i + 1} titleAr={s.titleAr} titleEn={s.titleEn} lang={lang}>
              <p>{lang === "ar" ? s.ar : s.en}</p>
            </LegalSection>
          ))}
        </>
      )}
    </LegalPageShell>
  );
}
