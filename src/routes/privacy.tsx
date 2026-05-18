import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ForeSmart" },
      { name: "description", content: "How ForeSmart collects, encrypts, and protects user data and API keys with financial-grade security." },
      { property: "og:title", content: "Privacy Policy — ForeSmart" },
      { property: "og:description", content: "Encrypted API keys, secure payments, financial-grade data protection." },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/privacy" }],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  {
    titleAr: "جمع البيانات",
    titleEn: "Data Collection",
    ar: "نجمع الحد الأدنى من البيانات اللازمة لتشغيل المنصة: بيانات الحساب، تفضيلات الاستخدام، سجلات النشاط، والإحصاءات الفنية للأداء والأمان.",
    en: "We collect only the data necessary to operate the platform: account information, usage preferences, activity logs, and technical telemetry for performance and security.",
  },
  {
    titleAr: "معلومات الحساب",
    titleEn: "Account Information",
    ar: "تشمل البريد الإلكتروني، الاسم المعروض، ومعرّفات الجلسة. لا نطلب أبداً معلومات بطاقات الائتمان مباشرة — تتم المعالجة عبر مزود مدفوعات مرخّص.",
    en: "Includes email, display name, and session identifiers. We never directly request credit-card details — payments are processed by a licensed third-party provider.",
  },
  {
    titleAr: "معالجة مفاتيح API",
    titleEn: "API Key Handling",
    ar: "تُخزَّن مفاتيح API للوسطاء كأسرار مشفّرة على الخادم فقط. لا تصل المفاتيح أبداً إلى المتصفح، ولا تُسجَّل في السجلات. يوصى بإبقاء صلاحية السحب معطّلة.",
    en: "Broker API keys are stored as encrypted server-side secrets. Keys never reach the browser and are never written to logs. We strongly recommend keeping withdrawal permissions disabled.",
  },
  {
    titleAr: "التشفير والأمان",
    titleEn: "Encryption & Security",
    ar: "تُستخدم خوارزميات تشفير من الفئة المؤسسية أثناء النقل وفي حالة السكون. تخضع الأنظمة لمراقبة أمنية مستمرة وعمليات تدقيق دورية.",
    en: "Institutional-grade encryption is applied both in transit and at rest. Systems are subject to continuous security monitoring and periodic audits.",
  },
  {
    titleAr: "الكوكيز والجلسات",
    titleEn: "Cookies & Sessions",
    ar: "نستخدم الكوكيز والتخزين المحلي لإدارة الجلسات وتفضيلات اللغة. لا نستخدم كوكيز إعلانية لأطراف ثالثة.",
    en: "We use cookies and local storage to manage sessions and language preferences. We do not use third-party advertising cookies.",
  },
  {
    titleAr: "معالجة المدفوعات",
    titleEn: "Payment Processing",
    ar: "تُعالَج جميع المدفوعات بأمان عبر مزودين مرخّصين (Stripe / Moyasar). لا تمر بيانات بطاقتك عبر خوادمنا.",
    en: "All payments are securely processed by licensed providers (Stripe / Moyasar). Your card details never pass through our servers.",
  },
  {
    titleAr: "خدمات الطرف الثالث",
    titleEn: "Third-Party Services",
    ar: "قد نعتمد على مزودي بيانات السوق، بوابات أخبار، وواجهات API للوسطاء. يخضع كل مزود لشروط الخصوصية الخاصة به.",
    en: "We rely on market-data vendors, news APIs, and broker endpoints. Each provider is bound by its own privacy terms.",
  },
  {
    titleAr: "حقوق المستخدم",
    titleEn: "User Rights",
    ar: "للمستخدم الحق في الوصول إلى بياناته، تصحيحها، أو طلب حذفها، وفقاً للأنظمة المعمول بها.",
    en: "Users have the right to access, correct, or request deletion of their personal data, in accordance with applicable regulations.",
  },
  {
    titleAr: "حماية البيانات",
    titleEn: "Data Protection",
    ar: "تطبَّق ضوابط صارمة على الوصول، مع تسجيل كامل للعمليات الحساسة، وفصل واضح بين البيئات.",
    en: "Strict access controls are enforced, with full auditing of sensitive operations and clear environment separation.",
  },
  {
    titleAr: "المراقبة الأمنية",
    titleEn: "Security Monitoring",
    ar: "تعمل أنظمة المراقبة في الوقت الفعلي لاكتشاف السلوك الشاذ، الاستجابة للحوادث، وتفعيل آليات الإيقاف الطارئ تلقائياً عند الحاجة.",
    en: "Real-time monitoring systems detect anomalous behavior, drive incident response, and trigger automated emergency shutdowns when required.",
  },
  {
    titleAr: "التواصل",
    titleEn: "Contact Information",
    ar: "لأي استفسار يتعلق بالخصوصية، يُرجى التواصل من خلال قنوات الدعم داخل المنصة.",
    en: "For any privacy-related inquiry, please use the in-app support channels.",
  },
];

function PrivacyPage() {
  return (
    <LegalPageShell
      titleAr="سياسة الخصوصية"
      titleEn="Privacy Policy"
      subtitleAr="كيف نحمي بياناتك ومفاتيحك بمعايير أمنية مالية مؤسسية."
      subtitleEn="How we protect your data and credentials with financial-grade institutional security."
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
