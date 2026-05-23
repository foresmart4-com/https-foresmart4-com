import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalIntelPanel } from "@/components/dashboard/GlobalIntelPanel";
import { GdeltIntelPanel } from "@/components/dashboard/GdeltIntelPanel";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/global-intel")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u0645\u064a"><GlobalIntelPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u2014 ForeSmart" },
    ],
  }),
});

function GlobalIntelPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">{ar ? "\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u0645\u064a" : "Global Intelligence"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ar ? "\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629 \u0648\u0627\u0644\u0623\u062e\u0628\u0627\u0631 \u0627\u0644\u062c\u063a\u0631\u0627\u0641\u064a\u0629 \u0627\u0644\u0633\u064a\u0627\u0633\u064a\u0629" : "Global market analysis and geopolitical news"}</p>
      </div>
      <GlobalIntelPanel />
      <GdeltIntelPanel />
    </div>
  );
}
