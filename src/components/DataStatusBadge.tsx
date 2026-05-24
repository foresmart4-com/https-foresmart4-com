import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Wifi, FlaskConical, Hammer, Plug, Hourglass, ShieldCheck , Activity } from "lucide-react";

export type DataStatus =
  | "live"
  | "mock"
  | "simulation"
  | "manual_review"
  | "not_connected"
  | "ready_later";

const META: Record<DataStatus, { Icon: any; ar: string; en: string; cls: string }> = {
  live:          { Icon: Wifi,         ar: "مباشر",        en: "Live",          cls: "border-success/40 text-success bg-success/5" },
  mock:          { Icon: FlaskConical, ar: "تجريبي",       en: "Mock",          cls: "border-warning/40 text-warning bg-warning/5" },
  simulation:    { Icon: Hammer,       ar: "محاكاة",       en: "Simulation",    cls: "border-warning/40 text-warning bg-warning/5" },
  manual_review: { Icon: ShieldCheck,  ar: "مراجعة يدوية", en: "Manual Review", cls: "border-primary/40 text-primary bg-primary/5" },
  not_connected: { Icon: Plug,         ar: "غير متصل",     en: "Not Connected", cls: "border-danger/40 text-danger bg-danger/5" },
  ready_later:   { Icon: Hourglass,    ar: "جاهز لاحقاً",  en: "Ready Later",   cls: "border-muted-foreground/40 text-muted-foreground bg-muted/20" },
};

export function DataStatusBadge({ status, className }: { status: DataStatus; className?: string }) {
  const { lang } = useI18n();
  const m = META[status];
  const Icon = m?.Icon ?? Activity;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] font-semibold", m.cls, className)}>
      <Icon className="h-3 w-3" />
      {lang === "ar" ? m.ar : m.en}
    </Badge>
  );
}
