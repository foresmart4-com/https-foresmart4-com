import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AssetDataMode } from "@/lib/assets.functions";

const STYLES: Record<AssetDataMode, string> = {
  live: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  delayed: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  manual: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  mock: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

const LABEL_AR: Record<AssetDataMode, string> = {
  live: "حي", delayed: "متأخر", manual: "يدوي", mock: "تجريبي",
};

const HINT_AR: Record<AssetDataMode, string> = {
  live: "سعر حي مباشر من المزود",
  delayed: "سعر متأخر بضع دقائق",
  manual: "السعر مُدخل يدوياً ولا يتحدث تلقائياً",
  mock: "بيانات تجريبية للمحاكاة فقط",
};

const HINT_EN: Record<AssetDataMode, string> = {
  live: "Live price from data provider",
  delayed: "Delayed by several minutes",
  manual: "Manually entered price",
  mock: "Mock data for simulation",
};

export function DataModeBadge({ mode, ar = true, className }: { mode: AssetDataMode; ar?: boolean; className?: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("text-[10px] font-medium", STYLES[mode], className)}>
          {ar ? LABEL_AR[mode] : mode.toUpperCase()}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {ar ? HINT_AR[mode] : HINT_EN[mode]}
      </TooltipContent>
    </Tooltip>
  );
}
