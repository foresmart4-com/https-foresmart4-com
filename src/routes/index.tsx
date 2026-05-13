import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { InterestForm } from "@/components/InterestForm";
import { TrendingUp, Brain, Bell, Globe2, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ForeSmart — AI Market Intelligence & Investment Signals" },
      { name: "description", content: "AI-driven insights across global stocks, crypto, FX, metals and oil. Smart signals, alerts and a paper-trading wallet to grow your capital." },
      { property: "og:title", content: "ForeSmart — AI Market Intelligence & Investment Signals" },
      { property: "og:description", content: "AI-driven insights across global stocks, crypto, FX, metals and oil. Smart signals, alerts and a paper-trading wallet to grow your capital." },
      { property: "og:url", content: "https://foresmart4.store/" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/" }],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useI18n();

  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-glow">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            <Globe2 className="me-2 h-4 w-4" />
            {lang === "ar" ? "EN" : "AR"}
          </Button>
          <Link to="/auth">
            <Button variant="outline" size="sm">{t("login")}</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6">
        <section className="mx-auto max-w-3xl py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {lang === "ar" ? "مدعوم بالذكاء الاصطناعي" : "Powered by AI"}
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
            <span className="text-gradient">{t("appName")}</span>
            <br />
            <span className="text-foreground">{t("tagline")}</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            {lang === "ar"
              ? "حلّل الأسواق، الأخبار، الجيوسياسة وسلاسل الإمداد. تنبيهات شراء وبيع ذكية لتنمية رأس مالك."
              : "Analyze markets, news, geopolitics and supply chains. Smart buy/sell alerts to grow your capital."}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                {t("signup")}
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">{t("login")}</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-12 md:grid-cols-3">
          {[
            { icon: Brain, title: lang === "ar" ? "ذكاء اصطناعي" : "AI Insights", desc: lang === "ar" ? "نصائح بناءً على بيانات السوق والأخبار" : "Advice from real-time market & news data" },
            { icon: Bell, title: lang === "ar" ? "تنبيهات ذكية" : "Smart Alerts", desc: lang === "ar" ? "اعرف متى تشتري ومتى تبيع" : "Know when to buy and when to sell" },
            { icon: ShieldCheck, title: lang === "ar" ? "بيانات حقيقية" : "Live Data", desc: lang === "ar" ? "عملات، معادن، نفط، عملات رقمية" : "FX, metals, oil, crypto" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl gradient-card border border-border p-6 shadow-card">
              <f.icon className="mb-4 h-8 w-8 text-primary" />
              <h2 className="mb-2 font-display text-lg font-semibold">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        <section id="interest" className="mx-auto max-w-2xl pb-20">
          <InterestForm />
        </section>
      </main>
    </div>
  );
}
