import { createFileRoute } from "@tanstack/react-router";
import { GlobalIntelPanel } from "@/components/dashboard/GlobalIntelPanel";

export const Route = createFileRoute("/_app/global-intel")({
  component: GlobalIntelPage,
});

function GlobalIntelPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <GlobalIntelPanel />
    </div>
  );
}
