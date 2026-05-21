import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AssetPickerDialog, type PickedAsset } from "./AssetPickerDialog";
import { createPriceAlert } from "@/lib/price-alerts.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefilled?: PickedAsset | null;
  onDone?: () => void;
}

const CONDITION_LABELS = {
  price_above: "السعر أعلى من",
  price_below: "السعر أقل من",
  change_above: "تغير 24س أعلى من %",
  change_below: "تغير 24س أقل من %",
} as const;

export function CreateAlertDialog({ open, onOpenChange, prefilled, onDone }: Props) {
  const [picked, setPicked] = useState<PickedAsset | null>(prefilled ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [condition, setCondition] = useState<keyof typeof CONDITION_LABELS>("price_above");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const createFn = useServerFn(createPriceAlert);
  useEffect(() => { setPicked(prefilled ?? null); }, [prefilled]);

  const submit = async () => {
    if (!picked) { toast.error("اختر أصلاً أولاً"); return; }
    const v = Number(target);
    if (!Number.isFinite(v)) { toast.error("القيمة المستهدفة غير صحيحة"); return; }
    setBusy(true);
    try {
      await createFn({ data: {
        symbol: picked.symbol,
        name: picked.name,
        asset_type: picked.asset_type,
        market: picked.market,
        condition,
        target_value: v,
        note: note.trim() || undefined,
      }});
      toast.success("تم إنشاء التنبيه");
      setTarget(""); setNote("");
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء التنبيه");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء تنبيه سعر</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-border/40 bg-muted/20 p-2 flex items-center justify-between gap-2">
            {picked ? (
              <div className="text-sm flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{picked.symbol}</Badge>
                <span className="truncate">{picked.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">لم يتم اختيار أصل</span>
            )}
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>اختيار…</Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">الشرط</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABELS) as Array<keyof typeof CONDITION_LABELS>).map((k) => (
                  <SelectItem key={k} value={k}>{CONDITION_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">القيمة المستهدفة</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={condition.startsWith("change") ? "مثال: 5 (نسبة مئوية)" : "مثال: 100"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">ملاحظة (اختياري)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">إلغاء</Button>
            <Button onClick={submit} disabled={busy || !picked || !target} className="flex-1">حفظ التنبيه</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssetPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={setPicked} title="اختر أصلاً للتنبيه" />
    </>
  );
}
