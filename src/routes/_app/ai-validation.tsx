import { createFileRoute } from "@tanstack/react-router";
import { AIValidationPanel } from "@/components/dashboard/AIValidationPanel";

export const Route = createFileRoute("/_app/ai-validation")({
  component: AIValidationRoute,
  head: () => ({
    meta: [
      { title: "AI Validation — ForeSmart" },
      { name: "description", content: "Institutional AI accuracy, calibration, drift, PnL and model health." },
    ],
  }),
});

function AIValidationRoute() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6 space-y-4">
      <AIValidationPanel />
    </div>
  );
}
