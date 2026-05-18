import { ReactNode, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe2, TrendingUp } from "lucide-react";
import { LegalFooter } from "./LegalFooter";

interface Props {
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  badgeAr?: string;
  badgeEn?: string;
  children: (lang: "ar" | "en") => ReactNode;
}

export function LegalPageShell({ titleAr, titleEn, subtitleAr, subtitleEn, badgeAr, badgeEn, children }: Props) {
  const { lang, setLang } = useI18n();
  // independent toggle for page-level switching without leaving page direction
  const [localLang, setLocalLang] = useState<"ar" | "en">(lang);
  const active = localLang;

  return (
    <div className="min-h-screen bg-background">
      {/* ambient gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40">
        <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 top-2/3 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">ForeSmart</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = active === "ar" ? "en" : "ar";
                setLocalLang(next);
                setLang(next);
              }}
            >
              <Globe2 className="me-2 h-4 w-4" />
              {active === "ar" ? "EN" : "AR"}
            </Button>
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                {active === "ar" ? "الرئيسية" : "Home"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12" dir={active === "ar" ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-4xl">
          {(badgeAr || badgeEn) && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              {active === "ar" ? badgeAr : badgeEn}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
            <span className="text-gradient">{active === "ar" ? titleAr : titleEn}</span>
          </h1>
          {(subtitleAr || subtitleEn) && (
            <p className="mt-4 text-lg text-muted-foreground">
              {active === "ar" ? subtitleAr : subtitleEn}
            </p>
          )}

          <div className="mt-10 space-y-6">{children(active)}</div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

interface SectionProps {
  number?: number;
  titleAr: string;
  titleEn: string;
  lang: "ar" | "en";
  children: ReactNode;
}

export function LegalSection({ number, titleAr, titleEn, lang, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm shadow-card transition-all hover:border-primary/30 hover:shadow-glow md:p-8">
      <div className="mb-4 flex items-center gap-3">
        {number !== undefined && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
            {number}
          </span>
        )}
        <h2 className="font-display text-2xl font-semibold">
          {lang === "ar" ? titleAr : titleEn}
        </h2>
      </div>
      <div className="text-muted-foreground leading-relaxed space-y-3 text-[15px]">
        {children}
      </div>
    </section>
  );
}
