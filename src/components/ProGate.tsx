import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getMySubscription } from "@/lib/payments.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Wraps Pro-only routes. Redirects non-subscribers to /subscription.
 * Treats `active`, `trialing`, and `past_due` as authorized.
 */
export function ProGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const subFn = useServerFn(getMySubscription);
  const { data: sub, isLoading } = useQuery({
    queryKey: ["my-sub-progate"],
    queryFn: () => subFn(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = (sub as any)?.status ?? "none";
  const planCode = (sub as any)?.plan?.code ?? "";
  const isActive = ["trialing", "active", "past_due"].includes(status);
  const isPro = isActive && String(planCode).startsWith("pro_");

  if (!isPro) {
    return (
      <div className="container mx-auto max-w-2xl p-8">
        <Card className="gradient-card border-primary/40 p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/15">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {lang === "ar" ? "محتوى Pro حصري" : "Pro members only"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "ar"
              ? "هذه الصفحة متاحة لمشتركي باقة Pro فقط. قم بالترقية للوصول الكامل."
              : "This page is exclusive to Pro subscribers. Upgrade for full access."}
          </p>
          <Link to="/subscription" className="mt-6 inline-block">
            <Button className="gap-2">
              <Crown className="h-4 w-4" />
              {lang === "ar" ? "الترقية إلى Pro" : "Upgrade to Pro"}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
