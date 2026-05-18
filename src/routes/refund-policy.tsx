import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — ForeSmart" },
      { name: "description", content: "ForeSmart refund policy and subscription terms." },
      { property: "og:title", content: "Refund Policy — ForeSmart" },
      { property: "og:description", content: "ForeSmart refund policy and subscription terms." },
      { property: "og:url", content: "https://foresmart4.store/refund-policy" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/refund-policy" }],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalPageShell
      titleAr="سياسة الاسترداد"
      titleEn="Refund Policy"
      subtitleAr="آخر تحديث: 2026"
      subtitleEn="Last updated: 2026"
      badgeAr="سياسات وضوابط"
      badgeEn="Policies & Controls"
    >
      {(lang) => (
        <>
          <LegalSection
            number={1}
            lang={lang}
            titleAr="سياسة استرداد الاشتراكات"
            titleEn="Subscription Refund Policy"
          >
            <p>
              {lang === "ar"
                ? "جميع الاشتراكات الرقمية غير قابلة للاسترداد بعد التفعيل."
                : "All digital subscriptions are non-refundable once activated."}
            </p>
            <p>
              {lang === "ar"
                ? "يمكن للمستخدم إلغاء التجديد التلقائي في أي وقت."
                : "Users may cancel auto-renewal at any time."}
            </p>
            <p>
              {lang === "ar"
                ? "يستمر الوصول للخدمة حتى نهاية مدة الاشتراك الحالية."
                : "Service access continues until the end of the current billing period."}
            </p>
          </LegalSection>

          <LegalSection
            number={2}
            lang={lang}
            titleAr="التجربة والاختبار"
            titleEn="Trial & Evaluation"
          >
            <p>
              {lang === "ar"
                ? "يُنصح المستخدمون بتجربة المنصة قبل الاشتراك طويل المدى."
                : "Users are encouraged to evaluate the platform before committing to a long-term subscription."}
            </p>
            <p>
              {lang === "ar"
                ? "المنصة تقدم أدوات تحليلية وذكاء اصطناعي لأغراض معلوماتية فقط."
                : "The platform provides analytical tools and AI for informational purposes only."}
            </p>
            <p>
              {lang === "ar"
                ? "لا يوجد ضمان للأرباح أو النتائج الاستثمارية."
                : "There is no guarantee of profits or investment returns."}
            </p>
          </LegalSection>

          <LegalSection
            number={3}
            lang={lang}
            titleAr="حالات الاسترداد الاستثنائية"
            titleEn="Exceptional Refund Cases"
          >
            <p>
              {lang === "ar"
                ? "قد يتم النظر في الاسترداد في الحالات التالية:"
                : "Refunds may be considered in the following cases:"}
            </p>
            <ul className="list-disc ps-5 space-y-1">
              <li>
                {lang === "ar" ? "الدفع المكرر" : "Duplicate payment"}
              </li>
              <li>
                {lang === "ar" ? "أخطاء الفوترة التقنية" : "Technical billing errors"}
              </li>
              <li>
                {lang === "ar" ? "الخصومات غير المقصودة" : "Unintended discounts or overcharges"}
              </li>
              <li>
                {lang === "ar"
                  ? "فشل الوصول للخدمة بسبب مشكلة تقنية مباشرة من المنصة"
                  : "Service access failure due to a direct platform technical issue"}
              </li>
            </ul>
          </LegalSection>

          <LegalSection
            number={4}
            lang={lang}
            titleAr="إخلاء مسؤولية خسائر التداول"
            titleEn="Trading Loss Disclaimer"
          >
            <p>
              {lang === "ar"
                ? "خسائر التداول والاستثمار غير قابلة للاسترداد."
                : "Trading and investment losses are not refundable."}
            </p>
            <p>
              {lang === "ar"
                ? "المستخدم يتحمل المسؤولية الكاملة عن قراراته المالية."
                : "The user bears full responsibility for all financial decisions."}
            </p>
            <p>
              {lang === "ar"
                ? "المنصة لا تضمن نتائج مالية أو استثمارية."
                : "The platform does not guarantee any financial or investment outcomes."}
            </p>
          </LegalSection>

          <LegalSection
            number={5}
            lang={lang}
            titleAr="التداول الآلي والذكاء الاصطناعي"
            titleEn="Automated Trading & AI"
          >
            <p>
              {lang === "ar"
                ? "التداول الآلي اختياري وتحت تحكم المستخدم."
                : "Automated trading is optional and fully user-controlled."}
            </p>
            <p>
              {lang === "ar"
                ? "المستخدم مسؤول عن إعدادات المخاطر وربط حسابات التداول."
                : "The user is responsible for risk settings and linking trading accounts."}
            </p>
            <p>
              {lang === "ar"
                ? "لا تضمن المنصة نجاح استراتيجيات الذكاء الاصطناعي."
                : "The platform does not guarantee the success of AI-driven strategies."}
            </p>
          </LegalSection>

          <LegalSection
            number={6}
            lang={lang}
            titleAr="معالجة المدفوعات"
            titleEn="Payment Processing"
          >
            <p>
              {lang === "ar"
                ? "تتم المدفوعات عبر مزودي دفع خارجيين."
                : "Payments are processed through third-party payment providers."}
            </p>
            <p>
              {lang === "ar"
                ? "قد تستغرق عمليات الاسترداد المعتمدة من 5 إلى 10 أيام عمل لظهورها في حسابك."
                : "Approved refunds may take 5–10 business days to appear in your account."}
            </p>
            <p>
              {lang === "ar"
                ? "للاستفسارات حول الفواتير أو الاسترداد، يرجى التواصل مع فريق الدعم."
                : "For billing or refund inquiries, please contact our support team."}
            </p>
          </LegalSection>
        </>
      )}
    </LegalPageShell>
  );
}
