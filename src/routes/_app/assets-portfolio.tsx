import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Briefcase, Plus, Wallet, Sparkles, RefreshCw, Pencil, Trash2,
  ShieldAlert, TrendingUp, TrendingDown, Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import {
  listUserAssets, deleteUserAsset, seedDemoBalance,
  type AssetClass, type PricedAsset,
} from "@/lib/assets.functions";
import { DataModeBadge } from "@/components/assets/DataModeBadge";
import { AddAssetDialog, EditAssetDialog, ManualCashDialog } from "@/components/assets/AssetDialogs";

const LIVE_TRADING_ENABLED = false;
const AUTO_REFRESH_MS = 60_000;

const CLASS_AR: Record<AssetClass, string> = {
  us_stock: "أسهم أمريكية", sa_stock: "أسهم سعودية", etf: "ETFs",
  bond: "سندات", crypto: "كريبتو", metal: "معادن",
  commodity: "سلع", cash: "كاش", other: "أخرى",
};

const TABS: { key: string; label: string; classes: AssetClass[] }[] = [
  { key: "all", label: "الكل", classes: [] },
  { key: "stocks", label: "أسهم", classes: ["us_stock", "sa_stock"] },
  { key: "etfs", label: "ETFs", classes: ["etf"] },
  { key: "bonds", label: "سندات", classes: ["bond"] },
  { key: "crypto", label: "كريبتو", classes: ["crypto"] },
  { key: "metals", label: "معادن وسلع", classes: ["metal", "commodity"] },
  { key: "cash", label: "كاش", classes: ["cash"] },
];

export const Route = createFileRoute("/_app/assets-portfolio")({
  head: () => ({
    meta: [
      { title: "محفظة الأصول الشاملة — ForeSmart" },
      { name: "description", content: "Universal portfolio for stocks, ETFs, bonds, crypto, metals, and cash." },
    ],
  }),
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><AssetsPortfolioPage /></ErrorBoundary>,
});

