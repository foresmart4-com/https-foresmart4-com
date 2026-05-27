import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAutoTrading, updateSettings } from "@/lib/autoTrading";
import { assetPnlMock } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";
import { ShieldCheck, ShieldAlert, Target, AlertTriangle, Eye , Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

type PerAsset = { stop?: number; target?: number };

export function RiskManagementPanel() {
  const { lang } = useI18n();
  const { settings } = useAutoTrading();
  const [perAsset, setPerAsset] = useState<Record<string, PerAsset>>({});

  const setPa = (sym: string, patch: PerAsset) =>
    setPerAsset((p) => ({ ...p, [sym]: { ...p[sym], ...patch } }));

  return (
    <Card className="p-5 space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">
          {lang === "ar" ? "إدارة المخاطر" : "Risk Management"}
        </h3>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">{lang === "ar" ? "أقصى خسارة لكل صفقة %" : "Max loss / trade %"}</Label>
          <Input type="number" min={0.1} step={0.1} value={settings.riskRules.maxLossPerTradePct}
            onChange={(e) => updateSettings({ riskRules: { ...settings.riskRules, maxLossPerTradePct: Number(e.target.value) || 0 } })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "أقصى نسبة لكل صفقة %" : "Max position %"}</Label>
          <Input type="number" min={1} max={100} value={settings.riskRules.maxPositionPct}
            onChange={(e) => updateSettings({ riskRules: { ...settings.riskRules, maxPositionPct: Number(e.target.value) || 0 } })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{lang === "ar" ? "إيقاف عند خسارة يومية %" : "Halt at daily loss %"}</Label>
          <Input type="number" min={0.5} step={0.5} value={settings.riskRules.haltOnDailyLossPct}
            onChange={(e) => updateSettings({ riskRules: { ...settings.riskRules, haltOnDailyLossPct: Number(e.target.value) || 0 } })} className="h-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{lang === "ar" ? "الأصل" : "Asset"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "السعر" : "Price"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "وقف خسارة" : "Stop"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "هدف ربح" : "Target"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "حالة AI" : "AI status"}</th>
              <th className="px-3 py-2 text-end">{lang === "ar" ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {assetPnlMock.map((a) => {
              const drop = ((a.lastPrice - a.avgCost) / a.avgCost) * 100;
              const status: { label_ar: string; label_en: string; cls: string; Icon: any } =
                drop < -4 ? { label_ar: "خطر", label_en: "Risk", cls: "text-danger", Icon: ShieldAlert } :
                drop < -1.5 ? { label_ar: "مراقبة", label_en: "Watch", cls: "text-warning", Icon: Eye } :
                drop > 7 ? { label_ar: "اقتراح خروج", label_en: "Exit suggestion", cls: "text-primary", Icon: Target } :
                { label_ar: "آمن", label_en: "Safe", cls: "text-success", Icon: ShieldCheck };
              const Icon = status?.Icon ?? Activity;
              const pa = perAsset[a.symbol] ?? {};
              return (
                <tr key={a.symbol} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{lang === "ar" ? a.name_ar : a.name_en}</div>
                    <div className="text-[10px] text-muted-foreground">{a.symbol}</div>
                  </td>
                  <td className="px-3 py-2 text-end">{a.lastPrice}</td>
                  <td className="px-3 py-2 text-end">
                    <Input type="number" value={pa.stop ?? (a.lastPrice * 0.96).toFixed(2)}
                      onChange={(e) => setPa(a.symbol, { stop: Number(e.target.value) })}
                      className="h-7 w-24 ms-auto text-xs" />
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Input type="number" value={pa.target ?? (a.lastPrice * 1.08).toFixed(2)}
                      onChange={(e) => setPa(a.symbol, { target: Number(e.target.value) })}
                      className="h-7 w-24 ms-auto text-xs" />
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Badge variant="outline" className={cn("text-[10px] gap-1", status.cls)}>
                      <Icon className="h-3 w-3" />{lang === "ar" ? status.label_ar : status.label_en}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2"
                        onClick={() => toast.success(lang === "ar" ? `تم تطبيق وقف خسارة تجريبي على ${a.symbol}` : `Paper stop-loss applied on ${a.symbol}`)}>
                        {lang === "ar" ? "تطبيق وقف" : "Set stop"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2"
                        onClick={() => toast.success(lang === "ar" ? `تم تطبيق هدف ربح تجريبي على ${a.symbol}` : `Paper take-profit applied on ${a.symbol}`)}>
                        {lang === "ar" ? "تطبيق هدف" : "Set target"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        {lang === "ar"
          ? "جميع أوامر الوقف والأهداف تجريبية (Paper) ولا تنفذ تداولاً حقيقياً."
          : "All stop/target orders are paper trades — no real execution."}
      </p>
    </Card>
  );
}
