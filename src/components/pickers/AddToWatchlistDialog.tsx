import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AssetPickerDialog, type PickedAsset } from "./AssetPickerDialog";
import { addWatchlistItem, createWatchlist, listWatchlists, type WatchlistRow } from "@/lib/watchlists.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefilled?: PickedAsset | null;
  onDone?: () => void;
}

export function AddToWatchlistDialog({ open, onOpenChange, prefilled, onDone }: Props) {
  const [lists, setLists] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<PickedAsset | null>(prefilled ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const listFn = useServerFn(listWatchlists);
  const createFn = useServerFn(createWatchlist);
  const addFn = useServerFn(addWatchlistItem);

  useEffect(() => { setPicked(prefilled ?? null); }, [prefilled]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listFn()
      .then((r) => setLists(r.watchlists))
      .catch(() => toast.error("تعذر تحميل القوائم"))
      .finally(() => setLoading(false));
  }, [open, listFn]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setBusy(true);
    try {
      const r = await createFn({ data: { name: newListName.trim() } });
      toast.success("تم إنشاء القائمة");
      setNewListName("");
      const refreshed = await listFn();
      setLists(refreshed.watchlists);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الإنشاء");
    } finally { setBusy(false); }
  };

  const handleAddTo = async (listId: string) => {
    if (!picked) { toast.error("اختر أصلاً أولاً"); return; }
    setBusy(true);
    try {
      await addFn({ data: {
        watchlist_id: listId,
        symbol: picked.symbol,
        name: picked.name,
        asset_type: picked.asset_type,
        market: picked.market,
      }});
      toast.success("تمت الإضافة إلى القائمة");
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      if (e?.message?.includes("ALREADY_EXISTS")) toast.error("الأصل موجود مسبقاً في هذه القائمة");
      else toast.error(e?.message ?? "تعذر الإضافة");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>أضف إلى قائمة المتابعة</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-border/40 bg-muted/20 p-2 flex items-center justify-between gap-2">
            {picked ? (
              <div className="text-sm flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{picked.symbol}</Badge>
                <span className="truncate">{picked.name}</span>
                <span className="text-[11px] text-muted-foreground">({picked.market})</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">لم يتم اختيار أصل</span>
            )}
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>اختيار…</Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">قوائمي</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : lists.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد قوائم بعد. أنشئ قائمة جديدة أدناه.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    disabled={busy || !picked}
                    onClick={() => handleAddTo(l.id)}
                    className="w-full flex items-center justify-between rounded-md border border-border/40 bg-card/40 hover:bg-card/80 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <span>{l.name}</span>
                    <span className="text-[11px] text-muted-foreground">{l.item_count} عنصر</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-3 space-y-2">
            <Label className="text-xs">أو أنشئ قائمة جديدة</Label>
            <div className="flex gap-2">
              <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="مثال: متابعة الأسهم السعودية" />
              <Button onClick={handleCreateList} disabled={busy || !newListName.trim()} size="sm">
                <Plus className="h-4 w-4 ml-1" /> إنشاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssetPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={setPicked} title="اختر أصلاً" />
    </>
  );
}
