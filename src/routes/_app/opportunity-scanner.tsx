import { createFileRoute } from "@tanstack/react-router";
import { GlobalOpportunityScanner } from "@/components/dashboard/GlobalOpportunityScanner";

export const Route = createFileRoute("/_app/opportunity-scanner")({
  component: OpportunityScannerRoute,
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
