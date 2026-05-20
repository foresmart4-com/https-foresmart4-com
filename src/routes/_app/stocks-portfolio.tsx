import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import {
  getBrokerPortfolio, placeStockOrder, cancelStockOrder,
  triggerStockEmergencyStop, resumeStockTrading,
  getRecentStockDecisions, previewStockOrderRisk,
} from "@/lib/stockBroker.functions";
import { Briefcase, RefreshCw, ShieldAlert, Shield, AlertTriangle, Building2, LineChart, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/stocks-portfolio")({
  head: () => ({
    meta: [
      { title: "Stocks Portfolio — ForeSmart" },
      { name: "description", content: "Real stock portfolio powered by Alpaca / Interactive Brokers with server-side risk guard." },
    ],
  }),
  component: StocksPortfolioPage,
});

function StocksPortfolioPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const fetchPortfolio = useServerFn(getBrokerPortfolio);
  const placeOrderFn = useServerFn(placeStockOrder);
  const cancelOrderFn = useServerFn(cancelStockOrder);
  const eStopFn = useServerFn(triggerStockEmergencyStop);
  const resumeFn = useServerFn(resumeStockTrading);
  const decisionsFn = useServerFn(getRecentStockDecisions);
  const previewRiskFn = useServerFn(previewStockOrderRisk);

  const portfolio = useQuery({
    queryKey: ["stocks-portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 30_000,
  });
  const decisions = useQuery({
    queryKey: ["stock-decisions"],
    queryFn: () => decisionsFn({ data: { limit: 15 } }),
    refetchInterval: 30_000,
  });

  type OrderPayload = { symbol: string; side: "buy" | "sell"; type: "market" | "limit"; qty: number; limitPrice?: number; timeInForce: "day" | "gtc" };
  const place = useMutation({
    mutationFn: (input: OrderPayload) => placeOrderFn({ data: input }),
    onSuccess: (r) => {
      if (r.ok && r.status === "preview") {
        const allowed = (r as { allowed?: boolean }).allowed !== false;
        if (allowed) toast.success(ar ? "معاينة الأمر (LIVE معطّل) — مسموح به" : "Preview only (LIVE off) — allowed");
        else toast.error(ar ? `الأمر مرفوض: ${r.reason ?? ""}` : `Order rejected: ${r.reason ?? ""}`);
      }
      else if (r.ok && r.status === "placed") toast.success(ar ? "تم إرسال الأمر" : "Order placed");
      else if (!r.ok) toast.error((r as { reason?: string }).reason ?? (ar ? "فشل الأمر" : "Order failed"));
      qc.invalidateQueries({ queryKey: ["stocks-portfolio"] });
      qc.invalidateQueries({ queryKey: ["stock-decisions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => cancelOrderFn({ data: { orderId } }),
    onSuccess: () => { toast.success(ar ? "تم إلغاء الأمر" : "Order canceled"); qc.invalidateQueries({ queryKey: ["stocks-portfolio"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = portfolio.data;
  const configured = data && "ok" in data && data.ok && data.status === "connected";

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold">{ar ? "محفظة الأسهم" : "Stocks Portfolio"}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {ar ? "أرصدة وأوامر حقيقية عبر Alpaca / Interactive Brokers." : "Real balances and orders via Alpaca / Interactive Brokers."}
          </p>
        </div>
        <Button variant="outline" onClick={() => portfolio.refetch()} disabled={portfolio.isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${portfolio.isFetching ? "animate-spin" : ""}`} />
          {data && "provider" in data && data.provider === "alpaca"
            ? (ar ? "مزامنة Alpaca" : "Sync Alpaca")
            : (ar ? "تحديث" : "Refresh")}
        </Button>
      </header>

      {data && (
        <Alert className={configured ? "border-success/40" : "border-warning/40"}>
          <Building2 className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="uppercase">{data.provider}</Badge>
            {configured && (
              <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                <CheckCircle2 className="h-3 w-3" />
                {data.provider === "alpaca" ? (ar ? "Alpaca متصل" : "Alpaca Connected") : (ar ? "متصل" : "Connected")}
              </Badge>
            )}
            <Badge variant={data.liveTradingEnabled ? "default" : "outline"}>
              {data.liveTradingEnabled ? (ar ? "تداول حقيقي مفعّل" : "Live trading ON") : (ar ? "معاينة فقط — LIVE_TRADING_ENABLED=false" : "Preview only — LIVE_TRADING_ENABLED=false")}
            </Badge>
            {!configured && (
              <span className="text-muted-foreground">
                {ar ? "الوسيط غير مهيأ:" : "Broker not configured:"} {("reason" in data && data.reason) || ""}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {configured && (
        <>
          <AccountCard account={data.account} dailyPnl={data.risk.dailyPnlUsd} maxOrder={data.risk.maxOrderNotionalUsd} dailyLimit={data.risk.dailyLossLimitUsd} emergencyStop={data.risk.emergencyStopActive}
            onEStop={async () => { await eStopFn({ data: { reason: "User triggered from Stocks Portfolio" } }); toast.message(ar ? "تم تفعيل الإيقاف الطارئ" : "Emergency stop activated"); qc.invalidateQueries({ queryKey: ["stocks-portfolio"] }); }}
            onResume={async () => { await resumeFn(); toast.message(ar ? "تم استئناف التداول" : "Trading resumed"); qc.invalidateQueries({ queryKey: ["stocks-portfolio"] }); }}
          />

          <OrderTicket
            onSubmit={(o) => place.mutate(o)}
            onPreviewRisk={(o) => previewRiskFn({ data: o })}
            pending={place.isPending}
            liveTradingEnabled={data.liveTradingEnabled}
          />

          <PositionsTable positions={data.positions} />
          <OrdersTable orders={data.orders} onCancel={(id) => cancel.mutate(id)} canCancel={data.liveTradingEnabled} />
          <DecisionsTable rows={(decisions.data && "decisions" in decisions.data ? decisions.data.decisions : []) as DecisionRow[]} />
        </>
      )}
    </div>
  );
}

function AccountCard({ account, dailyPnl, maxOrder, dailyLimit, emergencyStop, onEStop, onResume }: {
  account: { accountId: string; currency: string; cash: number; equity: number; buyingPower: number };
  dailyPnl: number; maxOrder: number; dailyLimit: number; emergencyStop: boolean;
  onEStop: () => void; onResume: () => void;
}) {
  const { lang } = useI18n(); const ar = lang === "ar";
  return (
    <Card className="grid gap-3 p-4 md:grid-cols-5">
      <Stat label={ar ? "الحساب" : "Account"} value={account.accountId} mono />
      <Stat label={ar ? "النقد" : "Cash"} value={fmtUsd(account.cash, account.currency)} />
      <Stat label={ar ? "حقوق الملكية" : "Equity"} value={fmtUsd(account.equity, account.currency)} />
      <Stat label={ar ? "قوة الشراء" : "Buying Power"} value={fmtUsd(account.buyingPower, account.currency)} />
      <div className="rounded-md border border-border bg-muted/20 p-2">
        <div className="text-[11px] uppercase text-muted-foreground">{ar ? "P&L اليومي" : "Daily P&L"}</div>
        <div className={`font-mono text-sm font-semibold ${dailyPnl < 0 ? "text-destructive" : "text-success"}`}>{fmtUsd(dailyPnl, "USD")}</div>
      </div>
      <div className="md:col-span-5 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">{ar ? "حد الأمر الأقصى:" : "Max order:"} <strong>{fmtUsd(maxOrder, "USD")}</strong></span>
        <span className="text-muted-foreground">{ar ? "حد الخسارة اليومي:" : "Daily loss limit:"} <strong>{fmtUsd(dailyLimit, "USD")}</strong></span>
        {emergencyStop ? (
          <Button size="sm" variant="outline" className="ms-auto gap-2" onClick={onResume}><Shield className="h-4 w-4" /> {ar ? "استئناف" : "Resume"}</Button>
        ) : (
          <Button size="sm" variant="destructive" className="ms-auto gap-2" onClick={onEStop}><ShieldAlert className="h-4 w-4" /> {ar ? "إيقاف طارئ" : "Emergency Stop"}</Button>
        )}
      </div>
    </Card>
  );
}

type OrderInput = { symbol: string; side: "buy" | "sell"; type: "market" | "limit"; qty: number; limitPrice?: number; timeInForce: "day" | "gtc" };
type RiskPreview = {
  ok: boolean;
  status?: string;
  reason?: string;
  refPrice?: number;
  risk?: { allowed: boolean; reason?: string; notionalUsd: number; dailyPnlUsd: number; emergencyStopActive: boolean; config: { maxOrderNotionalUsd: number; dailyLossLimitUsd: number } };
};

function OrderTicket({ onSubmit, onPreviewRisk, pending, liveTradingEnabled }: {
  onSubmit: (o: OrderInput) => void;
  onPreviewRisk: (o: OrderInput) => Promise<RiskPreview>;
  pending: boolean; liveTradingEnabled: boolean;
}) {
  const { lang } = useI18n(); const ar = lang === "ar";
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [tif, setTif] = useState<"day" | "gtc">("day");
  const [preview, setPreview] = useState<RiskPreview | null>(null);
  const [checking, setChecking] = useState(false);

  const buildOrder = (): OrderInput => ({
    symbol, side, type, qty: Number(qty),
    limitPrice: type === "limit" ? Number(limitPrice) : undefined,
    timeInForce: tif,
  });
  const invalid = !symbol || !(Number(qty) > 0) || (type === "limit" && !(Number(limitPrice) > 0));
  const handleCheck = async () => {
    setChecking(true);
    try { setPreview(await onPreviewRisk(buildOrder())); }
    catch (e) { setPreview({ ok: false, reason: (e as Error).message }); }
    finally { setChecking(false); }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LineChart className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{ar ? "إنشاء أمر" : "New Order"}</h2>
        {!liveTradingEnabled && (
          <Badge variant="outline" className="ms-auto gap-1 text-warning"><AlertTriangle className="h-3 w-3" /> {ar ? "معاينة فقط" : "Preview only"}</Badge>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        <Field label={ar ? "الرمز" : "Symbol"}>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="font-mono uppercase" maxLength={10} />
        </Field>
        <Field label={ar ? "الاتجاه" : "Side"}>
          <Select value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="buy">{ar ? "شراء" : "Buy"}</SelectItem><SelectItem value="sell">{ar ? "بيع" : "Sell"}</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label={ar ? "النوع" : "Type"}>
          <Select value={type} onValueChange={(v) => setType(v as "market" | "limit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="market">Market</SelectItem><SelectItem value="limit">Limit</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label={ar ? "الكمية" : "Qty"}>
          <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label={ar ? "سعر الحد" : "Limit Price"}>
          <Input value={limitPrice} disabled={type !== "limit"} onChange={(e) => setLimitPrice(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label={ar ? "السريان" : "TIF"}>
          <Select value={tif} onValueChange={(v) => setTif(v as "day" | "gtc")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="gtc">GTC</SelectItem></SelectContent>
          </Select>
        </Field>
      </div>

      <RiskGuardPreview preview={preview} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={invalid || checking} onClick={handleCheck}>
          <Shield className="h-4 w-4 me-1" /> {checking ? (ar ? "فحص..." : "Checking…") : (ar ? "فحص المخاطر" : "Check Risk")}
        </Button>
        <Button
          disabled={pending || invalid}
          onClick={() => onSubmit(buildOrder())}
        >
          {pending ? (ar ? "جارٍ..." : "Submitting...") : liveTradingEnabled ? (ar ? "إرسال الأمر" : "Submit Order") : (ar ? "معاينة الأمر" : "Preview Order")}
        </Button>
      </div>
    </Card>
  );
}

function RiskGuardPreview({ preview }: { preview: RiskPreview | null }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  if (!preview) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        {ar ? "اضغط «فحص المخاطر» قبل الإرسال لمعرفة الحد الأقصى وحد الخسارة وحالة الإيقاف الطارئ." : "Click «Check Risk» before submit to see max size, daily loss and emergency-stop state."}
      </div>
    );
  }
  if (!preview.ok || !preview.risk) {
    return (
      <Alert className="border-destructive/40">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-xs">{ar ? "تعذّر التقييم:" : "Evaluation failed:"} {preview.reason ?? "unknown"}</AlertDescription>
      </Alert>
    );
  }
  const r = preview.risk;
  return (
    <div className={`rounded-md border p-3 text-xs ${r.allowed ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={r.allowed ? "default" : "destructive"} className="uppercase">
          {r.allowed ? (ar ? "مسموح" : "Allowed") : (ar ? "مرفوض" : "Blocked")}
        </Badge>
        {r.emergencyStopActive && <Badge variant="destructive">{ar ? "إيقاف طارئ" : "Emergency stop"}</Badge>}
        {!r.allowed && <span className="text-destructive">{r.reason}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono md:grid-cols-4">
        <span>{ar ? "السعر المرجعي" : "Ref price"}: <strong>{fmtUsd(preview.refPrice ?? 0, "USD")}</strong></span>
        <span>{ar ? "القيمة الاسمية" : "Notional"}: <strong>{fmtUsd(r.notionalUsd, "USD")}</strong></span>
        <span>{ar ? "حد الأمر" : "Max order"}: <strong>{fmtUsd(r.config.maxOrderNotionalUsd, "USD")}</strong></span>
        <span>{ar ? "حد الخسارة اليومي" : "Daily loss limit"}: <strong>{fmtUsd(r.config.dailyLossLimitUsd, "USD")}</strong></span>
        <span className="col-span-2 md:col-span-4">{ar ? "P&L اليومي" : "Daily P&L"}: <strong className={r.dailyPnlUsd < 0 ? "text-destructive" : "text-success"}>{fmtUsd(r.dailyPnlUsd, "USD")}</strong></span>
      </div>
    </div>
  );
}

type DecisionRow = { id: string; created_at: string; broker: string; mode: string; symbol: string; side: string; type: string; quantity: number; price: number | null; status: string; metadata: Record<string, unknown> | null };

function DecisionsTable({ rows }: { rows: DecisionRow[] }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  return (
    <Card className="p-0">
      <header className="flex items-center justify-between border-b border-border p-3">
        <h3 className="font-semibold">{ar ? "سجل القرارات الأخيرة" : "Recent Order Decisions"}</h3>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </header>
      <div className="table-scroll overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{ar ? "الوقت" : "Time"}</th>
            <th className="px-3 py-2">{ar ? "الوضع" : "Mode"}</th>
            <th className="px-3 py-2 text-start">{ar ? "الرمز" : "Symbol"}</th>
            <th className="px-3 py-2">{ar ? "الاتجاه" : "Side"}</th>
            <th className="px-3 py-2 text-end">{ar ? "الكمية" : "Qty"}</th>
            <th className="px-3 py-2 text-end">{ar ? "السعر" : "Price"}</th>
            <th className="px-3 py-2">{ar ? "الحالة" : "Status"}</th>
            <th className="px-3 py-2 text-start">{ar ? "السبب" : "Reason"}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const meta = (r.metadata ?? {}) as { reason?: string; notionalUsd?: number };
              const blocked = r.status === "preview_rejected";
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs uppercase"><Badge variant="outline">{r.mode}</Badge></td>
                  <td className="px-3 py-2 font-mono font-semibold">{r.symbol}</td>
                  <td className="px-3 py-2 uppercase">{r.side}</td>
                  <td className="px-3 py-2 text-end font-mono">{r.quantity}</td>
                  <td className="px-3 py-2 text-end font-mono">{r.price != null ? fmtUsd(Number(r.price), "USD") : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant={blocked ? "destructive" : r.status === "preview_allowed" ? "secondary" : "default"}>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{meta.reason ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">{ar ? "لا توجد قرارات بعد" : "No decisions yet"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PositionsTable({ positions }: { positions: Array<{ symbol: string; qty: number; avgPrice: number; marketPrice: number; marketValue: number; unrealizedPnl: number; unrealizedPnlPct: number; side: "long" | "short" }> }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  return (
    <Card className="p-0">
      <header className="flex items-center justify-between border-b border-border p-3"><h3 className="font-semibold">{ar ? "المراكز المفتوحة" : "Open Positions"}</h3><span className="text-xs text-muted-foreground">{positions.length}</span></header>
      <div className="table-scroll overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{ar ? "الرمز" : "Symbol"}</th>
            <th className="px-3 py-2 text-end">{ar ? "الكمية" : "Qty"}</th>
            <th className="px-3 py-2 text-end">{ar ? "متوسط الشراء" : "Avg"}</th>
            <th className="px-3 py-2 text-end">{ar ? "السعر" : "Price"}</th>
            <th className="px-3 py-2 text-end">{ar ? "القيمة" : "Value"}</th>
            <th className="px-3 py-2 text-end">P&L</th>
          </tr></thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.symbol} className="border-t border-border">
                <td className="px-3 py-2 font-mono font-semibold">{p.symbol}</td>
                <td className="px-3 py-2 text-end font-mono">{p.qty}</td>
                <td className="px-3 py-2 text-end font-mono">{fmtUsd(p.avgPrice, "USD")}</td>
                <td className="px-3 py-2 text-end font-mono">{fmtUsd(p.marketPrice, "USD")}</td>
                <td className="px-3 py-2 text-end font-mono">{fmtUsd(p.marketValue, "USD")}</td>
                <td className={`px-3 py-2 text-end font-mono ${p.unrealizedPnl < 0 ? "text-destructive" : "text-success"}`}>{fmtUsd(p.unrealizedPnl, "USD")} ({p.unrealizedPnlPct.toFixed(2)}%)</td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{ar ? "لا توجد مراكز" : "No positions"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OrdersTable({ orders, onCancel, canCancel }: { orders: Array<{ id: string; symbol: string; side: string; type: string; qty: number; limitPrice?: number; status: string; filledQty: number }>; onCancel: (id: string) => void; canCancel: boolean }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  return (
    <Card className="p-0">
      <header className="flex items-center justify-between border-b border-border p-3"><h3 className="font-semibold">{ar ? "الأوامر المفتوحة" : "Open Orders"}</h3><span className="text-xs text-muted-foreground">{orders.length}</span></header>
      <div className="table-scroll overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-start">{ar ? "الرمز" : "Symbol"}</th>
            <th className="px-3 py-2">{ar ? "الاتجاه" : "Side"}</th>
            <th className="px-3 py-2">{ar ? "النوع" : "Type"}</th>
            <th className="px-3 py-2 text-end">{ar ? "الكمية" : "Qty"}</th>
            <th className="px-3 py-2 text-end">{ar ? "سعر الحد" : "Limit"}</th>
            <th className="px-3 py-2">{ar ? "الحالة" : "Status"}</th>
            <th className="px-3 py-2 text-end" />
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono font-semibold">{o.symbol}</td>
                <td className="px-3 py-2 uppercase">{o.side}</td>
                <td className="px-3 py-2 uppercase">{o.type}</td>
                <td className="px-3 py-2 text-end font-mono">{o.qty}</td>
                <td className="px-3 py-2 text-end font-mono">{o.limitPrice ? fmtUsd(o.limitPrice, "USD") : "—"}</td>
                <td className="px-3 py-2 text-xs"><Badge variant="outline">{o.status}</Badge></td>
                <td className="px-3 py-2 text-end">
                  <Button size="sm" variant="ghost" disabled={!canCancel} onClick={() => onCancel(o.id)}>{ar ? "إلغاء" : "Cancel"}</Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{ar ? "لا توجد أوامر" : "No open orders"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs uppercase text-muted-foreground">{label}</Label>{children}</div>);
}
function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div className="rounded-md border border-border bg-muted/20 p-2"><div className="text-[11px] uppercase text-muted-foreground">{label}</div><div className={`${mono ? "font-mono" : ""} text-sm font-semibold`}>{value}</div></div>);
}
function fmtUsd(n: number, ccy: string): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 2 }).format(n);
}
