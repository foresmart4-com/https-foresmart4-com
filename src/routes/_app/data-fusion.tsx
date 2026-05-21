import { createFileRoute } from "@tanstack/react-router";
import { DataFusionPanel } from "@/components/dashboard/DataFusionPanel";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/data-fusion")({
  component: DataFusionRoute,
  head: () => ({
    meta: [
      { title: "Data Fusion — ForeSmart" },
      { name: "description", content: "Cross-provider price consensus, failover routing, and regime classification." },
    ],
  }),
});

function DataFusionRoute() {
  const { isAdmin, canAccess } = useAccess();
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  if (!canAccess && !isAdmin) return <AccessGate>{null}</AccessGate>;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6" dir={dir}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{ar ? "ما فائدة دمج البيانات؟" : "What is Data Fusion?"}</CardTitle>
          <Badge variant="outline">{ar ? "محرّك دمج المزودين" : "Provider fusion engine"}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {ar
            ? "نقرأ السعر من عدّة مزودين (Finnhub، TwelveData، AlphaVantage، CoinGecko)، نقارن الفروق، نختار المصدر المعتمد بالأغلبية، ونحوّل تلقائياً عند فشل أيّ مزود."
            : "We read the price from multiple providers (Finnhub, TwelveData, AlphaVantage, CoinGecko), compare the spread, pick a consensus source, and fail over automatically when a provider degrades."}
        </CardContent>
      </Card>
      <ErrorBoundary fallbackTitle={ar ? "تعذّر تحميل لوحة دمج البيانات" : "Data Fusion panel failed to load"}>
        <DataFusionPanel />
      </ErrorBoundary>
    </div>
  );
}