function HeaderHint({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1">{children}<Info className="h-3 w-3 text-muted-foreground" /></span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function AssetsPortfolioPage() {
  const { dir } = useI18n();
  const list = useServerFn(listUserAssets);
  const del = useServerFn(deleteUserAsset);
  const seed = useServerFn(seedDemoBalance);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<PricedAsset | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const q = useQuery({
    queryKey: ["user-assets"],
    queryFn: () => list(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { qc.invalidateQueries({ queryKey: ["user-assets"] }); }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, qc]);

  const assets = q.data?.assets ?? [];
  const totals = q.data?.totals ?? { value: 0, cost: 0, pnl: 0, cash: 0 };

  const allocation = useMemo(() => {
    const map = new Map<AssetClass, number>();
    assets.forEach((a) => map.set(a.asset_class, (map.get(a.asset_class) || 0) + a.marketValue));
    const total = totals.value || 1;
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [assets, totals.value]);

  async function onDelete(a: PricedAsset) {
    if (!confirm(`حذف ${a.symbol}؟`)) return;
    try {
      await del({ data: { id: a.id } });
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["user-assets"] });
    } catch (e: any) { toast.error(e?.message || "تعذر الحذف"); }
  }

  async function onSeed() {
    try {
      await seed();
      toast.success("تم تحميل البيانات التجريبية");
      qc.invalidateQueries({ queryKey: ["user-assets"] });
    } catch (e: any) { toast.error(e?.message || "تعذر التحميل"); }
  }

  function filterForTab(tab: string): PricedAsset[] {
    const t = TABS.find((x) => x.key === tab);
    if (!t || t.classes.length === 0) return assets;
    return assets.filter((a) => t.classes.includes(a.asset_class));
  }

  return (
    <div dir={dir} className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">محفظة الأصول الشاملة</h1>
            <p className="text-sm text-muted-foreground">
              تابع كل أصولك من سوق واحد ولوحة واحدة — أسهم، ETFs، سندات، كريبتو، معادن، وكاش — مع حساب فوري للأرباح والخسائر والتنويع.
            </p>
          </div>
        </div>
      </div>

      {/* Live trading banner */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm">
          <strong>التداول الحقيقي معطّل — معاينة فقط.</strong> الإضافة والتعديل تؤثر على محفظتك الدفترية فقط ولا تُنفذ أي صفقات على وسطاء حقيقيين.
        </AlertDescription>
      </Alert>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="إجمالي القيمة" value={`$${fmt(totals.value)}`} hint="مجموع القيمة السوقية الحالية لكل أصولك بعملة الأساس USD" />
        <SummaryCard label="الكاش" value={`$${fmt(totals.cash)}`} hint="إجمالي الأرصدة النقدية اليدوية" />
        <SummaryCard label="إجمالي الربح/الخسارة" value={`${totals.pnl >= 0 ? "+" : ""}$${fmt(totals.pnl)}`} valueClass={totals.pnl >= 0 ? "text-emerald-600" : "text-rose-600"} hint="الفرق بين القيمة الحالية وتكلفة الشراء الإجمالية" />
        <SummaryCard label="عدد الأصول" value={String(assets.length)} hint="عدد الأصول النشطة في محفظتك" />
      </div>

      {/* Allocation */}
      {allocation.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span>توزيع الأصول</span>
            <HeaderHint hint="نسبة كل تصنيف من إجمالي قيمة المحفظة — مؤشر على التنويع">
              <span />
            </HeaderHint>
          </div>
          <div className="space-y-2">
            {allocation.map((a) => (
              <div key={a.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{CLASS_AR[a.key]}</span>
                  <span className="font-mono text-muted-foreground">${fmt(a.value)} · {fmt(a.pct, 1)}%</span>
                </div>
                <Progress value={a.pct} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)}><Plus className="me-1.5 h-4 w-4" />إضافة أصل</Button>
        <Button variant="outline" onClick={() => setCashOpen(true)}><Wallet className="me-1.5 h-4 w-4" />إيداع كاش يدوي</Button>
        <Button variant="outline" onClick={onSeed}><Sparkles className="me-1.5 h-4 w-4" />تحميل رصيد تجريبي</Button>
        <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["user-assets"] })} disabled={q.isFetching}>
          <RefreshCw className={`me-1.5 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />تحديث الأسعار
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <Switch id="auto" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Label htmlFor="auto" className="cursor-pointer text-sm">تحديث تلقائي كل 60 ثانية</Label>
        </div>
      </div>

      {/* Tabs + table */}
      <Card className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-2">
            <TabsList className="h-auto flex-wrap bg-transparent p-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="m-0">
              <AssetsTable
                assets={filterForTab(t.key)}
                loading={q.isLoading}
                onEdit={setEditAsset}
                onDelete={onDelete}
              />
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* Broker linking cards */}
      <Card className="p-4">
        <div className="mb-3 text-sm font-semibold">ربط البروكر (اختياري — لاحقاً)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { name: "Binance", desc: "كريبتو فقط — يستورد أرصدتك تلقائياً" },
            { name: "Alpaca", desc: "أسهم وETFs الأمريكية (Paper/Live)" },
            { name: "IBKR", desc: "أسواق عالمية متعددة (Client Portal API)" },
          ].map((b) => (
            <div key={b.name} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{b.name}</span>
                <Badge variant="outline" className="text-[10px]">غير مربوط</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
              <Button size="sm" variant="outline" className="mt-2 w-full" disabled>ربط لاحقاً</Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">الربط يستورد المراكز كقراءة فقط. لا تتأثر أصولك اليدوية.</p>
      </Card>

      <AddAssetDialog open={addOpen} onOpenChange={setAddOpen} />
      <ManualCashDialog open={cashOpen} onOpenChange={setCashOpen} />
      <EditAssetDialog asset={editAsset} onClose={() => setEditAsset(null)} />
    </div>
  );
}

function SummaryCard({ label, value, hint, valueClass = "" }: { label: string; value: string; hint: string; valueClass?: string }) {
  return (
    <Card className="p-4">
      <HeaderHint hint={hint}>
        <span className="text-xs text-muted-foreground">{label}</span>
      </HeaderHint>
      <div className={`mt-1 font-mono text-2xl font-bold ${valueClass}`}>{value}</div>
    </Card>
  );
}

function AssetsTable({ assets, loading, onEdit, onDelete }: {
  assets: PricedAsset[]; loading: boolean;
  onEdit: (a: PricedAsset) => void; onDelete: (a: PricedAsset) => void;
}) {
  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (assets.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">لا توجد أصول — أضف أصلاً يدوياً أو حمّل رصيداً تجريبياً للبدء.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs">
          <tr>
            <Th>الرمز</Th>
            <Th><HeaderHint hint="تصنيف الأصل وفقاً للسوق">النوع</HeaderHint></Th>
            <Th>السوق</Th>
            <Th><HeaderHint hint="عدد الوحدات المملوكة">الكمية</HeaderHint></Th>
            <Th><HeaderHint hint="متوسط سعر شراء الوحدة الواحدة">متوسط الشراء</HeaderHint></Th>
            <Th><HeaderHint hint="السعر السوقي اللحظي حسب المصدر">السعر الحالي</HeaderHint></Th>
            <Th><HeaderHint hint="القيمة السوقية = الكمية × السعر الحالي">القيمة</HeaderHint></Th>
            <Th><HeaderHint hint="الربح/الخسارة بالعملة والنسبة المئوية">الربح/الخسارة</HeaderHint></Th>
            <Th><HeaderHint hint="التوزيعات/الفوائد السنوية المتوقعة إن وُجدت">العائد ٪</HeaderHint></Th>
            <Th><HeaderHint hint="مصدر السعر: حي / متأخر / يدوي / تجريبي">المصدر</HeaderHint></Th>
            <Th>إجراءات</Th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-t border-border/60 hover:bg-muted/20">
              <Td><span className="font-mono font-semibold">{a.symbol}</span>{a.name && <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{a.name}</div>}</Td>
              <Td className="text-xs">{CLASS_AR[a.asset_class]}</Td>
              <Td className="text-xs text-muted-foreground">{a.market || "—"}</Td>
              <Td className="font-mono text-xs">{fmt(a.quantity, 4)}</Td>
              <Td className="font-mono text-xs">{fmt(a.avg_cost)}</Td>
              <Td className="font-mono text-xs">{fmt(a.currentPrice)}</Td>
              <Td className="font-mono text-xs">${fmt(a.marketValue)}</Td>
              <Td className={`font-mono text-xs ${a.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                <div className="flex items-center gap-1">
                  {a.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{a.pnl >= 0 ? "+" : ""}${fmt(a.pnl)} ({fmt(a.pnlPct, 1)}%)</span>
                </div>
              </Td>
              <Td className="font-mono text-xs">{a.yield_pct != null ? `${fmt(a.yield_pct, 1)}%` : "—"}</Td>
              <Td><DataModeBadge mode={a.priceMode} /></Td>
              <Td>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => onDelete(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="p-2 text-start font-medium">{children}</th>;
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <td className={`p-2 ${className}`}>{children}</td>;

// Mount dialogs as part of the page tree
function _Dialogs() { return null; }

// Wrap the page with dialog mounts in the existing component above via portal-friendly rendering
export { AddAssetDialog, EditAssetDialog, ManualCashDialog };
