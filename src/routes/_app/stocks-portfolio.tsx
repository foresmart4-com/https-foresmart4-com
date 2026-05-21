import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Briefcase, CheckCircle2, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAlpacaPortfolio, type AlpacaPortfolioResult } from "@/lib/alpaca.server";
import { useI18n } from "@/lib/i18n";

const LIVE_TRADING_ENABLED = false;

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

export const Route = createFileRoute("/_app/stocks-portfolio")({
  head: () => ({
    meta: [
      { title: "Stocks Portfolio — ForeSmart" },
      { name: "description", content: "Alpaca paper portfolio, positions, open orders, and stock order previews." },
    ],
  }),
  component: StocksPortfolioPage,
});

function StocksPortfolioPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const fetchPortfolio = useServerFn(getAlpacaPortfolio);
  const [lastSyncState, setLastSyncState] = useState<"idle" | "syncing" | "connected" | "error">("idle");

  const portfolio = useQuery({
    queryKey: ["alpaca-portfolio"],
    queryFn: async () => {
      setLastSyncState("syncing");
      const result = await fetchPortfolio();
      setLastSyncState(result.ok ? "connected" : "error");
      return result;
    },
    refetchOnWindowFocus: false,
  });

  const snapshot = portfolio.data?.ok ? portfolio.data.data : null;
  const connected = Boolean(snapshot);
  const syncLabel = portfolio.isFetching
    ? ar ? "جارٍ مزامنة Alpaca..." : "Syncing Alpaca…"
    : ar ? "مزامنة Alpaca" : "Sync Alpaca";

  return (
    <main className="container mx-auto max-w-6xl space-y-6 p-6" dir={dir}>
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold">{ar ? "محفظة الأسهم" : "Stocks Portfolio"}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {ar ? "اتصال مباشر من السيرفر مع Alpaca Paper API بدون أي طلبات من الواجهة إلى Alpaca." : "Server-side Alpaca Paper API connection with no frontend requests to Alpaca."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionBadge connected={connected} syncing={portfolio.isFetching} lastSyncState={lastSyncState} />
          <Button variant="outline" onClick={() => portfolio.refetch()} disabled={portfolio.isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${portfolio.isFetching ? "animate-spin" : ""}`} />
            {syncLabel}
          </Button>
        </div>
      </header>

      <Alert className={connected ? "border-success/40" : "border-warning/40"}>
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertDescription className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">BROKER_PROVIDER=alpaca</Badge>
          <Badge variant={LIVE_TRADING_ENABLED ? "default" : "outline"}>
            {LIVE_TRADING_ENABLED ? (ar ? "التداول الحقيقي مفعّل" : "Live trading ON") : (ar ? "Preview فقط — التداول الحقيقي معطّل" : "Preview only — live trading disabled")}
          </Badge>
          {!connected && portfolio.data && !portfolio.data.ok && <span className="text-muted-foreground">{portfolio.data.error}</span>}
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

function ConnectionBadge({ connected, syncing, lastSyncState }: { connected: boolean; syncing: boolean; lastSyncState: "idle" | "syncing" | "connected" | "error" }) {
  if (syncing || lastSyncState === "syncing") {
    return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Alpaca Syncing</Badge>;
  }
  if (connected) {
    return <Badge className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Alpaca Connected</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Alpaca Not Connected</Badge>;
}

function LoadingState() {
  return (
    <Card className="p-6">
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
    <Card className="space-y-4 p-4">
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
  return (
    <Card className="p-0">
      <header className="flex items-center justify-between border-b border-border p-3">
        <h2 className="font-semibold">{ar ? "Positions" : "Positions"}</h2>
        <span className="text-xs text-muted-foreground">{positions.length}</span>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">Symbol</th>
              <th className="px-3 py-2 text-end">Qty</th>
              <th className="px-3 py-2 text-end">Avg Entry</th>
              <th className="px-3 py-2 text-end">Current</th>
              <th className="px-3 py-2 text-end">Market Value</th>
              <th className="px-3 py-2 text-end">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.symbol} className="border-t border-border">
                <td className="px-3 py-2 font-mono font-semibold">{position.symbol}</td>
                <td className="px-3 py-2 text-end font-mono">{position.qty}</td>
                <td className="px-3 py-2 text-end font-mono">{formatUsd(position.avgEntryPrice, "USD")}</td>
                <td className="px-3 py-2 text-end font-mono">{formatUsd(position.currentPrice, "USD")}</td>
                <td className="px-3 py-2 text-end font-mono">{formatUsd(position.marketValue, "USD")}</td>
                <td className={`px-3 py-2 text-end font-mono ${position.unrealizedPnl < 0 ? "text-destructive" : "text-success"}`}>{formatUsd(position.unrealizedPnl, "USD")}</td>
              </tr>
            ))}
            {positions.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{ar ? "لا توجد Positions حالياً" : "No positions currently"}</td></tr>}
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
    <Card className="p-0">
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
    <Card className="p-4">
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
