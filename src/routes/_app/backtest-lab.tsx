import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BacktestLabPanel } from "@/components/dashboard/BacktestLabPanel";
import { useAccess } from "@/lib/use-access";
import { AccessGate } from "@/components/AccessGate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Database, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/backtest-lab")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><BacktestLabRoute /></ErrorBoundary>,
});

function BacktestLabRoute() {
  const { isAdmin, canAccess } = useAccess();
  if (!canAccess && !isAdmin) return <AccessGate>{null}</AccessGate>;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6" dir="rtl">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span>مختبر المحاكاة يستخدم أرشيف الأسعار التاريخي عند توفره.</span>
            <Badge variant="secondary">Mock عند غياب البيانات</Badge>
          </div>
          <Link to="/market-history" className="inline-flex items-center gap-1 text-primary hover:underline">
            استعرض أرشيف السوق <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
      <BacktestLabPanel />
    </div>
  );
}

