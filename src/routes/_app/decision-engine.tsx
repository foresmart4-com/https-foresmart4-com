import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useMarketIntel } from "@/hooks/useMarketIntel";
import { useDecisionEngine } from "@/hooks/useDecisionEngine";
import { DecisionEnginePanel } from "@/components/dashboard/DecisionEnginePanel";

export const Route = createFileRoute("/_app/decision-engine")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><DecisionEnginePage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Decision Engine — ForeSmart" },
      { name: "description", content: "Institutional multi-agent decision engine: consensus, calibration, scenarios, lifecycle and explainability." },
    ],
  }),
});

function DecisionEnginePage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data } = useMarketIntel(undefined, 30_000);
  const { packet, stats, audit, status, refresh } = useDecisionEngine(data, ar ? "ar" : "en");

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <DecisionEnginePanel
        packet={packet}
        stats={stats}
        audit={audit}
        status={status}
        onRefresh={() => refresh()}
        ar={ar}
      />
    </div>
  );
}
