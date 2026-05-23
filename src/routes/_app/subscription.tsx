import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans, getMySubscription, createBillingPortalSession } from "@/lib/payments.functions";
import { getPaymentProvidersHealth } from "@/lib/payments-health.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Crown, Sparkles, Settings, X, ShieldAlert, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StripeSubscriptionCheckout, type SubPriceId } from "@/components/StripeSubscriptionCheckout";
import { PayPalCheckoutButton } from "@/components/PayPalCheckoutButton";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/_app/subscription")({ component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><SubscriptionPage /></ErrorBoundary> });

const PRICE_MAP: Record<string, SubPriceId> = {
  quarterly:      "quarterly_sar",
  semi_annual:    "semi_annual_sar",
  annual:         "annual_sar",
  pro_quarterly:  "pro_quarterly_sar",
  pro_semi_annual:"pro_semi_annual_sar",
  pro_annual:     "pro_annual_sar",
};

const PRO_CODES = new Set(["pro_quarterly", "pro_semi_annual", "pro_annual"]);

function SubscriptionPage() {
  const { lang, dir } = useI18n();
  const plansFn = useServerFn(listPlans);
  const subFn = useServerFn(getMySubscription);
  const portalFn = useServerFn(createBillingPortalSession);
  const healthFn = useServerFn(getPaymentProvidersHealth);

  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() });
  const subQ   = useQuery({ queryKey: ["my-sub"], queryFn: () => subFn() });
  const healthQ = useQuery({ queryKey: ["payments-health"], queryFn: () => healthFn(), staleTime: 60_000 });
  const plans = plansQ.data;
  const sub   = subQ.data;
  const [selectedPrice, setSelectedPrice] = useState<SubPriceId | null>(null);
  const [tier, setTier] = useState<"basic" | "pro">("basic");
  const [withTrial, setWithTrial] = useState(true);

  const portal = useMutation({
    mutationFn: () => portalFn({ data: { returnUrl: `${window.location.origin}/subscription`, environment: getStripeEnvironment() } }),
    onSuccess: (url) => { if (typeof url === "string") window.open(url, "_blank"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isActive = sub && ["active", "trialing", "past_due"].includes(sub.status as string);
  const hasStripeCustomer = !!(sub as any)?.stripe_customer_id;

  const basicPlans = (plans ?? []).filter((p: any) => !PRO_CODES.has(p.code));
  const proPlans   = (plans ?? []).filter((p: any) =>  PRO_CODES.has(p.code));
  const displayed  = tier === "basic" ? basicPlans : proPlans;

  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6" dir={dir}>
      <div className="text-center">
        <Badge className="mb-3 gap-1"><Sparkles className="h-3 w-3" />{lang === "ar" ? "باقة داخلية للشركة" : "Corporate internal plan"}</Badge>
        <h1 className="font-display text-4xl font-bold">
          {lang === "ar" ? "صلاحيات داخلية" : "Internal Access"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "ar"
            ? "بدون أي خصم خلال التجربة. ألغِ في أي وقت."
            : "No charge during trial. Cancel anytime."}
        </p>
      </div>

      {/* Free trial highlight */}
      <Card className="gradient-card border-primary/40 p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-bold">
              {lang === "ar" ? "إدارة الوصول الداخلي" : "Internal Access Management"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "ar"
                ? "صلاحيات وصول داخلية للشركة. يدار من قبل مسؤول النظام."
                : "Corporate internal access managed by system administrator."}
            </div>
          </div>
        </div>
        <Button
          className="gap-2 shrink-0"
          disabled={!!(isActive && hasStripeCustomer)}
          onClick={() => toast.success(lang === "ar" ? "تم تفعيل الوصول الداخلي" : "Internal access activated")}
        >
          <Sparkles className="h-4 w-4" />
          {lang === "ar" ? "تفعيل الوصول" : "Activate access"}
        </Button>
      </Card>

      {/* Payments availability + provider health */}
      {healthQ.data && !healthQ.data.anyConfigured && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            {lang === "ar"
              ? "لا توجد بوابة دفع مفعّلة حالياً. لا يمكن تفعيل الوصول حتى يتم إعداد Stripe أو PayPal أو Moyasar."
              : "No payment provider is configured. Access management disabled until Stripe, PayPal, or Moyasar is enabled."}
          </AlertDescription>
        </Alert>
      )}
      {healthQ.data && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="h-4 w-4 text-primary" />
            {lang === "ar" ? "حالة بوابات الدفع" : "Payment provider status"}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {healthQ.data.providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.configured
                      ? (p.environment === "live"
                          ? (lang === "ar" ? "وضع التشغيل" : "Live")
                          : (lang === "ar" ? "وضع الاختبار" : "Sandbox"))
                      : (lang === "ar" ? "غير مُهيأ" : "Not configured")}
                  </div>
                </div>
                <Badge variant={p.configured ? "default" : "outline"} className={p.configured ? "bg-success/15 text-success border-success/30" : "text-muted-foreground"}>
                  {p.configured ? (lang === "ar" ? "متصل" : "Connected") : (lang === "ar" ? "معطّل" : "Off")}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Free plan */}
      <Card className="p-5 border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-display text-lg font-bold">
              {lang === "ar" ? "الوصول الأساسي" : "Basic Access"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "ar"
                ? "وصول محدود للتحليلات الأساسية وقائمة متابعة واحدة. مناسبة للتجربة المفتوحة."
                : "Limited access to core analytics and one watchlist. Great to explore the platform."}
            </div>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2"><Check className="h-4 w-4" />{lang === "ar" ? "متابعة بالوصول الأساسي" : "Continue with basic access"}</Button>
          </Link>
        </div>
      </Card>

      {plansQ.isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          {lang === "ar" ? "جاري تحميل الخطط" : "Loading plans"}
        </div>
      )}
      {plansQ.error && (
        <Alert variant="destructive"><AlertDescription>{lang === "ar" ? "تعذر تحميل باقات الوصول" : "Failed to load access plans"}</AlertDescription></Alert>
      )}



      {isActive && (
        <Card className="gradient-card border-success/40 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-success" />
            <div>
              <div className="font-semibold">
                {sub.status === "trialing"
                  ? (lang === "ar" ? "الوصول الداخلي مفعل" : "Internal access active")
                  : sub.status === "past_due"
                  ? (lang === "ar" ? "تأخر في الدفع — يحاول النظام التجديد" : "Payment past due — retrying")
                  : (lang === "ar" ? "الوصول الداخلي نشط" : "Internal access active")}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "ar" ? "ينتهي في" : "Ends on"}{" "}
                {new Date((sub.current_period_end as string) ?? (sub.trial_ends_at as string) ?? Date.now()).toLocaleDateString()}
              </div>
            </div>
          </div>
          {hasStripeCustomer && (
            <Button variant="outline" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <Settings className="me-2 h-4 w-4" />
              {lang === "ar" ? "إدارة الصلاحيات" : "Manage Access"}
            </Button>
          )}
        </Card>
      )}

      {selectedPrice ? (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">{lang === "ar" ? "إدارة الوصول" : "Access Management"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPrice(null)}>{lang === "ar" ? "رجوع" : "Back"}</Button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {lang === "ar"
              ? "اختر طريقة تفعيل الوصول الداخلي."
              : "Choose a payment method. Card-based access activation."}
          </p>
          <StripeSubscriptionCheckout priceId={selectedPrice} returnUrl={`${window.location.origin}/subscription?checkout=success`} />
          <div className="my-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {lang === "ar" ? "أو" : "or"}
            <div className="h-px flex-1 bg-border" />
          </div>
          {/* PayPal alternative — maps SubPriceId back to plan code */}
          <PayPalCheckoutButton
            planCode={
              (Object.entries(PRICE_MAP).find(([, v]) => v === selectedPrice)?.[0] ?? "quarterly") as
                | "quarterly" | "semi_annual" | "annual"
                | "pro_quarterly" | "pro_semi_annual" | "pro_annual"
            }
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "الدفع عبر PayPal يفعّل الاشتراك فوراً (بدون فترة تجربة)."
              : "PayPal activates access immediately."}
          </p>
        </Card>
      ) : (
        <>
          <Tabs value={tier} onValueChange={(v) => setTier(v as "basic" | "pro")}>
            <TabsList className="mx-auto grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="basic">{lang === "ar" ? "العادي" : "Basic"}</TabsTrigger>
              <TabsTrigger value="pro">
                <Crown className="me-1 h-3.5 w-3.5" />Pro
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-6">
              <PlanGrid plans={displayed} accent={false} priceMap={PRICE_MAP} lang={lang}
                onPick={(id) => setSelectedPrice(id)} disabled={!!(isActive && hasStripeCustomer)} />
            </TabsContent>
            <TabsContent value="pro" className="mt-6">
              <PlanGrid plans={displayed} accent priceMap={PRICE_MAP} lang={lang}
                onPick={(id) => setSelectedPrice(id)} disabled={!!(isActive && hasStripeCustomer)} />
            </TabsContent>
          </Tabs>

          {/* Comparison */}
          <Card className="overflow-hidden">
            <header className="border-b border-border bg-muted/30 px-5 py-3 font-semibold">
              {lang === "ar" ? "مقارنة الصلاحيات" : "Access Comparison"}
            </header>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === "ar" ? "الميزة" : "Feature"}</th>
                  <th className="px-4 py-3 text-center">{lang === "ar" ? "العادي" : "Basic"}</th>
                  <th className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 text-primary"><Crown className="h-3.5 w-3.5" />Pro</span></th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["تحليل أسواق مباشر", "Live market analysis", true, true],
                  ["تنبيهات أسعار", "Price alerts", true, true],
                  ["محاكاة سوق تعليمية", "Market Simulation", true, true],
                  ["تحليلات المحفظة", "Portfolio Analytics", true, true],
                  ["رؤى AI متقدمة", "Advanced AI Insights", false, true],
                  ["إشارات سوق حصرية", "Exclusive Market Signals", false, true],
                  ["تتبع محفظة معمّق", "Deep Portfolio Tracking", false, true],
                  ["تنبيهات AI لحظية", "Real-time AI alerts", false, true],
                  ["أولوية الدعم", "Priority support", false, true],
                  ["ندوات حصرية", "Exclusive webinars", false, true],
                ] as const).map(([ar, en, b, p], i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5">{lang === "ar" ? ar : en}</td>
                    <td className="px-4 py-2.5 text-center">{b ? <Check className="mx-auto h-4 w-4 text-success" /> : <X className="mx-auto h-4 w-4 text-muted-foreground/50" />}</td>
                    <td className="px-4 py-2.5 text-center">{p ? <Check className="mx-auto h-4 w-4 text-success" /> : <X className="mx-auto h-4 w-4 text-muted-foreground/50" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      <LegalFooter variant="inline" className="pt-8" />
    </div>
  );
}

function PlanGrid({ plans, accent, priceMap, lang, onPick, disabled }: {
  plans: any[]; accent: boolean; priceMap: Record<string, SubPriceId>; lang: "ar" | "en";
  onPick: (id: SubPriceId) => void; disabled: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => {
        const priceId = priceMap[p.code as string];
        const monthly = (Number(p.price_sar) / p.duration_months).toFixed(0);
        const isHighlight = p.duration_months === 12;
        return (
          <Card key={p.id} className={`relative p-6 transition-all ${isHighlight ? "border-primary shadow-glow scale-[1.02]" : ""} ${accent ? "bg-gradient-to-br from-primary/5 to-accent/5" : ""}`}>
            {isHighlight && (
              <Badge className="absolute -top-2 right-4 gap-1">
                <Sparkles className="h-3 w-3" />{lang === "ar" ? "الأكثر توفيراً" : "Best value"}
              </Badge>
            )}
            {accent && <Crown className="absolute top-4 end-4 h-4 w-4 text-primary" />}
            <h3 className="font-display text-xl font-bold">{lang === "ar" ? p.name_ar : p.name_en}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold">{p.price_sar}</span>
              <span className="text-muted-foreground">{lang === "ar" ? "ريال" : "SAR"}</span>
              <span className="text-xs text-muted-foreground">/ {p.duration_months} {lang === "ar" ? "شهر" : "mo"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">≈ {monthly} {lang === "ar" ? "ريال/شهر" : "SAR/month"}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {((p.features as string[]) ?? []).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" variant={isHighlight ? "default" : "outline"}
              disabled={!priceId || disabled} onClick={() => priceId && onPick(priceId)}>
              {disabled
                ? (lang === "ar" ? "الوصول مفعل" : "Access active")
                : (lang === "ar" ? "تفعيل الباقة الداخلية" : "Activate internal plan")}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
