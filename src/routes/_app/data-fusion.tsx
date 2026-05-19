import { createFileRoute } from "@tanstack/react-router";
import { DataFusionPanel } from "@/components/dashboard/DataFusionPanel";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";

export const Route = createFileRoute("/_app/data-fusion")({
  component: DataFusionRoute,
});

function DataFusionRoute() {
  const { isAdmin, canAccess } = useAccess();
  if (!canAccess && !isAdmin) return <AccessGate>{null}</AccessGate>;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <DataFusionPanel />
    </div>
  );
}
