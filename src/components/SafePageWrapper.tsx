import { type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  title?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  isEmpty?: boolean;
}

function PageLoadingState() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}

function PageErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="container mx-auto max-w-lg p-6">
      <Card className="border-rose-500/30 bg-rose-950/10">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-rose-400" />
          <p className="font-medium text-foreground">تعذر تحميل البيانات</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageEmptyState({ message }: { message: string }) {
  return (
    <div className="container mx-auto max-w-lg p-6">
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SafePageWrapper({ children, title, loading, error, onRetry, emptyMessage, isEmpty }: Props) {
  if (loading) return <PageLoadingState />;
  if (error) return <PageErrorState error={error} onRetry={onRetry} />;
  if (isEmpty && emptyMessage) return <PageEmptyState message={emptyMessage} />;

  return (
    <ErrorBoundary fallbackTitle={title ?? "تعذر تحميل الصفحة"}>
      {children}
    </ErrorBoundary>
  );
}

export { PageLoadingState, PageErrorState, PageEmptyState };
