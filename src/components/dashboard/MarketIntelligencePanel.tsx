import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, BarChart3, Brain,
  Gauge, Globe2, LineChart, RefreshCw, Sparkles, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scanAll, buildAlerts, optimize, getMacroSnapshot, macroBias, backtestAll,
  type AssetClass, type ScannedAsset,
} from "@/services/intelligence";

interface Props { ar?: boolean }

const T = (en: string, arT: string, ar?: boolean) => (ar ? arT : en);

const CLASS_LABELS: Record<AssetClass, { en: string; ar: string }> = {
  stocks: { en: "Stocks", ar: "أسهم" },
  crypto: { en: "Crypto", ar: "عملات رقمية" },
  gold: { en: "Gold", ar: "ذهب" },
  forex: { en: "Forex", ar: "فوركس" },
  oil: { en: "Oil", ar: "نفط" },
};

const KIND_LABELS: Record<string, { en: string; ar: string }> = {
  breakout: { en: "Breakout", ar: "اختراق" },
  reversal: { en: "Reversal", ar: "انعكاس" },
  high_volatility: { en: "High Volatility", ar: "تذبذب عالٍ" },
  unusual_volume: { en: "Unusual Volume", ar: "حجم غير اعتيادي" },
  momentum_surge: { en: "Momentum", ar: "زخم" },
};

function trendColor(t: ScannedAsset["trend"]) {
  return t === "bullish" ? "text-emerald-400" : t === "bearish" ? "text-rose-400" : "text-amber-400";
}

