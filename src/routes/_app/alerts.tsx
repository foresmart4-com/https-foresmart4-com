import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alerts")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل التنبيهات"><AlertsPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "التنبيهات الذكية — ForeSmart" },
      { name: "description", content: "تنبيهات الأسعار للأسهم والكريبتو والمعادن." },
    ],
  }),
});

interface LocalAlert {
  id: string;
  symbol: string;
  condition: "price_above" | "price_below" | "change_above" | "change_below";
  value: number;
  active: boolean;
  createdAt: string;
}

const COND_LABEL: Record<string, string> = {
  price_above: "السعر أعلى من",
  price_below: "السعر أقل من",
  change_above: "تغير ≥",
  change_below: "تغير ≤",
};

const STORAGE_KEY = "foresmart_alerts";

function loadAlerts(): LocalAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAlerts(alerts: LocalAlert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch {}
}

function AlertsPage() {
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", condition: "price_above" as LocalAlert["condition"], value: "" });

  useEffect(() => { setAlerts(loadAlerts()); }, []);

  const save = (next: LocalAlert[]) => { setAlerts(next); saveAlerts(next); };

  const create = () => {
    if (!form.symbol.trim() || !form.value) { toast.error("يرجى ملء جميع الحقول"); return; }
    const alert: LocalAlert = {
      id: `LA-${Date.now()}`,
      symbol: form.symbol.trim().toUpperCase(),
      condition: form.condition,
      value: Number(form.value),
      active: true,
      createdAt: new Date().toISOString(),
    };
    save([alert, ...alerts]);
    setForm({ symbol: "", condition: "price_above", value: "" });
    setCreateOpen(false);
    toast.success("تم إنشاء التنبيه");
  };

  const update = () => {
    if (!editId || !form.symbol.trim() || !form.value) return;
    save(alerts.map((a) => a.id === editId ? { ...a, symbol: form.symbol.trim().toUpperCase(), condition: form.condition, value: Number(form.value) } : a));
    setEditId(null);
    toast.success("تم التحديث");
  };

  const remove = (id: string) => { save(alerts.filter((a) => a.id !== id)); toast.success("تم الحذف"); };
  const toggle = (id: string) => { save(alerts.map((a) => a.id === id ? { ...a, active: !a.active } : a)); };

  const startEdit = (a: LocalAlert) => {
    setEditId(a.id);
    setForm({ symbol: a.symbol, condition: a.condition, value: String(a.value) });
  };

  return (
    <div dir="rtl" className="container mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> التنبيهات الذكية</h1>
          <p className="text-xs text-muted-foreground mt-1">إشارات مراقبة وليست توصية تداول. التنبيهات محفوظة محلياً.</p>
        </div>
        <Button onClick={() => { setForm({ symbol: "", condition: "price_above", value: "" }); setCreateOpen(true); }}><Plus className="h-4 w-4 ml-1" /> تنبيه جديد</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">الإجمالي</p><p className="text-2xl font-bold">{alerts.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">نشط</p><p className="text-2xl font-bold text-emerald-500">{alerts.filter((a) => a.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">متوقف</p><p className="text-2xl font-bold text-muted-foreground">{alerts.filter((a) => !a.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">الوضع</p><p className="text-sm font-medium text-amber-500">مراقبة محلية</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">قائمة التنبيهات</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">لا توجد تنبيهات بعد — أنشئ تنبيهًا لمراقبة سعر أصل معين.</p>
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> إنشاء أول تنبيه</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{a.symbol}</Badge>
                      <span className="text-sm">{COND_LABEL[a.condition]} {a.value}{a.condition.startsWith("change") ? "%" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={a.active} onCheckedChange={() => toggle(a.id)} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen || !!editId} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditId(null); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "تعديل التنبيه" : "تنبيه جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الرمز</Label><Input placeholder="AAPL, BTC, 2222.SR..." value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} /></div>
            <div>
              <Label className="text-xs">الشرط</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as LocalAlert["condition"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">القيمة</Label><Input type="number" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCreateOpen(false); setEditId(null); }}>إلغاء</Button>
              <Button className="flex-1" onClick={editId ? update : create}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
