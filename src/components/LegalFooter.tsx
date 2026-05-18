import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

interface Props {
  variant?: "full" | "inline";
  className?: string;
}

export function LegalFooter({ variant = "full", className = "" }: Props) {
  const { lang } = useI18n();
  const items = [
    { to: "/services" as const, ar: "الخدمات", en: "Services" },
    { to: "/terms" as const, ar: "الشروط والأحكام", en: "Terms" },
    { to: "/privacy" as const, ar: "سياسة الخصوصية", en: "Privacy" },
  ];

  if (variant === "inline") {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${className}`}>
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="hover:text-foreground transition-colors">
            {lang === "ar" ? i.ar : i.en}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <footer className={`border-t border-border/50 bg-card/30 backdrop-blur-sm mt-16 ${className}`}>
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ForeSmart — {lang === "ar" ? "منصة ذكاء اصطناعي مؤسسية" : "Institutional AI Intelligence Platform"}
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {items.map((i) => (
              <Link key={i.to} to={i.to} className="text-muted-foreground hover:text-foreground transition-colors">
                {lang === "ar" ? i.ar : i.en}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
