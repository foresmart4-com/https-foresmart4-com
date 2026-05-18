import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

interface Props {
  variant?: "full" | "inline";
  className?: string;
}

const DISCLAIMER_EN =
  "ForeSmart provides AI-powered market analytics, educational simulations, and financial insights only. No brokerage, custody, investment management, or real-money trading services are offered.";
const DISCLAIMER_AR =
  "تقدم ForeSmart تحليلات سوق مدعومة بالذكاء الاصطناعي ومحاكاة تعليمية ورؤى مالية فقط. لا نقدم خدمات وساطة أو حفظ أصول أو إدارة استثمارات أو تنفيذ صفقات بأموال حقيقية.";

export function LegalFooter({ variant = "full", className = "" }: Props) {
  const { lang } = useI18n();
  const items = [
    { to: "/services" as const, ar: "الخدمات", en: "Services" },
    { to: "/terms" as const, ar: "الشروط والأحكام", en: "Terms" },
    { to: "/privacy" as const, ar: "سياسة الخصوصية", en: "Privacy" },
    { to: "/disclaimer" as const, ar: "إخلاء المسؤولية", en: "Disclaimer" },
    { to: "/refund-policy" as const, ar: "سياسة الاسترداد", en: "Refund Policy" },
  ];

  if (variant === "inline") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {items.map((i) => (
            <Link key={i.to} to={i.to} className="hover:text-foreground transition-colors">
              {lang === "ar" ? i.ar : i.en}
            </Link>
          ))}
        </div>
        <p className="max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {lang === "ar" ? DISCLAIMER_AR : DISCLAIMER_EN}
        </p>
      </div>
    );
  }

  return (
    <footer className={`border-t border-border/50 bg-card/30 backdrop-blur-sm mt-16 ${className}`}>
      <div className="container mx-auto px-6 py-8 space-y-4">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ForeSmart — {lang === "ar" ? "منصة تحليلات مالية بالذكاء الاصطناعي" : "AI Financial Analytics Platform"}
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {items.map((i) => (
              <Link key={i.to} to={i.to} className="text-muted-foreground hover:text-foreground transition-colors">
                {lang === "ar" ? i.ar : i.en}
              </Link>
            ))}
          </nav>
        </div>
        <p className="border-t border-border/30 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70 max-w-4xl mx-auto">
          {lang === "ar" ? DISCLAIMER_AR : DISCLAIMER_EN}
        </p>
      </div>
    </footer>
  );
}
