import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans, getMySubscription, createBillingPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Settings } from "lucide-react";
import { toast } from "sonner";
import { StripeSubscriptionCheckout } from "@/components/StripeSubscriptionCheckout";

export const Route = createFileRoute("/_app/subscription")({ component: SubscriptionPage });

type SubPriceId = "quarterly_sar" | "semi_annual_sar" | "annual_sar";
const PRICE_MAP: Record<string, SubPriceId> = {
  quarterly: "quarterly_sar",
  semi_annual: "semi_annual_sar",
  annual: "annual_sar",
};

function SubscriptionPage() {
  const { lang, dir } = useI18n();
  const plansFn = useServerFn(listPlans);
  const subFn = useServerFn(getMySubscription);
  const portalFn = useServerFn(createBillingPortalSession);

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() });
  const { data: sub, refetch } = useQuery({ queryKey: ["my-sub"], queryFn: () => subFn() });

  const [selectedPrice, setSelectedPrice] = useState<SubPriceId | null>(null);

  const portal = useMutation({
    mutationFn: () =>
      portalFn({
        data: {
          returnUrl: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
      }),
    onSuccess: (url) => {
      if (typeof url === "string") window.open(url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isActive =
    sub && ["active", "trialing", "past_due"].includes(sub.status as string);
  const hasStripeCustomer = !!(sub as any)?.stripe_customer_id;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6" dir={dir}>
      <div>
        <h1 className="font-display text-3xl font-bold">
          {lang === "ar" ? "خطط الاشتراك" : "Subscription Plans"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "تجربة مجانية 14 يوم بدون أي خصم. يمكنك إلغاء الاشتراك في أي وقت."
            : "Free 14-day trial. No charge during trial. Cancel anytime."}
        </p>
      </div>

      {isActive && (
        <Card className="gradient-card border-success/40 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-success" />
            <div>
              <div className="font-semibold">
                {sub.status === "trialing"
                  ? lang === "ar" ? "أنت في فترة التجربة المجانية" : "You're on free trial"
                  : sub.status === "past_due"
                  ? lang === "ar" ? "تأخر في الدفع - يحاول النظام التجديد" : "Payment past due - retrying"
                  : lang === "ar" ? "اشتراكك نشط" : "Subscription active"}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "ar" ? "ينتهي في" : "Ends on"}{" "}
                {new Date(
                  (sub.current_period_end as string) ?? (sub.trial_ends_at as string) ?? Date.now(),
                ).toLocaleDateString()}
              </div>
            </div>
          </div>
          {hasStripeCustomer && (
            <Button variant="outline" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <Settings className="me-2 h-4 w-4" />
              {lang === "ar" ? "إدارة الاشتراك" : "Manage Subscription"}
            </Button>
          )}
        </Card>
      )}

      {selectedPrice ? (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">
              {lang === "ar" ? "إتمام الاشتراك" : "Complete Subscription"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPrice(null)}>
              {lang === "ar" ? "رجوع" : "Back"}
            </Button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {lang === "ar"
              ? "لن يتم خصم أي مبلغ خلال الـ 14 يوماً الأولى. يتم التجديد تلقائياً بعدها ما لم تلغِ."
              : "No charge for 14 days. Auto-renews after the trial unless cancelled."}
          </p>
          <StripeSubscriptionCheckout
            priceId={selectedPrice}
            returnUrl={`${window.location.origin}/subscription?checkout=success`}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(plans ?? []).map((p: any) => {
            const priceId = PRICE_MAP[p.code as string];
            const monthly = (Number(p.price_sar) / p.duration_months).toFixed(0);
            const isAnnual = p.code === "annual";
            return (
              <Card
                key={p.id}
                className={`relative p-6 ${isAnnual ? "border-primary shadow-glow" : ""}`}
              >
                {isAnnual && (
                  <Badge className="absolute -top-2 right-4 gap-1">
                    <Sparkles className="h-3 w-3" />
                    {lang === "ar" ? "الأكثر توفيراً" : "Best value"}
                  </Badge>
                )}
                <h3 className="font-display text-xl font-bold">
                  {lang === "ar" ? p.name_ar : p.name_en}
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold">{p.price_sar}</span>
                  <span className="text-muted-foreground">{lang === "ar" ? "ريال" : "SAR"}</span>
                  <span className="text-xs text-muted-foreground">
                    / {p.duration_months} {lang === "ar" ? "شهر" : "mo"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ≈ {monthly} {lang === "ar" ? "ريال/شهر" : "SAR/month"}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {((p.features as string[]) ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={isAnnual ? "default" : "outline"}
                  disabled={!priceId || !!(isActive && hasStripeCustomer)}
                  onClick={() => priceId && setSelectedPrice(priceId)}
                >
                  {isActive && hasStripeCustomer
                    ? lang === "ar" ? "مشترك حالياً" : "Already subscribed"
                    : lang === "ar"
                    ? "ابدأ التجربة المجانية 14 يوم"
                    : "Start 14-day free trial"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
