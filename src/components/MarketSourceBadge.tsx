/**
 * MarketSourceBadge — unified visible label for every displayed market price.
 *
 * Spec:
 *   مباشر   — delayed=false  AND fallbackUsed=false (or source="live")
 *   متأخر   — delayed=true                          (or source="delayed")
 *   احتياطي — fallbackUsed=true but price available
 *   تقديري  — synthetic / simulated / mock
 *   غير متاح — success=false or source="unavailable"
 */
import { cn } from "@/lib/utils";

export type MarketDataMode =
  | "live"
  | "delayed"
  | "fallback"
  | "estimated"
  | "unavailable";

const META: Record<MarketDataMode, { ar: string; en: string; cls: string; dot?: boolean }> = {
  live:        { ar: "مباشر",    en: "Live",        cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", dot: true },
  delayed:     { ar: "متأخر",    en: "Delayed",     cls: "bg-amber-500/15  text-amber-600  border-amber-500/30" },
  fallback:    { ar: "احتياطي",  en: "Backup",      cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  estimated:   { ar: "تقديري",   en: "Estimated",   cls: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  unavailable: { ar: "غير متاح", en: "Unavailable", cls: "bg-muted/30      text-muted-foreground border-border" },
};

interface Props {
  mode: MarketDataMode;
  ar?: boolean;
  className?: string;
  size?: "xs" | "sm";
}

export function MarketSourceBadge({ mode, ar = true, className, size = "xs" }: Props) {
  const m = META[mode] ?? META.unavailable;
  const textCls = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold",
        textCls,
        m.cls,
        className,
      )}
    >
      {m.dot && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {ar ? m.ar : m.en}
    </span>
  );
}

/**
 * Map the `source` string from AssetQuote / StockQuote to a MarketDataMode.
 * AssetQuote.source values: "live" | "delayed" | "simulated" | "unavailable"
 * StockQuote.isLive: true → Yahoo (delayed), false → synthetic
 */
export function assetSourceToMode(
  source: string | undefined,
  fallbackUsed?: boolean,
): MarketDataMode {
  if (!source || source === "unavailable") return "unavailable";
  if (source === "simulated") return "estimated";
  if (source === "delayed") return fallbackUsed ? "fallback" : "delayed";
  if (source === "live") return fallbackUsed ? "fallback" : "live";
  return "delayed";
}

export function stockIsLiveToMode(isLive: boolean | undefined): MarketDataMode {
  if (isLive === false) return "estimated";
  return "delayed";
}
