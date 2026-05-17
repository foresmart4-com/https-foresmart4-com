import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "moyasar",  name: "Moyasar"       },
  { id: "paytabs",  name: "PayTabs"       },
  { id: "tap",      name: "Tap Payments"  },
  { id: "stripe",   name: "Stripe"        },
] as const;

export function PaymentLinksSettings() {
  const { lang } = useI18n();
  const [manualLink, setManualLink] = useState("");
  const [providerLinks, setProviderLinks] = useState<Record<string, string>>({});

  const save = () => {
    toast.success(lang === "ar" ? "تم حفظ الإعدادات محلياً (لم يتم ربط مزود فعلي)" : "Saved locally (no live provider connected)");
  };

  return (
    <Card className="gradient-card p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">{lang === "ar" ? "إعدادات روابط الدفع" : "Payment links settings"}</h3>
        <Badge variant="outline" className="ms-2 text-[10px]">Placeholder</Badge>
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{lang === "ar"
          ? "الدفع الحقيقي يحتاج ربط مزود دفع وتفعيل Webhooks لاحقاً. لا تحفظ مفاتيح سرية هنا."
          : "Live payments require provider integration and webhooks later. Do not save secret keys here."}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <div key={p.id}>
            <Label className="text-xs">{p.name} {lang === "ar" ? "— رابط placeholder" : "— placeholder URL"}</Label>
            <Input
              placeholder={`https://pay.${p.id}.com/...`}
              value={providerLinks[p.id] ?? ""}
              onChange={(e) => setProviderLinks({ ...providerLinks, [p.id]: e.target.value })}
            />
          </div>
        ))}
        <div className="md:col-span-2">
          <Label className="text-xs">{lang === "ar" ? "رابط دفع يدوي" : "Manual payment link"}</Label>
          <Input placeholder="https://..." value={manualLink} onChange={(e) => setManualLink(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} size="sm">{lang === "ar" ? "حفظ" : "Save"}</Button>
      </div>
    </Card>
  );
}
