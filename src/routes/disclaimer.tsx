import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LegalPageShell } from "@/components/LegalPageShell";
import { LegalSection } from "@/components/LegalPageShell";

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
  const [lang, setLang] = useState<"en" | "ar">("en");
  const ar = lang === "ar";

  return (
    <LegalPageShell
      title={ar ? "إخلاء المسؤولية" : "Disclaimer"}
      subtitle={
        ar
          ? "منصة ForeSmart للتحليلات الذكية ومعلومات السوق التعليمية فقط."
          : "ForeSmart is an AI analytics and market intelligence platform for educational use only."
      }
      lang={lang}
      onToggleLang={() => setLang(ar ? "en" : "ar")}
    >
      <LegalSection title={ar ? "ليست نصيحة مالية" : "Not Financial Advice"}>
        {ar
          ? "جميع المحتويات والتحليلات والإشارات والرؤى المقدمة عبر المنصة هي لأغراض تعليمية ومعلوماتية بحتة. لا تُعدّ توصيات استثمارية أو نصيحة مالية مرخصة أو دعوة لشراء أو بيع أي أصل."
          : "All content, analytics, signals and insights provided through the platform are for educational and informational purposes only. They do not constitute investment advice, regulated financial guidance, or a solicitation to buy or sell any asset."}
      </LegalSection>

      <LegalSection title={ar ? "للاستخدام التعليمي فقط" : "Educational Use Only"}>
        {ar
          ? "تهدف المنصة إلى مساعدة المستخدمين على فهم الأسواق والاتجاهات والبيانات باستخدام نماذج ذكاء اصطناعي وأدوات تحليلية. أي قرار يتخذه المستخدم بناءً على هذه المعلومات هو مسؤوليته الكاملة."
          : "The platform is designed to help users understand markets, trends and data using AI models and analytical tools. Any decision a user makes based on this information is their sole responsibility."}
      </LegalSection>

      <LegalSection title={ar ? "منصة تحليلات ورؤى" : "Analytics & Insights Platform"}>
        {ar
          ? "ForeSmart يوفر تحليلات مدعومة بالذكاء الاصطناعي ورؤى تعليمية وأدوات لذكاء السوق وخدمات عضوية فقط. لا تقدم المنصة إدارة استثمارات أو وساطة مالية أو خدمات مالية منظمة."
          : "ForeSmart provides AI-powered analytics, educational insights, market intelligence tools and membership services only. The platform does not offer investment management, brokerage, or regulated financial services."}
      </LegalSection>

      <LegalSection title={ar ? "لا توجد خدمات استثمار منظمة" : "No Regulated Investment Services"}>
        {ar
          ? "لا يُرخص ForeSmart كمستشار استثماري أو وسيط أو مدير أصول في أي ولاية قضائية. لا نضمن أي عوائد أو أرباح، ولا نقدم خدمات إدارة محافظ أو تداول بالنيابة."
          : "ForeSmart is not licensed as an investment adviser, broker, or asset manager in any jurisdiction. We do not guarantee any returns or profits, and we do not provide portfolio management or trading-on-behalf services."}
      </LegalSection>

      <LegalSection title={ar ? "إقرار المستخدم" : "User Acknowledgement"}>
        {ar
          ? "باستخدامك للمنصة فإنك تقرّ وتوافق على أن جميع المعلومات تُقدَّم \"كما هي\"، وأن الأسواق المالية تنطوي على مخاطر، وأنك المسؤول الوحيد عن أي قرار مالي أو تجاري تتخذه."
          : "By using the platform you acknowledge that all information is provided \"as is\", that financial markets carry risk, and that you are solely responsible for any financial or commercial decision you make."}
      </LegalSection>
    </LegalPageShell>
  );
}
