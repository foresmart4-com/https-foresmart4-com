import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Beaker, RefreshCw, FlaskConical, ShieldAlert, AlertTriangle, History, Trash2 } from "lucide-react";
import {
  generateTradingDecision,
  QA_SCENARIOS,
  type AssetContext,
  type TradingDecision,
} from "@/lib/marketIntelligence";
import {
  tryCreateOrderFromDecision,
  useAutoTrading,
  updateSettings,
  clearDecisionLog,
  REJECT_REASONS_AR,
} from "@/lib/autoTrading";

const TEST_ASSETS: AssetContext[] = [
  { symbol: "BTC",     name_ar: "بتكوين",   category: "crypto",       price: 64800, change24h: -0.74, currency: "USD" },
  { symbol: "ETH",     name_ar: "إيثيريوم", category: "crypto",       price: 3120,  change24h: -0.42, currency: "USD" },
  { symbol: "2222.SR", name_ar: "أرامكو",   category: "saudi",        price: 28.40, change24h: 1.42,  currency: "SAR" },
  { symbol: "1120.SR", name_ar: "الراجحي", category: "saudi",        price: 92.10, change24h: 0.35,  currency: "SAR" },
  { symbol: "XAU",     name_ar: "الذهب",   category: "commodities",  price: 2418,  change24h: 0.94,  currency: "USD" },
];

const ACTION_CLS: Record<TradingDecision["action"], string> = {
  BUY: "bg-success/15 text-success border-success/30",
  SELL: "bg-danger/15 text-danger border-danger/30",
  HOLD: "bg-warning/15 text-warning border-warning/30",
  STOP_LOSS: "bg-danger/20 text-danger border-danger/40",
  TAKE_PROFIT: "bg-success/20 text-success border-success/40",
};

