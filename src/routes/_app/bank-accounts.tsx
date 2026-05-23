import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBankAccounts } from "@/lib/wallet.functions";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Shield, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bank-accounts")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><BankAccountsPage /></ErrorBoundary>,
});

function BankAccountsPage() {
  const { lang } = useI18n();
  const { data: banks } = useQuery({ queryKey: ["banks"], queryFn: () => getBankAccounts() });

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "الحسابات البنكية" : "Bank accounts"}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "اربط حسابك البنكي بأمان عبر Plaid لتمويل المحفظة وسحب الأرباح." : "Securely link your bank via Plaid to fund your wallet and withdraw profits."}
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{lang === "ar" ? "ربط حساب جديد" : "Link a new bank account"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "ar"
                ? "نستخدم Plaid، الموثوق من آلاف البنوك حول العالم. لا يتم مشاركة بيانات تسجيل الدخول معنا."
                : "We use Plaid, trusted by thousands of banks worldwide. Your login credentials are never shared with us."}
            </p>
            <Button
              className="mt-4 gap-2"
              onClick={() => toast.info(lang === "ar" ? "سيتم تفعيل ربط Plaid عند تزويدنا بمفاتيح API الخاصة بك." : "Plaid linking will be enabled once API keys are provided.")}
            >
              <Shield className="h-4 w-4" />
              {lang === "ar" ? "ربط حساب بنكي" : "Connect bank"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-warning/30 bg-warning/5 p-4">
        <div className="flex gap-3 text-sm">
          <Info className="h-5 w-5 shrink-0 text-warning" />
          <div className="space-y-1">
            <div className="font-semibold">{lang === "ar" ? "إعداد Plaid مطلوب" : "Plaid setup required"}</div>
            <p className="text-muted-foreground">
              {lang === "ar"
                ? "لتفعيل ربط البنوك الفعلي يلزمنا PLAID_CLIENT_ID و PLAID_SECRET. أخبرنا عند جاهزيتك لإضافتهما."
                : "To enable real bank linking we need PLAID_CLIENT_ID and PLAID_SECRET. Let us know when you're ready to add them."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <header className="border-b border-border bg-muted/30 px-5 py-3 font-semibold">
          {lang === "ar" ? "الحسابات المربوطة" : "Linked accounts"}
        </header>
        {banks && banks.length > 0 ? (
          <ul className="divide-y divide-border">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{b.institution_name}</div>
                  <div className="text-xs text-muted-foreground">{b.account_name} •••• {b.account_mask} · {b.account_type}</div>
                </div>
                <span className="text-xs text-success">{b.is_active ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "معطل" : "Inactive")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {lang === "ar" ? "لم تربط أي حساب بنكي بعد." : "No bank accounts linked yet."}
          </div>
        )}
      </Card>
    </div>
  );
}