export function MarketIntelligencePanel({ ar }: Props) {
  const [tick, setTick] = useState(0);
  const [klass, setKlass] = useState<AssetClass | "all">("all");

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const assets = useMemo(() => scanAll(), [tick]);
  const filtered = useMemo(
    () => (klass === "all" ? assets : assets.filter((a) => a.klass === klass)),
    [assets, klass],
  );
  const alerts = useMemo(() => buildAlerts(assets), [assets]);
  const opt = useMemo(() => optimize(assets), [assets]);
  const macro = useMemo(() => getMacroSnapshot(), [tick]);
  const bias = useMemo(() => macroBias(macro), [macro]);
  const backtests = useMemo(() => backtestAll(filtered).slice(0, 8), [filtered]);

  return (
    <Card className="bg-card/40 backdrop-blur border-border/50 p-4 md:p-6 space-y-5" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-semibold">
              {T("AI Market Intelligence Engine", "محرك ذكاء السوق المتقدم", ar)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {T(
                "Scanner • Smart Alerts • Optimization • Macro • Sentiment • Backtest",
                "ماسح • تنبيهات ذكية • تحسين • اقتصاد كلي • مشاعر • اختبار رجعي",
                ar,
              )}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {T("Refresh", "تحديث", ar)}
        </Button>
      </div>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1 w-full bg-muted/30">
          <TabsTrigger value="scanner"><LineChart className="h-3.5 w-3.5 mr-1" />{T("Scanner", "الماسح", ar)}</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-3.5 w-3.5 mr-1" />{T("Alerts", "التنبيهات", ar)}</TabsTrigger>
          <TabsTrigger value="portfolio"><BarChart3 className="h-3.5 w-3.5 mr-1" />{T("Portfolio", "المحفظة", ar)}</TabsTrigger>
          <TabsTrigger value="macro"><Globe2 className="h-3.5 w-3.5 mr-1" />{T("Macro", "اقتصاد كلي", ar)}</TabsTrigger>
          <TabsTrigger value="backtest"><Gauge className="h-3.5 w-3.5 mr-1" />{T("Backtest", "اختبار رجعي", ar)}</TabsTrigger>
        </TabsList>

        {/* Scanner */}
        <TabsContent value="scanner" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "stocks", "crypto", "gold", "forex", "oil"] as const).map((k) => (
              <Button key={k} size="sm" variant={klass === k ? "default" : "outline"}
                onClick={() => setKlass(k)} className="text-xs">
                {k === "all" ? T("All", "الكل", ar) : T(CLASS_LABELS[k].en, CLASS_LABELS[k].ar, ar)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((a) => (
              <div key={a.symbol} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {T(CLASS_LABELS[a.klass].en, CLASS_LABELS[a.klass].ar, ar)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{a.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{a.price.toLocaleString()}</div>
                    <div className={cn("text-xs flex items-center justify-end gap-0.5",
                      a.changePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {a.changePct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(a.changePct)}%
                    </div>
                  </div>
                </div>
                <div className="h-12 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={a.series.slice(-40).map((v, i) => ({ i, v }))}>
                      <defs>
                        <linearGradient id={`g-${a.symbol}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#g-${a.symbol})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Metric label={T("Trend", "الاتجاه", ar)} value={a.trend} className={trendColor(a.trend)} />
                  <Metric label="RSI" value={a.rsi.toString()} />
                  <Metric label="MACD" value={a.macd.hist.toFixed(3)}
                    className={a.macd.hist >= 0 ? "text-emerald-400" : "text-rose-400"} />
                  <Metric label={T("Vol", "تذبذب", ar)} value={`${a.volatility}%`} />
                  <Metric label={T("Mom", "زخم", ar)} value={`${a.momentum}%`} />
                  <Metric label={T("Vol×", "حجم", ar)} value={`${a.volumeSpike}×`}
                    className={a.volumeSpike >= 1.8 ? "text-amber-400" : ""} />
                  <Metric label={T("Support", "دعم", ar)} value={a.support.toString()} />
                  <Metric label={T("Resist.", "مقاومة", ar)} value={a.resistance.toString()} />
                  <Metric label={T("Sent.", "مشاعر", ar)} value={a.sentiment.toString()}
                    className={a.sentiment >= 0 ? "text-emerald-400" : "text-rose-400"} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">{T("Confidence", "الثقة", ar)}</span>
                  <Progress value={a.confidence} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-mono">{a.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts" className="mt-4 space-y-2">
          {alerts.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              {T("No active alerts", "لا توجد تنبيهات نشطة", ar)}
            </div>
          )}
          {alerts.map((al) => (
            <div key={al.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-background/30">
              <div className={cn("h-8 w-8 rounded-md flex items-center justify-center",
                al.severity === "high" ? "bg-rose-500/15 text-rose-400" :
                al.severity === "medium" ? "bg-amber-500/15 text-amber-400" : "bg-muted text-muted-foreground")}>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{al.symbol}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {T(KIND_LABELS[al.kind].en, KIND_LABELS[al.kind].ar, ar)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{al.message}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono">{al.confidence}%</div>
                <div className="text-[10px] text-muted-foreground">{T("conf.", "ثقة", ar)}</div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Portfolio */}
        <TabsContent value="portfolio" className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={T("Diversification", "تنويع", ar)} value={`${opt.diversificationScore}/100`} icon={Sparkles} />
            <Stat label={T("Risk Score", "درجة المخاطرة", ar)} value={`${opt.riskScore}/100`} icon={Activity} tone="warn" />
            <Stat label={T("Expected Return", "العائد المتوقع", ar)} value={`${opt.expectedReturnPct}%`} icon={TrendingUp}
              tone={opt.expectedReturnPct >= 0 ? "good" : "bad"} />
          </div>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">{T("Asset", "الأصل", ar)}</th>
                  <th className="p-2">{T("Class", "الفئة", ar)}</th>
                  <th className="p-2">{T("Weight", "الوزن", ar)}</th>
                  <th className="p-2">{T("Action", "إجراء", ar)}</th>
                  <th className="p-2 hidden md:table-cell">{T("Rationale", "المبرر", ar)}</th>
                </tr>
              </thead>
              <tbody>
                {opt.allocations.map((a, i) => {
                  const rb = opt.rebalance[i];
                  return (
                    <tr key={a.symbol} className="border-t border-border/40">
                      <td className="p-2 font-medium">{a.symbol}</td>
                      <td className="p-2 text-muted-foreground">{T(CLASS_LABELS[a.klass].en, CLASS_LABELS[a.klass].ar, ar)}</td>
                      <td className="p-2 font-mono">{(a.weight * 100).toFixed(1)}%</td>
                      <td className="p-2">
                        <Badge variant="outline" className={cn("text-[10px]",
                          rb.action === "buy" ? "border-emerald-500/40 text-emerald-400" :
                          rb.action === "sell" ? "border-rose-500/40 text-rose-400" : "")}>
                          {rb.action.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground hidden md:table-cell">{a.rationale}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Macro */}
        <TabsContent value="macro" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{T("Macro bias:", "التحيز الكلي:", ar)}</span>
            <Badge className={cn(bias > 0 ? "bg-emerald-500/20 text-emerald-300" :
              bias < 0 ? "bg-rose-500/20 text-rose-300" : "bg-muted text-muted-foreground")}>
              {bias > 0 ? T("Risk-on", "إقبال على المخاطرة", ar) :
               bias < 0 ? T("Risk-off", "تجنب المخاطرة", ar) :
               T("Neutral", "محايد", ar)} ({bias > 0 ? "+" : ""}{bias})
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {macro.map((m) => (
              <div key={m.key} className="rounded-lg border border-border/40 bg-background/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">{T(m.label, m.labelAr, ar)}</div>
                  <Badge variant="outline" className={cn("text-[10px]",
                    m.impact === "bullish" ? "border-emerald-500/40 text-emerald-400" :
                    m.impact === "bearish" ? "border-rose-500/40 text-rose-400" : "")}>
                    {m.impact}
                  </Badge>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-semibold">{m.value}{m.unit}</span>
                  <span className={cn("text-xs", m.changePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {m.changePct >= 0 ? "+" : ""}{m.changePct}%
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{T(m.note, m.noteAr, ar)}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Backtest */}
        <TabsContent value="backtest" className="mt-4">
          <div className="rounded-lg border border-border/40 overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="p-2">{T("Symbol", "الرمز", ar)}</th>
                  <th className="p-2">{T("Trades", "صفقات", ar)}</th>
                  <th className="p-2">{T("Win rate", "نسبة الربح", ar)}</th>
                  <th className="p-2">{T("Return", "العائد", ar)}</th>
                  <th className="p-2">{T("Max DD", "أقصى تراجع", ar)}</th>
                  <th className="p-2">Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {backtests.map((b) => (
                  <tr key={b.symbol} className="border-t border-border/40">
                    <td className="p-2 font-medium">{b.symbol}</td>
                    <td className="p-2 font-mono">{b.trades}</td>
                    <td className="p-2 font-mono">{b.winRate}%</td>
                    <td className={cn("p-2 font-mono", b.totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {b.totalReturnPct}%
                    </td>
                    <td className="p-2 font-mono text-rose-400">{b.maxDrawdownPct}%</td>
                    <td className="p-2 font-mono">{b.sharpe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {T(
              "Educational backtest using RSI + MACD strategy on synthetic series. Past results do not predict future performance.",
              "اختبار رجعي تعليمي باستخدام RSI + MACD على سلاسل اصطناعية. الأداء السابق لا يضمن النتائج المستقبلية.",
              ar,
            )}
          </p>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("font-mono", className)}>{value}</span>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  tone?: "good" | "bad" | "warn";
}) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : tone === "warn" ? "text-amber-400" : "text-primary";
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className={cn("text-lg font-semibold mt-1", color)}>{value}</div>
    </div>
  );
}
