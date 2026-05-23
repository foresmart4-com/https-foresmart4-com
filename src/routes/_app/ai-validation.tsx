import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { AIValidationPanel } from "@/components/dashboard/AIValidationPanel";

export const Route = createFileRoute("/_app/ai-validation")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><AIValidationRoute /></ErrorBoundary>,
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
