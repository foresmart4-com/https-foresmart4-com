import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Eye, Bell, Wallet, Search, ArrowUpDown, RefreshCw, Loader2, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWatchlists, createWatchlist, renameWatchlist, deleteWatchlist,
  listWatchlistItems, addWatchlistItem, removeWatchlistItem,
  type WatchlistRow, type WatchlistItemRow,
} from "@/lib/watchlists.functions";
import { getUniversalQuote, type IntelDataMode } from "@/lib/universal-quote.functions";
import { AssetPickerDialog, type PickedAsset } from "@/components/pickers/AssetPickerDialog";
import { CreateAlertDialog } from "@/components/pickers/CreateAlertDialog";
import { addUserAsset } from "@/lib/assets.functions";

export const Route = createFileRoute("/_app/watchlists")({
  component: WatchlistsPage,
  head: () => ({
    meta: [
      { title: "قوائم المتابعة — ForeSmart" },
      { name: "description", content: "أنشئ قوائم متابعة متعددة وراقب الأصول دون إضافتها للمحفظة." },
    ],
  }),
});

const TYPE_LABEL: Record<string, string> = {
  US_STOCK: "أمريكي", SAUDI_STOCK: "سعودي", CRYPTO: "كريبتو",
  METAL: "معدن", COMMODITY: "سلعة", BOND: "سند", ETF: "صندوق", CASH: "نقد",
};

const TYPE_TO_CATEGORY: Record<string, "us_stock"|"sa_stock"|"crypto"|"metal"|"commodity"|"etf_bond"> = {
  US_STOCK: "us_stock", SAUDI_STOCK: "sa_stock", CRYPTO: "crypto",
  METAL: "metal", COMMODITY: "commodity", BOND: "etf_bond", ETF: "etf_bond",
};

interface Quote { price: number; changePct: number; source: string; mode: IntelDataMode; fetchedAt: number; error?: string; }

