import { createFileRoute } from "@tanstack/react-router";
import { GlobalIntelPanel } from "@/components/dashboard/GlobalIntelPanel";
import { GdeltIntelPanel } from "@/components/dashboard/GdeltIntelPanel";

export const Route = createFileRoute("/_app/global-intel")({
  component: GlobalIntelPage,
  head: () => ({
    meta: [
      { title: "Global Intelligence — ForeSmart" },
      { name: "description", content: "Global geopolitical and macroeconomic intelligence for institutional-grade analysis." },
    ],
  }),
});

function GlobalIntelPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <GlobalIntelPanel />
      <GdeltIntelPanel />
    </div>
  );
}

