import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans, getMySubscription, initiateSubscription } from "@/lib/payments.functions";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/subscription")({ component: SubscriptionPage });

function SubscriptionPage() {
  const { lang, dir } = useI18n();
  const navigate = useNavigate();
  const plansFn = useServerFn(listPlans);
  const subFn = useServerFn(getMySubscription);
  const initFn = useServerFn(initiateSubscription);

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() });
  const { data: sub } = useQuery({ queryKey: ["my-sub"], queryFn: () => subFn() });

  const [activeForm, setActiveForm] = useState<{ planCode: "quarterly" | "annual"; pk: string | null; subId: string; price: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const init = useMutation({
    mutationFn: (code: "quarterly" | "annual") => initFn({ data: { planCode: code } }),
    onSuccess: (res, code) => {
      setActiveForm({ planCode: code, pk: res.publishableKey, subId: res.subscriptionId, price: Number(res.plan.price_sar) });
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Inject Moyasar.js once when form is shown
  useEffect(() => {
    if (!activeForm) return;
    if (document.getElementById("moyasar-css")) return;
    const link = document.createElement("link");
    link.id = "moyasar-css";
    link.rel = "stylesheet";
    link.href = "https://cdn.moyasar.com/mpf/1.15.1/moyasar.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://cdn.moyasar.com/mpf/1.15.1/moyasar.js";
    s.async = true;
    s.onload = () => mountForm();
    document.body.appendChild(s);
  }, [activeForm]);

  useEffect(() => { if (activeForm && (window as any).Moyasar) mountForm(); }, [activeForm]);

  const mountForm = () => {
    if (!activeForm || !activeForm.pk) return;
    const M = (window as any).Moyasar;
    if (!M) return;
    M.init({
      element: ".mysr-form",
      amount: Math.round(activeForm.price * 100),
      currency: "SAR",
      description: lang === "ar" ? `اشتراك ${activeForm.planCode === "annual" ? "سنوي" : "فصلي"}` : `${activeForm.planCode} subscription`,
      publishable_api_key: activeForm.pk,
      callback_url: `${window.location.origin}/subscription?status=success`,
      methods: ["creditcard", "applepay", "stcpay"],
      metadata: { purpose: "subscription", subscription_id: activeForm.subId },
    });
  };

  const isActive = sub && ["active", "trialing"].includes(sub.status);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6" dir={dir}>
      <div>
        <h1 className="font-display text-3xl font-bold">{lang === "ar" ? "خطط الاشتراك" : "Subscription Plans"}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "ابدأ بتجربة مجانية 14 يوماً، ثم اختر الخطة المناسبة لك." : "Start with a 14-day free trial, then pick the plan that fits you."}
        </p>
      </div>

      {isActive && (
        <Card className="gradient-card border-success/40 p-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-success" />
            <div>
              <div className="font-semibold">
                {sub.status === "trialing"
                  ? (lang === "ar" ? "أنت في فترة التجربة المجانية" : "You're on free trial")
                  : (lang === "ar" ? "اشتراكك نشط" : "Subscription active")}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "ar" ? "ينتهي في" : "Ends on"}{" "}
                {new Date(sub.current_period_end ?? sub.trial_ends_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(plans ?? []).map((p: any) => {
          const monthly = (Number(p.price_sar) / p.duration_months).toFixed(0);
          const isAnnual = p.code === "annual";
          return (
            <Card key={p.id} className={`relative p-6 ${isAnnual ? "border-primary shadow-glow" : ""}`}>
              {isAnnual && (
                <Badge className="absolute -top-2 right-4 gap-1"><Sparkles className="h-3 w-3" />{lang === "ar" ? "الأكثر توفيراً" : "Best value"}</Badge>
              )}
              <h3 className="font-display text-xl font-bold">{lang === "ar" ? p.name_ar : p.name_en}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold">{p.price_sar}</span>
                <span className="text-muted-foreground">{lang === "ar" ? "ريال" : "SAR"}</span>
                <span className="text-xs text-muted-foreground">/ {p.duration_months} {lang === "ar" ? "شهر" : "mo"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                ≈ {monthly} {lang === "ar" ? "ريال/شهر" : "SAR/month"}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {(p.features as string[]).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={isAnnual ? "default" : "outline"}
                disabled={init.isPending || isActive}
                onClick={() => init.mutate(p.code)}
              >
                {isActive ? (lang === "ar" ? "مشترك حالياً" : "Already subscribed")
                  : init.isPending ? "..." : (lang === "ar" ? "ابدأ التجربة المجانية" : "Start free trial")}
              </Button>
            </Card>
          );
        })}
      </div>

      {activeForm && !activeForm.pk && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold">{lang === "ar" ? "بوابة الدفع غير مفعّلة بعد" : "Payment gateway not configured yet"}</p>
              <p className="mt-1 text-muted-foreground">
                {lang === "ar"
                  ? "لتفعيل الدفع: أنشئ حساب Moyasar من moyasar.com، ثم أضف مفاتيح API من خلال إعدادات المشروع."
                  : "To enable payments: create a Moyasar account at moyasar.com, then add API keys in project settings."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeForm && activeForm.pk && (
        <Card ref={formRef as any} className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">
            {lang === "ar" ? "إتمام الدفع" : "Complete payment"}
          </h3>
          <div className="mysr-form" />
        </Card>
      )}
    </div>
  );
}