function ModeBadge({ mode }: { mode: IntelDataMode | "error" }) {
  const map: Record<string, { label: string; cls: string }> = {
    live:    { label: "Live",    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    delayed: { label: "Delayed", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
    manual:  { label: "Manual",  cls: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
    mock:    { label: "Mock",    cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
    error:   { label: "Error",   cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  };
  const m = map[mode] ?? map.mock;
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}

function WatchlistsPage() {
  const navigate = useNavigate();
  const listsFn = useServerFn(listWatchlists);
  const createFn = useServerFn(createWatchlist);
  const renameFn = useServerFn(renameWatchlist);
  const deleteFn = useServerFn(deleteWatchlist);
  const itemsFn = useServerFn(listWatchlistItems);
  const addFn = useServerFn(addWatchlistItem);
  const removeFn = useServerFn(removeWatchlistItem);
  const quoteFn = useServerFn(getUniversalQuote);
  const addAssetFn = useServerFn(addUserAsset);

  const [lists, setLists] = useState<WatchlistRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<WatchlistItemRow[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [renameOpen, setRenameOpen] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelList, setConfirmDelList] = useState<WatchlistRow | null>(null);
  const [confirmDelItem, setConfirmDelItem] = useState<WatchlistItemRow | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; asset: PickedAsset | null }>({ open: false, asset: null });

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterMarket, setFilterMarket] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"name"|"change"|"price"|"updated">("updated");

  const loadLists = async () => {
    setLoadingLists(true);
    try {
      const r = await listsFn();
      setLists(r.watchlists);
      if (!activeId && r.watchlists[0]) setActiveId(r.watchlists[0].id);
    } catch (e: any) { toast.error(e?.message ?? "تعذر تحميل القوائم"); }
    finally { setLoadingLists(false); }
  };

  const loadItems = async (id: string) => {
    setLoadingItems(true);
    try {
      const r = await itemsFn({ data: { watchlist_id: id } });
      setItems(r.items);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحميل العناصر");
      setItems([]);
    } finally { setLoadingItems(false); }
  };

  const refreshQuotes = async (rows: WatchlistItemRow[]) => {
    setLoadingQuotes(true);
    const next: Record<string, Quote> = { ...quotes };
    await Promise.all(rows.map(async (it) => {
      if (it.asset_type === "CASH") {
        next[it.id] = { price: 1, changePct: 0, source: "manual", mode: "manual", fetchedAt: Date.now() };
        return;
      }
      const cat = TYPE_TO_CATEGORY[it.asset_type];
      if (!cat) return;
      try {
        const q = await quoteFn({ data: { category: cat, symbol: it.symbol, name: it.name ?? it.symbol } });
        if (!Number.isFinite(q.price) || q.price <= 0) {
          next[it.id] = { price: 0, changePct: 0, source: q.source, mode: "manual", fetchedAt: q.fetchedAt, error: "السعر غير متاح من المزود" };
        } else {
          next[it.id] = { price: q.price, changePct: q.changePct, source: q.source, mode: q.mode, fetchedAt: q.fetchedAt };
        }
      } catch (e: any) {
        next[it.id] = { price: 0, changePct: 0, source: "—", mode: "manual", fetchedAt: Date.now(), error: e?.message ?? "تعذر جلب السعر" };
      }
    }));
    setQuotes(next);
    setLoadingQuotes(false);
  };

  useEffect(() => { loadLists(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (activeId) loadItems(activeId); /* eslint-disable-next-line */ }, [activeId]);
  useEffect(() => { if (items.length) refreshQuotes(items); /* eslint-disable-next-line */ }, [items]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const r = await createFn({ data: { name: newListName.trim() } });
      toast.success("تم إنشاء القائمة");
      setNewListName("");
      await loadLists();
      if (r.watchlist?.id) setActiveId(r.watchlist.id);
    } catch (e: any) { toast.error(e?.message ?? "تعذر الإنشاء"); }
  };

  const handleRename = async () => {
    if (!renameOpen) return;
    try {
      await renameFn({ data: { id: renameOpen.id, name: renameOpen.name.trim() } });
      toast.success("تم التعديل");
      setRenameOpen(null);
      loadLists();
    } catch (e: any) { toast.error(e?.message ?? "تعذر التعديل"); }
  };

  const handleDeleteList = async () => {
    if (!confirmDelList) return;
    try {
      await deleteFn({ data: { id: confirmDelList.id } });
      toast.success("تم الحذف");
      setConfirmDelList(null);
      if (activeId === confirmDelList.id) setActiveId(null);
      loadLists();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
  };

  const handleDeleteItem = async () => {
    if (!confirmDelItem) return;
    try {
      await removeFn({ data: { id: confirmDelItem.id } });
      toast.success("تم الحذف");
      setItems((x) => x.filter((y) => y.id !== confirmDelItem.id));
      setConfirmDelItem(null);
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
  };

  const handlePick = async (a: PickedAsset) => {
    if (!activeId) { toast.error("اختر قائمة أولاً"); return; }
    try {
      await addFn({ data: { watchlist_id: activeId, symbol: a.symbol, name: a.name, asset_type: a.asset_type, market: a.market } });
      toast.success("تمت الإضافة");
      loadItems(activeId);
    } catch (e: any) {
      if (e?.message?.includes("ALREADY_EXISTS")) toast.error("الأصل موجود مسبقاً في القائمة");
      else toast.error(e?.message ?? "تعذر الإضافة");
    }
  };

  const addToPortfolio = async (it: WatchlistItemRow) => {
    const q = quotes[it.id];
    try {
      await addAssetFn({ data: {
        symbol: it.symbol,
        name: it.name ?? it.symbol,
        asset_class: it.asset_type.toLowerCase() as any,
        quantity: 0,
        avg_cost: q?.price ?? 0,
        currency: "USD",
      } as any });
      toast.success("تمت الإضافة إلى محفظتك");
    } catch (e: any) { toast.error(e?.message ?? "تعذر الإضافة للمحفظة"); }
  };

  const filteredItems = useMemo(() => {
    let arr = items.slice();
    const ql = search.trim().toLowerCase();
    if (ql) arr = arr.filter((i) => i.symbol.toLowerCase().includes(ql) || (i.name ?? "").toLowerCase().includes(ql));
    if (filterType !== "ALL") arr = arr.filter((i) => i.asset_type === filterType);
    if (filterMarket !== "ALL") arr = arr.filter((i) => (i.market ?? "") === filterMarket);
    arr.sort((a, b) => {
      const qa = quotes[a.id], qb = quotes[b.id];
      if (sortBy === "name") return (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol);
      if (sortBy === "price") return (qb?.price ?? 0) - (qa?.price ?? 0);
      if (sortBy === "change") return (qb?.changePct ?? -Infinity) - (qa?.changePct ?? -Infinity);
      return (qb?.fetchedAt ?? 0) - (qa?.fetchedAt ?? 0);
    });
    return arr;
  }, [items, quotes, search, filterType, filterMarket, sortBy]);

  const markets = useMemo(() => Array.from(new Set(items.map((i) => i.market).filter(Boolean))) as string[], [items]);
  const activeList = lists.find((l) => l.id === activeId);

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" /> قوائم المتابعة
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            قوائم المتابعة تساعدك على مراقبة الأصول دون إضافتها إلى المحفظة.
          </p>
        </div>
        <div className="flex gap-2">
          <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="اسم قائمة جديدة" className="w-56" />
          <Button onClick={handleCreateList} disabled={!newListName.trim()}>
            <Plus className="h-4 w-4 ml-1" /> إنشاء قائمة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar lists */}
        <Card className="col-span-12 md:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">قوائمي</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {loadingLists ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : lists.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">لا توجد قوائم بعد</p>
            ) : lists.map((l) => (
              <div key={l.id} className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${activeId === l.id ? "border-primary bg-primary/10" : "border-border/40"}`}>
                <button onClick={() => setActiveId(l.id)} className="flex-1 text-right text-sm truncate">
                  {l.name} <span className="text-[10px] text-muted-foreground">({l.item_count})</span>
                </button>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRenameOpen({ id: l.id, name: l.name })}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger><TooltipContent>تعديل الاسم</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-rose-500" onClick={() => setConfirmDelList(l)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger><TooltipContent>حذف القائمة</TooltipContent></Tooltip>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Items panel */}
        <Card className="col-span-12 md:col-span-9">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{activeList?.name ?? "اختر قائمة"}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => activeId && refreshQuotes(items)} disabled={!activeId || loadingQuotes}>
                <RefreshCw className={`h-4 w-4 ml-1 ${loadingQuotes ? "animate-spin" : ""}`} /> تحديث الأسعار
              </Button>
              <Button size="sm" onClick={() => setPickerOpen(true)} disabled={!activeId}>
                <Plus className="h-4 w-4 ml-1" /> إضافة أصل
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!activeId ? (
              <p className="text-center text-sm text-muted-foreground py-8">اختر أو أنشئ قائمة لعرض الأصول.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث…" className="pr-8 h-9" />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 w-32"><SelectValue placeholder="النوع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">كل الأنواع</SelectItem>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterMarket} onValueChange={setFilterMarket}>
                    <SelectTrigger className="h-9 w-32"><SelectValue placeholder="السوق" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">كل الأسواق</SelectItem>
                      {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9 w-36"><ArrowUpDown className="h-3 w-3 ml-1" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">آخر تحديث</SelectItem>
                      <SelectItem value="name">الاسم</SelectItem>
                      <SelectItem value="price">السعر</SelectItem>
                      <SelectItem value="change">التغير %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingItems ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredItems.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {items.length === 0 ? "هذه القائمة فارغة — أضف أول أصل." : "لا نتائج للفلتر الحالي."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-muted-foreground">
                        <tr className="border-b border-border/40">
                          <th className="text-right p-2">الرمز</th>
                          <th className="text-right p-2">الاسم</th>
                          <th className="text-right p-2">النوع</th>
                          <th className="text-right p-2">السوق</th>
                          <th className="text-right p-2">السعر</th>
                          <th className="text-right p-2">التغير %</th>
                          <th className="text-right p-2">المصدر</th>
                          <th className="text-right p-2">الحالة</th>
                          <th className="text-right p-2">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((it) => {
                          const q = quotes[it.id];
                          const mode: IntelDataMode | "error" = q?.error ? "error" : (q?.mode ?? "manual");
                          return (
                            <tr key={it.id} className="border-b border-border/20 hover:bg-muted/30">
                              <td className="p-2 font-mono text-xs">{it.symbol}</td>
                              <td className="p-2 truncate max-w-[160px]">{it.name ?? "—"}</td>
                              <td className="p-2 text-xs">{TYPE_LABEL[it.asset_type] ?? it.asset_type}</td>
                              <td className="p-2 text-xs text-muted-foreground">{it.market ?? "—"}</td>
                              <td className="p-2 tabular-nums">{q?.price ? q.price.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</td>
                              <td className={`p-2 tabular-nums ${q?.changePct ? (q.changePct >= 0 ? "text-emerald-500" : "text-rose-500") : ""}`}>
                                {q && Number.isFinite(q.changePct) ? `${q.changePct.toFixed(2)}%` : "—"}
                              </td>
                              <td className="p-2 text-xs text-muted-foreground">{q?.source ?? "—"}</td>
                              <td className="p-2">
                                <Tooltip><TooltipTrigger asChild><span><ModeBadge mode={mode} /></span></TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">{q?.error ?? (q ? `آخر تحديث: ${new Date(q.fetchedAt).toLocaleTimeString()}` : "لم يُجلب بعد")}</TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="p-2">
                                <div className="flex gap-1">
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addToPortfolio(it)}>
                                      <Wallet className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>أضف إلى المحفظة</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate({ to: "/market-intelligence", search: { symbol: it.symbol } as any })}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>افتح في ذكاء السوق</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAlertDialog({ open: true, asset: {
                                      symbol: it.symbol, name: it.name ?? it.symbol, asset_type: it.asset_type, market: it.market ?? "",
                                      category: TYPE_TO_CATEGORY[it.asset_type] ?? "us_stock",
                                    }})}>
                                      <Bell className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>أنشئ تنبيه سعر</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setConfirmDelItem(it)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>حذف من القائمة</TooltipContent></Tooltip>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        المنصة تحليلية فقط ولا تنفذ عمليات تداول حقيقية. <Link to="/disclaimer" className="underline">إخلاء المسؤولية</Link>
      </p>

      {/* Picker for adding into active list */}
      <AssetPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePick} title="إضافة أصل إلى القائمة" />

      {/* Alert dialog */}
      <CreateAlertDialog open={alertDialog.open} onOpenChange={(o) => setAlertDialog((x) => ({ ...x, open: o }))} prefilled={alertDialog.asset} />

      {/* Rename modal */}
      <AlertDialog open={!!renameOpen} onOpenChange={(o) => !o && setRenameOpen(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تعديل اسم القائمة</AlertDialogTitle>
            <AlertDialogDescription>أدخل اسماً جديداً للقائمة.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameOpen?.name ?? ""} onChange={(e) => setRenameOpen((x) => x ? { ...x, name: e.target.value } : x)} />
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename}>حفظ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete list confirm */}
      <AlertDialog open={!!confirmDelList} onOpenChange={(o) => !o && setConfirmDelList(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القائمة</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف القائمة "{confirmDelList?.name}" وجميع عناصرها. لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteList}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete item confirm */}
      <AlertDialog open={!!confirmDelItem} onOpenChange={(o) => !o && setConfirmDelItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الأصل من القائمة</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف "{confirmDelItem?.symbol}" من القائمة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteItem}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
