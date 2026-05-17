import { cn } from "@/lib/utils";

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 75 ? "bg-success" : v >= 55 ? "bg-primary" : v >= 40 ? "bg-warning" : "bg-danger";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted/40", className)}>
      <div className={cn("h-full transition-all duration-700", tone)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function RiskHeat({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 65 ? "from-danger to-warning" : v >= 40 ? "from-warning to-primary" : "from-success to-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted/40", className)}>
      <div className={cn("h-full bg-gradient-to-r transition-all duration-700", tone)} style={{ width: `${v}%` }} />
    </div>
  );
}