export function AIDecisionTester() {
  const { lang } = useI18n();
  const { settings, decisionLog } = useAutoTrading();
  const [nonce, setNonce] = useState(0);

  const decisions = useMemo(() => TEST_ASSETS.map(generateTradingDecision), [nonce]);
  const scenarios = useMemo(() => QA_SCENARIOS.map((s) => ({ s, d: generateTradingDecision(s.context) })), [nonce]);

  const refresh = () => {
    setNonce((n) => n + 1);
    toast.success(lang === "ar" ? "تم تحديث قرارات الذكاء الاصطناعي" : "AI decisions refreshed");
  };

  // Simulate whether each scenario would create an Auto order (without actually creating)
  const simulateOutcome = (d: TradingDecision, dataIsMock = true) => {
    const s = settings;
    if (d.action === "STOP_LOSS") return { created: true, reason: "stop_loss_priority" };
    if (!s.enabled) return { created: false, reason: "auto_trading_disabled" };
    if (d.action === "HOLD") return { created: false, reason: "hold_no_order" };
    if (d.riskLevel === "HIGH") return { created: false, reason: "risk_too_high" };
    if (d.confidence < s.minConfidence) return { created: false, reason: "below_min_confidence" };
    if (dataIsMock && d.action === "BUY" && !s.allowMockSimulation) return { created: false, reason: "mock_data_buy_blocked" };
    return { created: true, reason: "ok" };
  };

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Beaker className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">
            {lang === "ar" ? "اختبار قرارات الذكاء الاصطناعي" : "AI Decision QA"}
          </h2>
          <Badge variant="outline" className="text-[10px]">QA</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {lang === "ar" ? "السماح بمحاكاة BUY على بيانات تجريبية" : "Allow BUY on mock data"}
            </span>
            <Switch checked={settings.allowMockSimulation}
              onCheckedChange={(v) => updateSettings({ allowMockSimulation: v })} />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            {lang === "ar" ? "إعادة تحليل جميع الأصول" : "Re-analyze all"}
          </Button>
        </div>
      </header>

      <div className="m-4 rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        {lang === "ar"
          ? "اختبار داخلي للقرارات. كل النتائج تحليلية وأي أوامر تجريبية (Paper) فقط."
          : "Internal QA. All outputs are analytical; orders are paper-only."}
      </div>

      {/* Test assets table */}
      <section className="px-4 pb-4">
        <h3 className="mb-2 text-sm font-semibold">{lang === "ar" ? "أصول الاختبار" : "Test assets"}</h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
                <th className="px-2 py-1.5 text-end">RSI</th>
                <th className="px-2 py-1.5 text-end">MA20</th>
                <th className="px-2 py-1.5 text-end">MA50</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "اتجاه" : "Trend"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "دعم" : "Sup"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "مقاومة" : "Res"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "معنويات" : "News"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "مخاطر" : "Risk"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "القرار" : "Action"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "ثقة" : "Conf."}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "وقف/هدف" : "SL/TP"}</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.asset} className="border-t border-border align-top">
                  <td className="px-2 py-1.5 font-medium">
                    {d.asset}
                    <div className="text-[10px] text-muted-foreground">{d.reasonSummary}</div>
                  </td>
                  <td className="px-2 py-1.5 text-end">{TEST_ASSETS.find((a) => a.symbol === d.asset)?.price}</td>
                  <td className="px-2 py-1.5 text-end">{d.indicators.rsi}</td>
                  <td className="px-2 py-1.5 text-end">{d.indicators.ma20}</td>
                  <td className="px-2 py-1.5 text-end">{d.indicators.ma50}</td>
                  <td className="px-2 py-1.5 text-end uppercase">{d.indicators.trend}</td>
                  <td className="px-2 py-1.5 text-end">{d.indicators.support}</td>
                  <td className="px-2 py-1.5 text-end">{d.indicators.resistance}</td>
                  <td className="px-2 py-1.5 text-end">
                    <Badge variant="outline" className={cn("text-[10px]",
                      d.sentiment.label === "positive" && "border-success/40 text-success",
                      d.sentiment.label === "negative" && "border-danger/40 text-danger",
                      d.sentiment.label === "neutral" && "border-border")}>
                      {d.sentiment.label}
                    </Badge>
                  </td>
                  <td className={cn("px-2 py-1.5 text-end font-semibold",
                    d.riskLevel === "HIGH" && "text-danger",
                    d.riskLevel === "MEDIUM" && "text-warning",
                    d.riskLevel === "LOW" && "text-success")}>{d.riskLevel}</td>
                  <td className="px-2 py-1.5 text-end">
                    <span className={cn("rounded border px-1.5 py-0.5 font-semibold", ACTION_CLS[d.action])}>{d.action}</span>
                  </td>
                  <td className="px-2 py-1.5 text-end font-semibold">{d.confidence}%</td>
                  <td className="px-2 py-1.5 text-end text-[10px]">
                    <span className="text-danger">{d.suggestedStopLoss}</span>
                    {" / "}
                    <span className="text-success">{d.suggestedTakeProfit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scenarios */}
      <section className="px-4 pb-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="h-4 w-4 text-primary" />
          {lang === "ar" ? "اختبار سيناريوهات" : "Scenario tests"}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map(({ s, d }) => {
            const out = simulateOutcome(d, true);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{lang === "ar" ? s.name_ar : s.name_en}</div>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", ACTION_CLS[d.action])}>{d.action}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.description_ar}</p>

                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
                  <div className="rounded bg-muted/40 px-1 py-1">RSI {d.indicators.rsi}</div>
                  <div className="rounded bg-muted/40 px-1 py-1">{d.indicators.trend.toUpperCase()}</div>
                  <div className={cn("rounded px-1 py-1 font-semibold",
                    d.riskLevel === "HIGH" && "bg-danger/15 text-danger",
                    d.riskLevel === "MEDIUM" && "bg-warning/15 text-warning",
                    d.riskLevel === "LOW" && "bg-success/15 text-success")}>{d.riskLevel}</div>
                </div>

                <div className="mt-2 text-[11px]">
                  <div className="text-muted-foreground">{lang === "ar" ? "سبب القرار" : "Why"}:</div>
                  <div>{d.reasonSummary}</div>
                </div>

                <div className={cn("mt-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]",
                  out.created ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger")}>
                  {out.created ? (
                    <>
                      <ShieldAlert className="h-3 w-3" />
                      {lang === "ar" ? "سيتم إنشاء أمر محاكاة" : "Would create a paper order"}
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3 w-3" />
                      {lang === "ar" ? "لن يتم إنشاء أمر:" : "No order:"} {REJECT_REASONS_AR[out.reason] ?? out.reason}
                    </>
                  )}
                </div>

                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    onClick={() => {
                      const r = tryCreateOrderFromDecision(d, true);
                      if (r.ok) toast.success(lang === "ar" ? `أمر تجريبي ${d.action} على ${d.asset}` : `Simulated ${d.action}`);
                      else toast.warning(REJECT_REASONS_AR[r.reason] ?? r.reason);
                    }}>
                    {lang === "ar" ? "تشغيل المحاكاة" : "Run simulation"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Decision log */}
      <section className="border-t border-border bg-muted/10 px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" />
            {lang === "ar" ? "سجل قرارات الذكاء الاصطناعي" : "AI Decision log"}
            <Badge variant="outline" className="text-[10px]">{decisionLog.length}</Badge>
          </h3>
          {decisionLog.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => clearDecisionLog()}>
              <Trash2 className="h-3 w-3" />{lang === "ar" ? "مسح" : "Clear"}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "القرار" : "Action"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "الثقة" : "Conf."}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "المخاطر" : "Risk"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "المصدر" : "Source"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "أمر؟" : "Order?"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "الوقت" : "Time"}</th>
              </tr>
            </thead>
            <tbody>
              {decisionLog.length === 0 && (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">
                  {lang === "ar" ? "لا يوجد سجل بعد" : "No log entries yet"}
                </td></tr>
              )}
              {decisionLog.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{e.asset}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", ACTION_CLS[e.action])}>{e.action}</span>
                  </td>
                  <td className="px-2 py-1.5 text-end">{e.confidence}%</td>
                  <td className="px-2 py-1.5 text-end">{e.riskLevel}</td>
                  <td className="px-2 py-1.5 text-end">
                    <Badge variant="outline" className={cn("text-[10px]",
                      e.source === "live" ? "border-success/40 text-success" : "border-warning/40 text-warning")}>
                      {e.source.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-end">
                    {e.orderCreated ? <span className="text-success">✓</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[220px]">
                    {e.rejectReason ? (REJECT_REASONS_AR[e.rejectReason] ?? e.rejectReason) : (lang === "ar" ? "تم الإنشاء" : "created")}
                  </td>
                  <td className="px-2 py-1.5 text-end text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Card>
  );
}
