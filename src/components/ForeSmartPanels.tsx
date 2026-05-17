import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { runBacktest, type BacktestPeriod, type BacktestStrategy } from "@/lib/backtesting";
import { buildSmartAlerts } from "@/lib/smartAlerts";
import { generateTradingDecision, type AssetContext } from "@/lib/marketIntelligence";
import { computePortfolioRisk } from "@/lib/portfolioRisk";
import { useJournal, addJournalEntry, journalToCSV, deleteJournalEntry } from "@/lib/tradingJournal";
import { runSimulationCycle, useAutoTrading, ordersToCSV, setTradingMode, TRADING_MODE_PRESETS, type TradingMode } from "@/lib/autoTrading";
import { useWatchlist } from "@/lib/watchlistStore";
import { AlertTriangle, BookOpen, FlaskRound, ShieldCheck, Download, Trash2, Bell, PlayCircle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function SmartAlertsPanel() {
  const { lang } = useI18n();
  const { items } = useWatchlist();
  const decisions = useMemo(() => items.map((a) => generateTradingDecision({ symbol: a.symbol, category: a.category as any, price: a.price, change24h: a.change24h, currency: a.currency } as AssetContext)), [items]);
  const alerts = useMemo(() => buildSmartAlerts(decisions, true), [decisions]);
  return (
    <Card className="p-5">
      <header className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{lang === "ar" ? "تنبيهات السوق الذكية" : "Smart Market Alerts"}</h3>
        <Badge variant="outline" className="text-[10px]">{alerts.length}</Badge>
      </header>
      <div className="space-y-2">
        {alerts.length === 0 && <p className="text-xs text-muted-foreground">{lang === "ar" ? "لا تنبيهات" : "No alerts"}</p>}
        {alerts.map((a) => (
          <div key={a.id} className={cn("rounded-md border p-2 text-xs",
            a.severity === "critical" && "border-danger/30 bg-danger/5",
            a.severity === "warning" && "border-warning/30 bg-warning/5",
            a.severity === "info" && "border-primary/20 bg-primary/5")}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{lang === "ar" ? a.message_ar : a.message_en}</div>
              <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">{lang === "ar" ? a.suggestion_ar : a.suggestion_en}</div>
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toast.info(lang === "ar" ? "تمت إضافة للمراقبة" : "Watching")}>{lang === "ar" ? "مراقبة" : "Watch"}</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toast.success(lang === "ar" ? "تم التجاهل" : "Dismissed")}>{lang === "ar" ? "تجاهل" : "Dismiss"}</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PortfolioRiskDashboard() {
  const { lang } = useI18n();
  const r = useMemo(() => computePortfolioRisk(), []);
  const exposureItems: { label_ar: string; label_en: string; v: number }[] = [
    { label_ar: "العملات الرقمية", label_en: "Crypto", v: r.exposure.crypto },
    { label_ar: "الأسهم", label_en: "Stocks", v: r.exposure.stocks },
    { label_ar: "السلع", label_en: "Commodities", v: r.exposure.commodities },
  ];
  return (
    <Card className="p-5">
      <header className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{lang === "ar" ? "لوحة مخاطر المحفظة" : "Portfolio Risk"}</h3>
        <Badge variant="outline" className={cn("text-[10px]",
          r.riskScore >= 60 && "border-danger/40 text-danger",
          r.riskScore >= 35 && r.riskScore < 60 && "border-warning/40 text-warning",
          r.riskScore < 35 && "border-success/40 text-success")}>Risk {r.riskScore}/100</Badge>
      </header>
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <Stat label={lang === "ar" ? "إجمالي القيمة" : "Total"} v={`${r.totalValue.toLocaleString()} SAR`} />
        <Stat label={lang === "ar" ? "النقد" : "Cash"} v={`${r.cash.toLocaleString()} SAR`} />
        <Stat label={lang === "ar" ? "أكبر مركز" : "Largest"} v={r.largestAsset ? `${r.largestAsset.symbol} ${r.largestAsset.weightPct}%` : "—"} />
        <Stat label={lang === "ar" ? "أعلى مخاطرة" : "Riskiest"} v={r.riskiestAsset ? `${r.riskiestAsset.symbol} ${r.riskiestAsset.pnlPct}%` : "—"} />
        <Stat label={lang === "ar" ? "التنويع" : "Diversification"} v={r.diversification.toUpperCase()} />
      </div>
      <div className="mt-3 grid gap-1 text-[11px]">
        {exposureItems.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-24 text-muted-foreground">{lang === "ar" ? e.label_ar : e.label_en}</div>
            <div className="h-2 flex-1 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, e.v)}%` }} /></div>
            <div className="w-10 text-end">{e.v.toFixed(1)}%</div>
          </div>
        ))}
      </div>
      {r.recommendations.length > 0 && (
        <div className="mt-3 space-y-1 text-[11px]">
          <div className="font-semibold">{lang === "ar" ? "توصيات" : "Recommendations"}:</div>
          {r.recommendations.map((rec, i) => (
            <div key={i} className={cn("rounded border px-2 py-1",
              rec.severity === "critical" && "border-danger/30 bg-danger/5",
              rec.severity === "warning" && "border-warning/30 bg-warning/5",
              rec.severity === "info" && "border-primary/20 bg-primary/5")}>
              {lang === "ar" ? rec.ar : rec.en}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return <div className="rounded border border-border bg-muted/30 p-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-semibold">{v}</div></div>;
}

export function BacktestingPanel() {
  const { lang } = useI18n();
  const [asset, setAsset] = useState("BTC");
  const [period, setPeriod] = useState<BacktestPeriod>(30);
  const [strategy, setStrategy] = useState<BacktestStrategy>("balanced");
  const result = useMemo(() => runBacktest(asset, period, strategy), [asset, period, strategy]);
  return (
    <Card className="p-5">
      <header className="mb-3 flex items-center gap-2">
        <FlaskRound className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{lang === "ar" ? "اختبار تاريخي تجريبي" : "Backtesting (Mock)"}</h3>
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} placeholder="BTC" className="h-9" />
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as BacktestPeriod)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 {lang === "ar" ? "أيام" : "days"}</SelectItem>
            <SelectItem value="30">30 {lang === "ar" ? "يوم" : "days"}</SelectItem>
            <SelectItem value="90">90 {lang === "ar" ? "يوم" : "days"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={strategy} onValueChange={(v) => setStrategy(v as BacktestStrategy)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">{lang === "ar" ? "محافظ" : "Conservative"}</SelectItem>
            <SelectItem value="balanced">{lang === "ar" ? "متوازن" : "Balanced"}</SelectItem>
            <SelectItem value="aggressive">{lang === "ar" ? "هجومي" : "Aggressive"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label={lang === "ar" ? "صفقات" : "Trades"} v={String(result.trades)} />
        <Stat label={lang === "ar" ? "فوز %" : "Win %"} v={`${result.winRatePct}%`} />
        <Stat label={lang === "ar" ? "العائد" : "Return"} v={`${result.totalReturnPct}%`} />
        <Stat label={lang === "ar" ? "أكبر ربح" : "Best"} v={`${result.largestWinPct}%`} />
        <Stat label={lang === "ar" ? "أكبر خسارة" : "Worst"} v={`${result.largestLossPct}%`} />
        <Stat label="Max DD" v={`${result.maxDrawdownPct}%`} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{lang === "ar" ? result.summary_ar : result.summary_en}</p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-warning"><AlertTriangle className="h-3 w-3" />{lang === "ar" ? "هذه نتائج محاكاة وليست ضماناً للأداء المستقبلي." : "Simulation only — no guarantee of future results."}</p>
    </Card>
  );
}

export function TradingJournalPanel() {
  const { lang } = useI18n();
  const entries = useJournal();
  const [filter, setFilter] = useState<"all" | "win" | "lose">("all");
  const filtered = entries.filter((e) => filter === "all" ? true : filter === "win" ? (e.pnlPct ?? 0) > 0 : (e.pnlPct ?? 0) < 0);
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">{lang === "ar" ? "دفتر التداول" : "Trading Journal"}</h3>
          <Badge variant="outline" className="text-[10px]">{entries.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "الكل" : "All"}</SelectItem>
              <SelectItem value="win">{lang === "ar" ? "رابحة" : "Wins"}</SelectItem>
              <SelectItem value="lose">{lang === "ar" ? "خاسرة" : "Losses"}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { addJournalEntry({ asset: "DEMO", type: "manual", side: "buy", entry: 100, exit: 105, pnlPct: 5, reasonIn: "اختبار", reasonOut: "هدف" }); toast.success("Added"); }}>+</Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => download(`journal_${Date.now()}.csv`, journalToCSV(filtered))}><Download className="h-3 w-3" />CSV</Button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 text-muted-foreground"><tr>
            <th className="px-2 py-1.5 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
            <th className="px-2 py-1.5">{lang === "ar" ? "النوع" : "Type"}</th>
            <th className="px-2 py-1.5">{lang === "ar" ? "اتجاه" : "Side"}</th>
            <th className="px-2 py-1.5 text-end">{lang === "ar" ? "دخول" : "Entry"}</th>
            <th className="px-2 py-1.5 text-end">{lang === "ar" ? "خروج" : "Exit"}</th>
            <th className="px-2 py-1.5 text-end">P/L%</th>
            <th className="px-2 py-1.5 text-start">{lang === "ar" ? "سبب" : "Reason"}</th>
            <th className="px-2 py-1.5 text-end">{lang === "ar" ? "تاريخ" : "Date"}</th>
            <th className="px-2 py-1.5"></th>
          </tr></thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-2 py-1.5 font-medium">{e.asset}</td>
                <td className="px-2 py-1.5">{e.type}</td>
                <td className="px-2 py-1.5">{e.side}</td>
                <td className="px-2 py-1.5 text-end">{e.entry ?? "—"}</td>
                <td className="px-2 py-1.5 text-end">{e.exit ?? "—"}</td>
                <td className={cn("px-2 py-1.5 text-end font-semibold", (e.pnlPct ?? 0) >= 0 ? "text-success" : "text-danger")}>{e.pnlPct?.toFixed(2) ?? "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[160px]">{e.reasonIn ?? "—"} → {e.reasonOut ?? "—"}</td>
                <td className="px-2 py-1.5 text-end text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-2 py-1.5"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteJournalEntry(e.id)}><Trash2 className="h-3 w-3" /></Button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">{lang === "ar" ? "لا قيود" : "Empty"}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AutoTradingModeBar() {
  const { lang } = useI18n();
  const { settings, orders } = useAutoTrading();
  const { items } = useWatchlist();
  const runCycle = () => {
    const decisions = items.map((a) => generateTradingDecision({ symbol: a.symbol, category: a.category as any, price: a.price, change24h: a.change24h, currency: a.currency } as AssetContext));
    const report = runSimulationCycle(decisions, true);
    toast.success(lang === "ar"
      ? `تحليل ${report.analyzed} · إنشاء ${report.created} · رفض ${report.rejected}`
      : `Analyzed ${report.analyzed} · Created ${report.created} · Rejected ${report.rejected}`);
  };
  return (
    <Card className="p-4 space-y-3">
      <header className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{lang === "ar" ? "أوضاع التداول الآلي" : "Trading Modes"}</h3>
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(TRADING_MODE_PRESETS) as TradingMode[]).map((m) => {
          const p = TRADING_MODE_PRESETS[m];
          const active = settings.tradingMode === m;
          return (
            <button key={m} onClick={() => { setTradingMode(m); toast.success(`Mode: ${m}`); }}
              className={cn("rounded-lg border p-3 text-start transition-colors",
                active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40")}>
              <div className="text-sm font-semibold capitalize">{m}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Conf ≥{p.minConfidence}% · Risk ≤{p.maxRisk} · Size ≤{p.maxPositionPct}%
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={runCycle} className="gap-1"><PlayCircle className="h-4 w-4" />{lang === "ar" ? "تشغيل دورة محاكاة" : "Run cycle"}</Button>
        <Button size="sm" variant="outline" onClick={() => download(`sim_orders_${Date.now()}.csv`, ordersToCSV(orders))} className="gap-1">
          <Download className="h-4 w-4" />{lang === "ar" ? "تصدير أوامر المحاكاة" : "Export sim orders"}
        </Button>
      </div>
      <p className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{lang === "ar" ? "كل العمليات Simulation فقط — لا تداول حقيقي." : "Simulation only — no real trading."}</p>
    </Card>
  );
}
