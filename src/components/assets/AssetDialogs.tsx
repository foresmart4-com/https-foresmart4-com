import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import {
  addUserAsset, updateUserAsset, addManualCash,
  type AssetClass, type PricedAsset,
} from "@/lib/assets.functions";

const CLASS_LABELS_AR: Record<AssetClass, string> = {
  us_stock: "سهم أمريكي", sa_stock: "سهم سعودي", etf: "صندوق ETF",
  bond: "سند / صندوق سندات", crypto: "عملة رقمية", metal: "ذهب / معادن",
  commodity: "سلعة", cash: "كاش", other: "أخرى",
};

const CLASS_HINTS_AR: Record<AssetClass, string> = {
  us_stock: "مثل AAPL, MSFT, TSLA — تُسعّر من Alpaca/Finnhub",
  sa_stock: "أسهم تداول السعودية — تُسعّر من TwelveData",
  etf: "صناديق متداولة مثل SPY, QQQ, VOO",
  bond: "سندات وصناديق سندات مثل TLT, SHY, BND, AGG",
  crypto: "عملات رقمية مثل BTC, ETH — تُسعّر من Binance العام",
  metal: "الذهب والفضة وغيرها — تحديث يدوي للسعر",
  commodity: "نفط، غاز، سلع زراعية — تحديث يدوي",
  cash: "رصيد نقدي يدوي بأي عملة",
  other: "أصول أخرى لا تنتمي للفئات أعلاه",
};

function LabelWithHint({ id, label, hint }: { id: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground"><HelpCircle className="h-3.5 w-3.5" /></button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AddAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useServerFn(addUserAsset);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    asset_class: "us_stock" as AssetClass,
    symbol: "", name: "", quantity: "", avg_cost: "",
    currency: "USD", market: "", yield_pct: "", notes: "",
  });

  useEffect(() => { if (!open) setForm({ asset_class: "us_stock", symbol: "", name: "", quantity: "", avg_cost: "", currency: "USD", market: "", yield_pct: "", notes: "" }); }, [open]);

  async function submit() {
    setBusy(true);
    try {
      await add({ data: {
        asset_class: form.asset_class,
        symbol: form.symbol.trim(),
        name: form.name.trim() || null,
        quantity: Number(form.quantity) || 0,
        avg_cost: Number(form.avg_cost) || 0,
        currency: form.currency.trim() || "USD",
        market: form.market.trim() || null,
        yield_pct: form.yield_pct ? Number(form.yield_pct) : null,
        notes: form.notes.trim() || null,
      }});
      toast.success("تمت إضافة الأصل");
      qc.invalidateQueries({ queryKey: ["user-assets"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "تعذرت الإضافة");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة أصل يدوي</DialogTitle>
          <DialogDescription>أدخل تفاصيل الأصل لإضافته إلى محفظتك. لا يتم تنفيذ أي صفقة حقيقية.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <LabelWithHint id="asset_class" label="نوع الأصل" hint={CLASS_HINTS_AR[form.asset_class]} />
            <Select value={form.asset_class} onValueChange={(v) => setForm({ ...form, asset_class: v as AssetClass })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CLASS_LABELS_AR) as AssetClass[]).map((c) => (
                  <SelectItem key={c} value={c}>{CLASS_LABELS_AR[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="symbol" label="الرمز" hint="رمز التداول، مثل AAPL أو BTC أو 2222.SR" />
            <Input id="symbol" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="AAPL" />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="name" label="الاسم" hint="اسم الشركة أو الأصل للعرض" />
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Apple Inc." />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="qty" label="الكمية" hint="عدد الوحدات المملوكة (يقبل الكسور للكريبتو)" />
            <Input id="qty" type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="avg" label="متوسط الشراء" hint="متوسط سعر شراء الوحدة الواحدة بعملة الأصل" />
            <Input id="avg" type="number" step="any" value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="cur" label="العملة" hint="عملة التسعير، مثل USD أو SAR" />
            <Input id="cur" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="mkt" label="السوق" hint="السوق المُدرج فيه: US, SA, CRYPTO, METAL..." />
            <Input id="mkt" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="US" />
          </div>
          <div className="space-y-1.5">
            <LabelWithHint id="yld" label="العائد ٪ (اختياري)" hint="نسبة التوزيعات أو الفائدة السنوية. اتركه فارغاً إن لم يكن متوفراً." />
            <Input id="yld" type="number" step="any" value={form.yield_pct} onChange={(e) => setForm({ ...form, yield_pct: e.target.value })} placeholder="0" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={submit} disabled={busy || !form.symbol.trim()}>{busy ? "جارٍ..." : "إضافة"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditAssetDialog({ asset, onClose }: { asset: PricedAsset | null; onClose: () => void }) {
  const update = useServerFn(updateUserAsset);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ quantity: "", avg_cost: "", name: "", yield_pct: "", notes: "" });

  useEffect(() => {
    if (asset) setForm({
      quantity: String(asset.quantity),
      avg_cost: String(asset.avg_cost),
      name: asset.name ?? "",
      yield_pct: asset.yield_pct != null ? String(asset.yield_pct) : "",
      notes: asset.notes ?? "",
    });
  }, [asset]);

  async function submit() {
    if (!asset) return;
    setBusy(true);
    try {
      await update({ data: { id: asset.id, patch: {
        quantity: Number(form.quantity) || 0,
        avg_cost: Number(form.avg_cost) || 0,
        name: form.name || null,
        yield_pct: form.yield_pct ? Number(form.yield_pct) : null,
        notes: form.notes || null,
      }}});
      toast.success("تم تحديث الأصل");
      qc.invalidateQueries({ queryKey: ["user-assets"] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "تعذر التحديث");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!asset} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>تعديل {asset?.symbol}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الكمية</Label><Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>متوسط الشراء</Label><Input type="number" step="any" value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>العائد ٪</Label><Input type="number" step="any" value={form.yield_pct} onChange={(e) => setForm({ ...form, yield_pct: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>إلغاء</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "جارٍ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManualCashDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addCash = useServerFn(addManualCash);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "USD", kind: "deposit" as "deposit" | "withdrawal" | "adjustment", note: "" });

  async function submit() {
    setBusy(true);
    try {
      await addCash({ data: {
        amount: Number(form.amount) || 0,
        currency: form.currency || "USD",
        kind: form.kind,
        note: form.note || null,
      }});
      toast.success("تمت إضافة الحركة النقدية");
      qc.invalidateQueries({ queryKey: ["user-assets"] });
      setForm({ amount: "", currency: "USD", kind: "deposit", note: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "تعذرت الإضافة");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إيداع كاش يدوي</DialogTitle>
          <DialogDescription>هذه حركة دفترية فقط — لا يتم تحويل أموال فعلية.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>المبلغ</Label><Input type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5">
            <Label>النوع</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">إيداع</SelectItem>
                <SelectItem value="withdrawal">سحب</SelectItem>
                <SelectItem value="adjustment">تسوية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label>ملاحظة</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={submit} disabled={busy || !form.amount}>{busy ? "جارٍ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
