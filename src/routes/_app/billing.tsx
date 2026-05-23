import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMySubscription,
  createBillingPortalSession,
} from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Settings, ExternalLink, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { listProviders, BILLING_PLANS } from "@/services/billing/providers";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/_app/billing")({ component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><BillingPage /></ErrorBoundary> });

function BillingPage() {
  const { lang, dir } = useI18n();
  const subFn = useServerFn(getMySubscription);
  const portalFn = useServerFn(createBillingPortalSession);
  const { data: sub } = useQuery({ queryKey: ["my-sub"], queryFn: () => subFn() });

  const portal = useMutation({
    mutationFn: () =>
      portalFn({
        data: {
          returnUrl: `${window.location.origin}/billing`,
          environment: getStripeEnvironment(),
        },
      }),
    onSuccess: (url) => {
      if (typeof url === "string") window.open(url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = (sub as any)?.status ?? "none";
  const isActive = ["trialing", "active", "past_due"].includes(status);
  const providers = listProviders();

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6" dir={dir}>
      <div>
        <h1 className="font-display text-3xl font-bold">
          {lang === "ar" ? "الفوترة والاشتراك" : "Billing & Subscription"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "أدر اشتراكك في تحليلات AI، وراجع سجل الفواتير، وغيّر الباقة."
            : "Manage your AI analytics subscription, review invoices, and change plans."}
        </p>
      </div>

      {/* Current status */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">
                {isActive
                  ? lang === "ar" ? "اشتراكك نشط" : "Subscription active"
                  : lang === "ar" ? "لا يوجد اشتراك نشط" : "No active subscription"}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "ar" ? "الحالة:" : "Status:"} <Badge variant="outline" className="ms-1">{status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/subscription">
              <Button variant="outline" size="sm">
                {lang === "ar" ? "تغيير الباقة" : "Change Plan"}
              </Button>
            </Link>
            {isActive && (sub as any)?.stripe_customer_id && (
              <Button size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
                <Settings className="me-2 h-4 w-4" />
                {lang === "ar" ? "إدارة الاشتراك" : "Manage Subscription"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Plans */}
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">
          {lang === "ar" ? "الباقات المتاحة" : "Available Plans"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {BILLING_PLANS.map((p) => (
            <div key={p.code} className="rounded-lg border border-border p-4">
              <div className="font-semibold">{p.name}</div>
              <div className="mt-1 text-2xl font-bold">
                ${p.priceUsd}
                <span className="text-xs font-normal text-muted-foreground">
                  {p.interval === "none" ? "" : ` / ${p.interval}`}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.features.map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Invoice history */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {lang === "ar" ? "سجل الفواتير" : "Invoice History"}
          </h2>
          {isActive && (sub as any)?.stripe_customer_id && (
            <Button variant="ghost" size="sm" onClick={() => portal.mutate()}>
              {lang === "ar" ? "عرض الكل" : "View all"}
              <ExternalLink className="ms-2 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "ar"
            ? "تتوفر الفواتير الكاملة وإيصالات الدفع في بوابة الفوترة الآمنة."
            : "Full invoices and payment receipts are available in the secure billing portal."}
        </p>
      </Card>

      {/* Cancel */}
      {isActive && (
        <Card className="p-5 border-destructive/30">
          <h2 className="font-display text-lg font-bold flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            {lang === "ar" ? "إلغاء الاشتراك" : "Cancel Subscription"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "ar"
              ? "يمكنك إلغاء اشتراكك في أي وقت من بوابة الفوترة. ستحتفظ بالوصول حتى نهاية الفترة المدفوعة."
              : "You can cancel anytime via the billing portal. Access continues until the end of your paid period."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
          >
            {lang === "ar" ? "فتح بوابة الإلغاء" : "Open cancellation portal"}
          </Button>
        </Card>
      )}

      {/* Provider availability */}
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">
          {lang === "ar" ? "مزودو الدفع المدعومون" : "Supported Payment Providers"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>{p.label}</span>
              <Badge variant={p.isConfigured ? "default" : "outline"}>
                {p.isConfigured
                  ? lang === "ar" ? "مفعّل" : "Active"
                  : lang === "ar" ? "قريبًا" : "Coming soon"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <LegalFooter variant="inline" className="pt-6" />
    </div>
  );
}
