import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { GlobalOpportunityScanner } from "@/components/dashboard/GlobalOpportunityScanner";

export const Route = createFileRoute("/_app/opportunity-scanner")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><OpportunityScannerRoute /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Opportunity Scanner — ForeSmart" },
      { name: "description", content: "Autonomous global opportunity scanner across equities, crypto, forex, commodities, macro, geopolitics and weather." },
    ],
  }),
});

function OpportunityScannerRoute() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6 space-y-4">
      <GlobalOpportunityScanner />
    </div>
  );
}
