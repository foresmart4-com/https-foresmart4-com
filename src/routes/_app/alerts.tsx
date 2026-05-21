import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bell, Plus, Trash2, Pencil, RefreshCw, Loader2, CheckCircle2, AlertTriangle,
  Pause, Play, MessageSquare, Mail, MessageCircle, Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  listPriceAlerts, deletePriceAlert, togglePriceAlert,
  updatePriceAlert, checkPriceAlertNow, checkAllPriceAlerts,
  type PriceAlertRow, type AlertCondition,
} from "@/lib/price-alerts.functions";
import { CreateAlertDialog } from "@/components/pickers/CreateAlertDialog";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
  head: () => ({
    meta: [
      { title: "التنبيهات الذكية — ForeSmart" },
      { name: "description", content: "تنبيهات الأسعار للأسهم والكريبتو والمعادن مع فحص يدوي وسجل أحداث." },
    ],
  }),
});

const CONDITION_LABEL: Record<AlertCondition, string> = {
  price_above: "السعر أعلى من",
  price_below: "السعر أقل من",
  change_above: "تغير 24س ≥",
  change_below: "تغير 24س ≤",
};

const TYPE_LABEL: Record<string, string> = {
  US_STOCK: "أمريكي", SAUDI_STOCK: "سعودي", CRYPTO: "كريبتو",
  METAL: "معدن", COMMODITY: "سلعة", BOND: "سند", ETF: "صندوق", CASH: "نقد",
};

function StatusBadge({ s }: { s: PriceAlertRow["last_status"] }) {
  if (s === "triggered") return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">تحقق</Badge>;
  if (s === "failed") return <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30" variant="outline">فشل</Badge>;
  if (s === "no_change") return <Badge className="bg-slate-500/15 text-slate-500 border-slate-500/30" variant="outline">لا تغير</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">قيد الانتظار</Badge>;
}

function AlertsPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listPriceAlerts);
  const deleteFn = useServerFn(deletePriceAlert);
  const toggleFn = useServerFn(togglePriceAlert);
  const updateFn = useServerFn(updatePriceAlert);
  const checkOneFn = useServerFn(checkPriceAlertNow);
  const checkAllFn = useServerFn(checkAllPriceAlerts);

  const [alerts, setAlerts] = useState<PriceAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editAlert, setEditAlert] = useState<PriceAlertRow | null>(null);
  const [editForm, setEditForm] = useState({ condition: "price_above" as AlertCondition, target_value: "", note: "" });
  const [confirmDel, setConfirmDel] = useState<PriceAlertRow | null>(null);

  // Email channel availability — server-side only. We surface a hint via VITE flag if present, otherwise default to false.
  const emailEnabled = false; // backend integration optional; surface as "غير مفعّلة" until wired

  const load = async () => {
    setLoading(true);
    try {
      const r = await listFn();
      setAlerts(r.alerts);
    } catch (e: any) { toast.error(e?.message ?? "تعذر تحميل التنبيهات"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggle = async (a: PriceAlertRow) => {
    setBusyId(a.id);
    try {
      await toggleFn({ data: { id: a.id, enabled: !a.enabled } });
      setAlerts((x) => x.map((y) => y.id === a.id ? { ...y, enabled: !a.enabled } : y));
    } catch (e: any) { toast.error(e?.message ?? "تعذر التغيير"); }
    finally { setBusyId(null); }
  };

  const checkOne = async (a: PriceAlertRow) => {
    setBusyId(a.id);
    try {
      const r = await checkOneFn({ data: { id: a.id } });
      if (r.status === "triggered") toast.success(`تحقق التنبيه — ${r.message}`);
      else if (r.status === "failed") toast.error(r.message);
      else toast(r.message);
      load();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الفحص"); }
    finally { setBusyId(null); }
  };

  const checkAll = async () => {
    setCheckingAll(true);
    try {
      const r = await checkAllFn();
      toast.success(`تم فحص ${r.checked} — محقق: ${r.triggered}، فشل: ${r.failed}`);
      load();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الفحص"); }
    finally { setCheckingAll(false); }
  };

  const startEdit = (a: PriceAlertRow) => {
    setEditAlert(a);
    setEditForm({ condition: a.condition, target_value: String(a.target_value), note: a.note ?? "" });
  };

  const saveEdit = async () => {
    if (!editAlert) return;
    const v = Number(editForm.target_value);
    if (!Number.isFinite(v)) { toast.error("القيمة غير صحيحة"); return; }
    try {
      await updateFn({ data: { id: editAlert.id, condition: editForm.condition, target_value: v, note: editForm.note.trim() || null } });
      toast.success("تم التحديث");
      setEditAlert(null);
      load();
    } catch (e: any) { toast.error(e?.message ?? "تعذر التحديث"); }
  };

  const remove = async () => {
    if (!confirmDel) return;
    try {
      await deleteFn({ data: { id: confirmDel.id } });
      toast.success("تم الحذف");
      setAlerts((x) => x.filter((y) => y.id !== confirmDel.id));
      setConfirmDel(null);
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
  };

  const sendTestNotification = (a: PriceAlertRow) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") new Notification("تنبيه تجريبي — ForeSmart", { body: `${a.symbol} • ${CONDITION_LABEL[a.condition]} ${a.target_value}` });
          else toast("سيتم العرض داخل التطبيق فقط — لم يتم منح إذن الإشعارات");
        });
      } else {
        new Notification("تنبيه تجريبي — ForeSmart", { body: `${a.symbol} • ${CONDITION_LABEL[a.condition]} ${a.target_value}` });
      }
    }
    toast.success("تم إرسال تنبيه تجريبي");
  };

  const stats = useMemo(() => ({
    active: alerts.filter((a) => a.enabled).length,
    triggered: alerts.filter((a) => a.last_status === "triggered").length,
    failed: alerts.filter((a) => a.last_status === "failed").length,
    paused: alerts.filter((a) => !a.enabled).length,
  }), [alerts]);

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> التنبيهات الذكية
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            التنبيهات تساعدك على مراقبة السعر، ولا تنفذ أي أوامر تداول.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkAll} disabled={checkingAll || alerts.length === 0}>
            <RefreshCw className={`h-4 w-4 ml-1 ${checkingAll ? "animate-spin" : ""}`} /> فحص كل التنبيهات
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> تنبيه جديد</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "نشط", v: stats.active, c: "text-emerald-500" },
          { l: "تحقق", v: stats.triggered, c: "text-primary" },
          { l: "فشل", v: stats.failed, c: "text-rose-500" },
          { l: "متوقف", v: stats.paused, c: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.l}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Channels */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">قنوات التنبيه</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"><MessageSquare className="h-3 w-3" /> داخل التطبيق — مفعّل</Badge>
          <Badge variant="outline" className={`gap-1 ${emailEnabled ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "text-muted-foreground"}`}>
            <Mail className="h-3 w-3" /> البريد — {emailEnabled ? "مفعّل" : "قناة البريد غير مفعّلة"}
          </Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground"><MessageCircle className="h-3 w-3" /> SMS — لاحقاً</Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground"><MessageCircle className="h-3 w-3" /> WhatsApp — لاحقاً</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">قائمة التنبيهات</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">لا توجد تنبيهات بعد — أنشئ تنبيهًا لمتابعة سعر أصل معين.</p>
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> إنشاء أول تنبيه</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="text-right p-2">الأصل</th>
                    <th className="text-right p-2">النوع</th>
                    <th className="text-right p-2">الشرط</th>
                    <th className="text-right p-2">الهدف</th>
                    <th className="text-right p-2">آخر سعر</th>
                    <th className="text-right p-2">الحالة</th>
                    <th className="text-right p-2">آخر فحص</th>
                    <th className="text-right p-2">مفعّل</th>
                    <th className="text-right p-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-b border-border/20 hover:bg-muted/30">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{a.symbol}</Badge>
                          <span className="truncate max-w-[140px]">{a.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="p-2 text-xs">{TYPE_LABEL[a.asset_type] ?? a.asset_type}</td>
                      <td className="p-2 text-xs">{CONDITION_LABEL[a.condition]}</td>
                      <td className="p-2 tabular-nums">{Number(a.target_value).toLocaleString()}{a.condition.startsWith("change") ? "%" : ""}</td>
                      <td className="p-2 tabular-nums">{a.last_price ? Number(a.last_price).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</td>
                      <td className="p-2">
                        <Tooltip><TooltipTrigger asChild><span><StatusBadge s={a.last_status} /></span></TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{a.last_error ?? "—"}</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {a.last_checked_at ? new Date(a.last_checked_at).toLocaleString() : "—"}
                      </td>
                      <td className="p-2">
                        <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} disabled={busyId === a.id} />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => checkOne(a)} disabled={busyId === a.id}>
                              {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger><TooltipContent>فحص الآن</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendTestNotification(a)}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>إرسال تنبيه تجريبي</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate({ to: "/market-intelligence" })}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>افتح الأصل في ذكاء السوق</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>تعديل</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setConfirmDel(a)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>حذف</TooltipContent></Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        الفحص اليدوي — لا يتم إرسال تنبيهات تلقائياً حالياً. <Link to="/disclaimer" className="underline">إخلاء المسؤولية</Link>
      </p>

      <CreateAlertDialog open={createOpen} onOpenChange={setCreateOpen} onDone={load} />

      <Dialog open={!!editAlert} onOpenChange={(o) => !o && setEditAlert(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل التنبيه</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">الشرط</Label>
            <Select value={editForm.condition} onValueChange={(v) => setEditForm((f) => ({ ...f, condition: v as AlertCondition }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABEL) as AlertCondition[]).map((k) => (
                  <SelectItem key={k} value={k}>{CONDITION_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">القيمة المستهدفة</Label>
            <Input type="number" inputMode="decimal" value={editForm.target_value} onChange={(e) => setEditForm((f) => ({ ...f, target_value: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">ملاحظة</Label>
            <Input value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} maxLength={200} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditAlert(null)}>إلغاء</Button>
            <Button className="flex-1" onClick={saveEdit}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التنبيه</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التنبيه على "{confirmDel?.symbol}" نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={remove}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
