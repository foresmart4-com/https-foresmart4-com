import { createFileRoute } from "@tanstack/react-router";
import { BacktestLabPanel } from "@/components/dashboard/BacktestLabPanel";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";

export const Route = createFileRoute("/_app/backtest-lab")({
  component: BacktestLabRoute,
});

function BacktestLabRoute() {
  const { isAdmin, hasAccess } = useAccess();
  if (!hasAccess && !isAdmin) return <AccessGate />;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <BacktestLabPanel />
    </div>
  );
}
