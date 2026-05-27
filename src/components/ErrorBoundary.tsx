import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

/**
 * Localized client-side error boundary that surfaces the actual error message
 * (Arabic + English labels) instead of a generic "Something went wrong" screen.
 * Use for panels that may crash on render due to data/provider issues.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep console signal for support; do not exfiltrate to network here.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{this.props.fallbackTitle ?? "حدث خطأ في تحميل هذا القسم / Section failed to load"}</AlertTitle>
          <AlertDescription className="space-y-3">
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background/50 p-2 text-xs">
              {this.state.error.message}
            </pre>
            <Button variant="outline" size="sm" onClick={this.reset} className="gap-2">
              <RefreshCw className="h-3 w-3" />
              إعادة المحاولة / Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}
