import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, RefreshCw, ShieldCheck, TrendingUp, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAlpacaPortfolio, type AlpacaPortfolioResult } from "@/lib/alpaca.server";
import { useI18n } from "@/lib/i18n";

const LIVE_TRADING_ENABLED = false;
const AUTO_REFRESH_MS = 60_000;

type PortfolioSuccess = Extract<AlpacaPortfolioResult, { ok: true }>;
type Position = PortfolioSuccess["data"]["positions"][number];
type OpenOrder = PortfolioSuccess["data"]["orders"][number];
type PreviewOrder = {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  limitPrice?: number;
};
type SortKey = "symbol" | "marketValue" | "unrealizedPnl";
type SortDir = "asc" | "desc";

export const Route = createFileRoute("/_app/stocks-portfolio")({
  head: () => ({
    meta: [
      { title: "Stocks Portfolio — ForeSmart" },
      { name: "description", content: "Alpaca paper portfolio, positions, open orders, and stock order previews." },
    ],
  }),
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><StocksPortfolioPage /></ErrorBoundary>,
});

function StocksPortfolioPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const fetchPortfolio = useServerFn(getAlpacaPortfolio);
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const lastErrorToastRef = useRef<string | null>(null);

  const portfolio = useQuery({
    queryKey: ["alpaca-portfolio"],
    queryFn: async () => {
      const result = await fetchPortfolio();
      setLastSyncAt(Date.now());
      return result;
    },
    refetchOnWindowFocus: false,
    refetchInterval: autoRefresh ? (q) => (q.state.data && !("ok" in q.state.data && !q.state.data.ok) ? AUTO_REFRESH_MS : false) : false,
  });

  const result = portfolio.data;
  const snapshot = result?.ok ? result.data : null;
  const connected = Boolean(snapshot);
  const isUnauthorized = result && !result.ok && result.status === "account_error" && /401/.test(result.error);

  useEffect(() => {
    if (result && !result.ok) {
      if (autoRefresh) setAutoRefresh(false);
      const msg = isUnauthorized
        ? (ar ? "فشل الاتصال بحساب Alpaca: 401 Unauthorized — تحقق من مفاتيح API." : "Alpaca account request failed: 401 Unauthorized — check API keys.")
        : (ar ? "تعذّر تحديث بعض بيانات Alpaca." : "Couldn't refresh some Alpaca data.");
      if (lastErrorToastRef.current !== msg) {
        lastErrorToastRef.current = msg;
        if (isUnauthorized) toast.error(msg);
        else toast.warning(msg);
      }
    } else if (result?.ok) {
      lastErrorToastRef.current = null;
    }
  }, [result, isUnauthorized, ar, autoRefresh]);

  const handleSync = async () => {
    await queryClient.invalidateQueries({ queryKey: ["alpaca-portfolio"] });
    const res = await portfolio.refetch();
    if (res.data?.ok) toast.success(ar ? "تمت مزامنة Alpaca." : "Alpaca synced.");
  };

  const syncLabel = portfolio.isFetching
    ? ar ? "جارٍ مزامنة Alpaca..." : "Syncing Alpaca…"
    : ar ? "مزامنة Alpaca" : "Sync Alpaca";

  return (
    <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir={dir}>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  {ar ? "محفظة Alpaca Paper — بدون تداول حقيقي" : "Alpaca Paper Portfolio — No Live Trading"}
                </div>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                  <span className="text-gradient">{ar ? "محفظة الأسهم" : "Stocks Portfolio"}</span>
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {ar
                    ? "اتصال مباشر من السيرفر مع Alpaca Paper API بدون أي طلبات من الواجهة إلى Alpaca."
                    : "Server-side Alpaca Paper API connection. No frontend requests to Alpaca."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <ConnectionBadge connected={connected} syncing={portfolio.isFetching} />
              <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                {ar ? "Preview فقط" : "Preview only"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5">
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} disabled={Boolean(result && !result.ok)} />
              <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">
                {ar ? "تحديث تلقائي كل 60ث" : "Auto-refresh 60s"}
              </Label>
            </div>
            <Button onClick={handleSync} disabled={portfolio.isFetching} size="sm" className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${portfolio.isFetching ? "animate-spin" : ""}`} />
              {syncLabel}
            </Button>
            {lastSyncAt && connected && (
              <span className="ms-auto text-muted-foreground">
                {ar ? "آخر مزامنة:" : "Last sync:"} {new Date(lastSyncAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Status alert ─────────────────────────────────────────────── */}
      <Alert className={connected ? "border-success/40" : isUnauthorized ? "border-destructive/40" : "border-warning/40"}>
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertDescription className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">BROKER_PROVIDER=alpaca</Badge>
          <Badge variant={LIVE_TRADING_ENABLED ? "default" : "outline"}>
            {LIVE_TRADING_ENABLED ? (ar ? "التداول الحقيقي مفعّل" : "Live trading ON") : (ar ? "Preview فقط — التداول الحقيقي معطّل" : "Preview only — live trading disabled")}
          </Badge>
          {isUnauthorized && (
            <span className="text-destructive font-medium">
              {ar ? "فشل /v2/account: 401 Unauthorized. تحقق من APCA-API-KEY-ID و APCA-API-SECRET-KEY على السيرفر." : "/v2/account failed: 401 Unauthorized. Verify APCA-API-KEY-ID and APCA-API-SECRET-KEY on the server."}
            </span>
          )}
          {result && !result.ok && !isUnauthorized && (
            <span className="text-muted-foreground">{ar ? "تعذّر التحديث، حاول لاحقاً." : "Update failed, please retry."}</span>
          )}
        </AlertDescription>
      </Alert>

      {portfolio.isLoading && <LoadingState />}

      {snapshot && (
        <>
          <AccountOverview account={snapshot.account} />
          <PreviewOrderTicket />
          <PositionsTable positions={snapshot.positions} />
          <OpenOrdersTable orders={snapshot.orders} />
        </>
      )}
    </main>
  );
}

function ConnectionBadge({ connected, syncing }: { connected: boolean; syncing: boolean }) {
  if (syncing) {
    return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Alpaca Syncing</Badge>;
  }
  if (connected) {
    return <Badge className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Alpaca Connected</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Alpaca Not Connected</Badge>;
}

function LoadingState() {
  return (
    <Card className="gradient-card border border-border shadow-card p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading Alpaca portfolio…
      </div>
    </Card>
  );
}

function AccountOverview({ account }: { account: PortfolioSuccess["data"]["account"] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <Metric label="Alpaca Connected" value={account.status || "ACTIVE"} tone="success" />
      <Metric label="Portfolio Value" value={formatUsd(account.portfolioValue, account.currency)} />
      <Metric label="Cash" value={formatUsd(account.cash, account.currency)} />
      <Metric label="Buying Power" value={formatUsd(account.buyingPower, account.currency)} />
      <div className="md:col-span-4">
        <Alert className="border-primary/30">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {ar ? "كل أوامر Buy/Sell أدناه Preview فقط حالياً، ولن يتم إرسال أي أمر حقيقي قبل تغيير LIVE_TRADING_ENABLED إلى true من السيرفر." : "Buy/Sell orders below are preview-only and will not be sent live until LIVE_TRADING_ENABLED is true on the server."}
          </AlertDescription>
        </Alert>
      </div>
    </section>
  );
}

function PreviewOrderTicket() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [preview, setPreview] = useState<PreviewOrder | null>(null);

  const normalizedSymbol = symbol.trim().toUpperCase();
  const qtyNumber = Number(qty);
  const limitNumber = Number(limitPrice);
  const usStockSymbol = /^[A-Z][A-Z0-9.-]{0,9}$/.test(normalizedSymbol);
  const invalid = !usStockSymbol || !(qtyNumber > 0) || (type === "limit" && !(limitNumber > 0));

  const notional = useMemo(() => {
    if (type !== "limit" || !(qtyNumber > 0) || !(limitNumber > 0)) return undefined;
    return qtyNumber * limitNumber;
  }, [limitNumber, qtyNumber, type]);

  const createPreview = () => {
    if (invalid) {
      toast.error(ar ? "أدخل رمز سهم أمريكي وكمية صحيحة." : "Enter a valid US stock symbol and quantity.");
      return;
    }
    const order = {
      symbol: normalizedSymbol,
      side,
      type,
      qty: qtyNumber,
      limitPrice: type === "limit" ? limitNumber : undefined,
    };
    setPreview(order);
    toast.success(ar ? "تم إنشاء Preview بدون تنفيذ حقيقي." : "Preview created without live execution.");
  };

  return (
    <Card className="gradient-card border border-border shadow-card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{ar ? "Buy/Sell Preview للأسهم الأمريكية" : "US Stock Buy/Sell Preview"}</h2>
        <Badge variant="outline" className="ms-auto">{ar ? "لا تنفيذ حقيقي" : "No live execution"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Field label={ar ? "الرمز" : "Symbol"}>
          <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="font-mono uppercase" maxLength={10} />
        </Field>
        <Field label={ar ? "الاتجاه" : "Side"}>
          <Select value={side} onValueChange={(value) => setSide(value as "buy" | "sell")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">{ar ? "شراء" : "Buy"}</SelectItem>
              <SelectItem value="sell">{ar ? "بيع" : "Sell"}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={ar ? "نوع الأمر" : "Order Type"}>
          <Select value={type} onValueChange={(value) => setType(value as "market" | "limit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="limit">Limit</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={ar ? "الكمية" : "Qty"}>
          <Input value={qty} onChange={(event) => setQty(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label={ar ? "سعر Limit" : "Limit Price"}>
          <Input value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} inputMode="decimal" disabled={type !== "limit"} />
        </Field>
      </div>

      {!usStockSymbol && <p className="text-xs text-destructive">{ar ? "يسمح برموز الأسهم الأمريكية فقط مثل AAPL أو MSFT." : "US stock symbols only, such as AAPL or MSFT."}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={createPreview} disabled={invalid}>{ar ? "إنشاء Preview" : "Create Preview"}</Button>
        {notional !== undefined && <span className="text-xs text-muted-foreground">{ar ? "القيمة التقريبية:" : "Estimated notional:"} {formatUsd(notional, "USD")}</span>}
      </div>

      {preview && (
        <Alert className="border-success/40">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {ar ? "Preview فقط:" : "Preview only:"} <strong className="font-mono uppercase">{preview.side} {preview.qty} {preview.symbol}</strong> — {preview.type.toUpperCase()}
            {preview.limitPrice ? ` @ ${formatUsd(preview.limitPrice, "USD")}` : ""}. {ar ? "لم يتم إرسال الأمر إلى Alpaca." : "The order was not sent to Alpaca."}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

function PositionsTable({ positions }: { positions: Position[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...positions];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [positions, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "symbol" ? "asc" : "desc"); }
  };

  const totalMV = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);

  const SortHeader = ({ k, children, align = "end" }: { k: SortKey; children: ReactNode; align?: "start" | "end" }) => (
    <th className={`px-3 py-2 text-${align}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <Card className="gradient-card border border-border shadow-card overflow-hidden p-0">
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-muted/50 to-transparent p-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold">{ar ? "Positions" : "Positions"}</h2>
          <Badge variant="outline">{positions.length}</Badge>
        </div>
        {positions.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{ar ? "إجمالي:" : "Total:"} <span className="font-mono font-semibold text-foreground">{formatUsd(totalMV, "USD")}</span></span>
            <span className={`font-mono font-semibold ${totalPnl < 0 ? "text-danger" : "text-success"}`}>
              {totalPnl >= 0 ? "▲" : "▼"} {formatUsd(totalPnl, "USD")}
            </span>
          </div>
        )}
      </header>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortHeader k="symbol" align="start">Symbol</SortHeader>
              <th className="px-3 py-2 text-end">Qty</th>
              <th className="px-3 py-2 text-end">Avg Entry</th>
              <th className="px-3 py-2 text-end">Current</th>
              <SortHeader k="marketValue">Market Value</SortHeader>
              <SortHeader k="unrealizedPnl">P&amp;L</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.map((position) => {
              const pnlPct = position.avgEntryPrice > 0 && position.qty > 0
                ? (position.unrealizedPnl / (position.avgEntryPrice * position.qty)) * 100
                : 0;
              const pnlPositive = position.unrealizedPnl >= 0;
              return (
                <tr key={position.symbol} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono font-bold tracking-wide">{position.symbol}</td>
                  <td className="px-3 py-2.5 text-end font-mono">{position.qty}</td>
                  <td className="px-3 py-2.5 text-end font-mono text-muted-foreground">{formatUsd(position.avgEntryPrice, "USD")}</td>
                  <td className="px-3 py-2.5 text-end font-mono">{formatUsd(position.currentPrice, "USD")}</td>
                  <td className="px-3 py-2.5 text-end font-mono font-medium">{formatUsd(position.marketValue, "USD")}</td>
                  <td className="px-3 py-2.5 text-end">
                    <div className={`inline-flex flex-col items-end rounded px-2 py-1 font-mono text-xs font-semibold ${pnlPositive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                      <span>{pnlPositive ? "+" : ""}{formatUsd(position.unrealizedPnl, "USD")}</span>
                      <span className="text-[10px] opacity-80">{pnlPositive ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">{ar ? "لا توجد Positions حالياً" : "No positions currently"}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


function OpenOrdersTable({ orders }: { orders: OpenOrder[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <Card className="gradient-card border border-border shadow-card p-0">
      <header className="flex items-center justify-between border-b border-border p-3">
        <h2 className="font-semibold">{ar ? "Open Orders" : "Open Orders"}</h2>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">Symbol</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-end">Qty</th>
              <th className="px-3 py-2 text-end">Limit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-start">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono font-semibold">{order.symbol}</td>
                <td className="px-3 py-2 uppercase">{order.side}</td>
                <td className="px-3 py-2 uppercase">{order.type}</td>
                <td className="px-3 py-2 text-end font-mono">{order.qty}</td>
                <td className="px-3 py-2 text-end font-mono">{order.limitPrice ? formatUsd(order.limitPrice, "USD") : "—"}</td>
                <td className="px-3 py-2"><Badge variant="outline">{order.status}</Badge></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{order.submittedAt ? new Date(order.submittedAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{ar ? "لا توجد Open Orders حالياً" : "No open orders currently"}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card className="hover-lift gradient-card border border-border shadow-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "success" ? "text-success" : ""}`}>{value}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs uppercase text-muted-foreground">{label}</Label>{children}</div>;
}

function formatUsd(value: number, currency: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
}
