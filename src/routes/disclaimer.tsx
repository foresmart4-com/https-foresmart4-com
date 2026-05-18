import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "Disclaimer — ForeSmart AI Analytics Platform" },
      { name: "description", content: "ForeSmart is an AI analytics and market intelligence platform for educational purposes. Not financial advice and not a regulated investment service." },
      { property: "og:title", content: "Disclaimer — ForeSmart AI Analytics" },
      { property: "og:description", content: "AI analytics, educational insights and market intelligence — not regulated investment services." },
      { property: "og:url", content: "https://foresmart4.store/disclaimer" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/disclaimer" }],
  }),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <LegalPageShell
      titleAr="إخلاء المسؤولية"
      titleEn="Disclaimer"
      subtitleAr="منصة ForeSmart للتحليلات الذكية ومعلومات السوق التعليمية فقط."
      subtitleEn="ForeSmart is an AI analytics and market intelligence platform for educational use only."
      badgeAr="إقرار قانوني"
      badgeEn="Legal notice"
    >
      {(lang) => (
        <>
          <LegalSection number={1} lang={lang} titleAr="ليست نصيحة مالية" titleEn="Not Financial Advice">
            <p>
              {lang === "ar"
                ? "جميع المحتويات والتحليلات والإشارات والرؤى المقدمة عبر المنصة هي لأغراض تعليمية ومعلوماتية بحتة. لا تُعدّ توصيات استثمارية أو نصيحة مالية مرخصة أو دعوة لشراء أو بيع أي أصل."
                : "All content, analytics, signals and insights provided through the platform are for educational and informational purposes only. They do not constitute investment advice, regulated financial guidance, or a solicitation to buy or sell any asset."}
            </p>
          </LegalSection>

          <LegalSection number={2} lang={lang} titleAr="للاستخدام التعليمي فقط" titleEn="Educational Use Only">
            <p>
              {lang === "ar"
                ? "تهدف المنصة إلى مساعدة المستخدمين على فهم الأسواق والاتجاهات والبيانات باستخدام نماذج ذكاء اصطناعي وأدوات تحليلية. أي قرار يتخذه المستخدم بناءً على هذه المعلومات هو مسؤوليته الكاملة."
                : "The platform is designed to help users understand markets, trends and data using AI models and analytical tools. Any decision a user makes based on this information is their sole responsibility."}
            </p>
          </LegalSection>

          <LegalSection number={3} lang={lang} titleAr="منصة تحليلات ورؤى" titleEn="Analytics & Insights Platform">
            <p>
              {lang === "ar"
                ? "يوفر ForeSmart تحليلات مدعومة بالذكاء الاصطناعي ورؤى تعليمية وأدوات لذكاء السوق وخدمات عضوية فقط. لا تقدم المنصة إدارة استثمارات أو وساطة مالية أو خدمات مالية منظمة."
                : "ForeSmart provides AI-powered analytics, educational insights, market intelligence tools and membership services only. The platform does not provide investment management, brokerage, or regulated financial services."}
            </p>
          </LegalSection>

          <LegalSection number={4} lang={lang} titleAr="لا توجد خدمات استثمار منظمة" titleEn="No Regulated Investment Services">
            <p>
              {lang === "ar"
                ? "ForeSmart غير مرخص كمستشار استثماري أو وسيط أو مدير أصول في أي ولاية قضائية. لا نضمن أي عوائد أو أرباح، ولا نقدم خدمات إدارة محافظ أو تداول بالنيابة."
                : "ForeSmart is not licensed as an investment adviser, broker, or asset manager in any jurisdiction. We do not guarantee any returns or profits, and we do not provide portfolio management or trading-on-behalf services."}
            </p>
          </LegalSection>

          <LegalSection number={5} lang={lang} titleAr="إقرار المستخدم" titleEn="User Acknowledgement">
            <p>
              {lang === "ar"
                ? 'باستخدامك للمنصة فإنك تقرّ وتوافق على أن جميع المعلومات تُقدَّم "كما هي"، وأن الأسواق المالية تنطوي على مخاطر، وأنك المسؤول الوحيد عن أي قرار مالي أو تجاري تتخذه.'
                : 'By using the platform you acknowledge that all information is provided "as is", that financial markets carry risk, and that you are solely responsible for any financial or commercial decision you make.'}
            </p>
          </LegalSection>
        </>
      )}
    </LegalPageShell>
  );
}
