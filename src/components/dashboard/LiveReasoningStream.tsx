import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketQuote } from "@/services/market/marketData";
import {
  buildReasoningEvents, mergeReasoningBuffer,
  type ReasoningEvent, type ReasoningSeverity, type ReasoningCategory,
} from "@/services/reasoning/liveReasoningStream";
import {
  Activity, AlertTriangle, ArrowUpDown, Brain, Droplet,
  Gauge, GitBranch, Globe2, Pause, Play, Sparkles, Zap,
} from "lucide-react";

interface Props {
  quotes: MarketQuote[];
  ar?: boolean;
  className?: string;
}

const CAT_ICON: Record<ReasoningCategory, typeof Brain> = {
  regime: Globe2,
  momentum: Zap,
  breakout: ArrowUpDown,
  exhaustion: Gauge,
  divergence: GitBranch,
  liquidity: Droplet,
  macro: Sparkles,
  conviction: Brain,
};

const CAT_LABEL: Record<ReasoningCategory, { en: string; ar: string }> = {
  regime:      { en: "Regime",      ar: "النظام" },
  momentum:    { en: "Momentum",    ar: "الزخم" },
  breakout:    { en: "Breakout",    ar: "اختراق" },
  exhaustion:  { en: "Exhaustion",  ar: "تشبع" },
  divergence:  { en: "Divergence",  ar: "تباين" },
  liquidity:   { en: "Liquidity",   ar: "السيولة" },
  macro:       { en: "Macro",       ar: "ماكرو" },
  conviction:  { en: "Conviction",  ar: "قناعة" },
};

const SEV_TONE: Record<ReasoningSeverity, string> = {
  info:     "border-sky-500/30 bg-sky-500/5 text-sky-300",
  watch:    "border-amber-500/30 bg-amber-500/5 text-amber-300",
  alert:    "border-orange-500/40 bg-orange-500/10 text-orange-300",
  critical: "border-danger/50 bg-danger/10 text-danger",
};

function timeAgo(ts: number, ar?: boolean) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return ar ? `قبل ${s} ث` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return ar ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  return ar ? `قبل ${h} س` : `${h}h ago`;
}

function StreamRow({ ev, ar }: { ev: ReasoningEvent; ar?: boolean }) {
  const Icon = CAT_ICON[ev.category];
  const cat = CAT_LABEL[ev.category][ar ? "ar" : "en"];
  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card/40 p-2.5 backdrop-blur-sm transition-all",
        "hover:bg-card/70",
        SEV_TONE[ev.severity],
      )}
    >
      <div className={cn("mt-0.5 shrink-0 rounded-md border border-border/40 bg-background/40 p-1.5")}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="font-bold">{cat}</span>
          {ev.symbol && (
            <span className="rounded border border-border/40 bg-background/50 px-1 py-0 font-mono text-foreground/80" dir="ltr">
              {ev.symbol}
            </span>
          )}
          {ev.severity === "critical" && <AlertTriangle className="h-2.5 w-2.5 text-danger" />}
          <span className="ms-auto tabular-nums text-muted-foreground/80">{timeAgo(ev.ts, ar)}</span>
        </div>
        <p className="mt-1 text-xs leading-snug text-foreground/95">
          {ar ? ev.headlineAr : ev.headlineEn}
        </p>
        {ev.metric && (
          <span className="mt-1 inline-block rounded border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground" dir="ltr">
            {ev.metric}
          </span>
        )}
      </div>
    </div>
  );
}

// Live AI Reasoning Stream — vertically scrolling feed.
export function LiveReasoningStream({ quotes, ar, className }: Props) {
  const [buf, setBuf] = useState<ReasoningEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | ReasoningSeverity>("all");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Refresh derivations whenever quote feed updates
  useEffect(() => {
    if (paused) return;
    const fresh = buildReasoningEvents(quotes);
    if (!fresh.length) return;
    setBuf((prev) => mergeReasoningBuffer(prev, fresh));
  }, [quotes, paused]);

  // Re-render relative timestamps every 15s
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? buf : buf.filter((e) => e.severity === filter)),
    [buf, filter],
  );

  const counts = useMemo(() => {
    const c: Record<ReasoningSeverity, number> = { info: 0, watch: 0, alert: 0, critical: 0 };
    for (const e of buf) c[e.severity]++;
    return c;
  }, [buf]);

  return (
    <div className={cn(
      "rounded-xl border border-border/40 bg-card/40 backdrop-blur-md",
      className,
    )}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
        <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground/90">
          {ar ? "تيار الاستدلال المباشر" : "Live Reasoning Stream"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {ar ? "مشتق من بيانات المحرّك" : "engine-derived"}
        </span>

        <div className="ms-auto flex flex-wrap items-center gap-1">
          {(["all", "alert", "watch", "info"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-md border border-border/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                filter === k ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "all" ? (ar ? "الكل" : "all") : k}
              {k !== "all" && counts[k as ReasoningSeverity] > 0 && (
                <span className="ms-1 tabular-nums">{counts[k as ReasoningSeverity]}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setPaused((p) => !p)}
            className="ms-1 inline-flex items-center gap-1 rounded-md border border-border/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            title={paused ? (ar ? "استئناف" : "Resume") : (ar ? "إيقاف مؤقت" : "Pause")}
          >
            {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            {paused ? (ar ? "إيقاف" : "paused") : (ar ? "مباشر" : "live")}
          </button>
        </div>
      </div>

      {/* Stream body */}
      <div
        ref={containerRef}
        className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto p-2"
      >
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-center text-xs text-muted-foreground">
            {ar
              ? "يرصد المحرّك السوق… ستظهر الملاحظات هنا فور تشكّلها."
              : "Engine watching the tape… observations will appear here as they form."}
          </div>
        ) : (
          filtered.map((ev) => <StreamRow key={ev.id} ev={ev} ar={ar} />)
        )}
      </div>
    </div>
  );
}
