import { useAutoTrading, updateSettings, setEnabled, emergencyStop, clearLog, setOrderStatus } from "@/lib/autoTrading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { Bot, Octagon, AlertTriangle, History, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AutoTradingControlPanel() {
  const { lang } = useI18n();
  const { settings, orders, haltedAt } = useAutoTrading();

  const handleEmergency = () => {
    emergencyStop();
    toast.error(lang === "ar" ? "تم إيقاف التداول الآلي التجريبي" : "Auto trading halted (simulation)");
  };

  return (
    <Card className="p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">
            {lang === "ar" ? "التحكم الآلي التجريبي" : "Auto Trading (Simulation)"}
          </h3>
          <Badge variant="outline" className="text-[10px]">Paper trading</Badge>
        </div>
        <Button size="sm" variant="destructive" onClick={handleEmergency} className="gap-1.5">
          <Octagon className="h-4 w-4" />
          {lang === "ar" ? "إيقاف فوري" : "Emergency stop"}
        </Button>
      </header>

      <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {lang === "ar"
          ? "البيانات الحالية تجريبية، لا يمكن الاعتماد عليها لتنفيذ تداول حقيقي. كل الأوامر Simulation فقط."
          : "Data is mostly mock — not safe for real trading. All orders are simulated."}
      </div>

      {haltedAt && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-[11px] text-danger">
          {lang === "ar" ? "تم الإيقاف الطارئ في:" : "Halted at:"} {new Date(haltedAt).toLocaleString()}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <div className="font-semibold text-sm">
            {lang === "ar" ? "تفعيل التداول الآلي التجريبي" : "Enable simulation auto-trading"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {lang === "ar" ? "إنشاء أوامر Paper تلقائية من قرارات الذكاء الاصطناعي" : "Auto-create paper orders from AI decisions"}
          </div>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(v) => setEnabled(v)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">{lang === "ar" ? "أقصى مبلغ لكل صفقة (SAR)" : "Max amount per trade (SAR)"}</Label>
          <Input type="number" min={50} value={settings.maxAmountPerTrade}
            onChange={(e) => updateSettings({ maxAmountPerTrade: Number(e.target.value) || 0 })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "حد الخسارة اليومي (SAR)" : "Daily loss limit (SAR)"}</Label>
          <Input type="number" min={50} value={settings.dailyLossLimit}
            onChange={(e) => updateSettings({ dailyLossLimit: Number(e.target.value) || 0 })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "أدنى ثقة مطلوبة %" : "Min confidence %"}</Label>
          <Input type="number" min={0} max={100} value={settings.minConfidence}
            onChange={(e) => updateSettings({ minConfidence: Number(e.target.value) || 0 })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "وضع التنفيذ" : "Execution mode"}</Label>
          <Select value={settings.mode} onValueChange={(v) => updateSettings({ mode: v as any })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_execute">{lang === "ar" ? "تنفيذ تجريبي تلقائي" : "Auto-simulate"}</SelectItem>
              <SelectItem value="require_approval">{lang === "ar" ? "موافقة قبل التنفيذ" : "Require approval"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">{lang === "ar" ? "الأصول المسموح بها (بفاصلة، اتركها فارغة = الكل)" : "Allowed assets (comma-separated, empty = all)"}</Label>
        <Input
          value={settings.allowedAssets.join(",")}
          placeholder="BTC,AAPL,2222.SR"
          onChange={(e) => updateSettings({ allowedAssets: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          className="h-9"
        />
      </div>

      {/* Log */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <History className="h-4 w-4" />
            {lang === "ar" ? "سجل أوامر الذكاء الاصطناعي" : "AI orders log"}
            <Badge variant="outline" className="text-[10px]">{orders.length}</Badge>
          </h4>
          {orders.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => clearLog()} className="h-7 text-xs gap-1">
              <Trash2 className="h-3 w-3" />
              {lang === "ar" ? "مسح" : "Clear"}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "القرار" : "Action"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "الثقة" : "Conf."}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "السبب" : "Reason"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "الوقت" : "Time"}</th>
                <th className="px-2 py-1.5 text-end">{lang === "ar" ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  {lang === "ar" ? "لا توجد أوامر" : "No orders yet"}
                </td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{o.asset}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn("rounded px-1.5 py-0.5 font-semibold",
                      o.action === "BUY" ? "bg-success/15 text-success" :
                      o.action === "SELL" ? "bg-danger/15 text-danger" :
                      o.action === "STOP_LOSS" ? "bg-danger/15 text-danger" :
                      "bg-warning/15 text-warning")}>{o.action}</span>
                  </td>
                  <td className="px-2 py-1.5 text-end">{o.amount} SAR</td>
                  <td className="px-2 py-1.5 text-end">{o.confidence}%</td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{o.reason}</td>
                  <td className="px-2 py-1.5 text-end text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString()}</td>
                  <td className="px-2 py-1.5 text-end">
                    {o.status === "pending_review" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-success" onClick={() => { setOrderStatus(o.id, "simulated"); toast.success(lang === "ar" ? "تم اعتماد الأمر التجريبي" : "Approved"); }}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-danger" onClick={() => { setOrderStatus(o.id, "rejected"); toast.warning(lang === "ar" ? "تم الرفض" : "Rejected"); }}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className={cn("text-[10px]",
                        o.status === "simulated" && "border-success/40 text-success",
                        o.status === "rejected" && "border-danger/40 text-danger")}>
                        {o.status}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Card>
  );
}
