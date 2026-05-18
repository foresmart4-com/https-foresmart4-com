import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Info, Ban, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/deposit")({ component: DepositPage });

function DepositPage() {
  const { lang, dir } = useI18n();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {lang === "ar" ? "الإيداع غير متاح" : "Deposits unavailable"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "ForeSmart منصة تحليلات بالذكاء الاصطناعي — لا تقبل ولا تحتفظ بأي أموال للمستخدمين."
              : "ForeSmart is an AI analytics platform — we do not accept or hold any user funds."}
          </p>
        </div>
        <Link to="/wallet">
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {lang === "ar" ? "المحفظة التجريبية" : "Demo portfolio"}
          </Button>
        </Link>
      </div>

      <Card className="gradient-card p-8 space-y-5 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Ban className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-bold">
          {lang === "ar" ? "لا توجد تدفقات أموال حقيقية على هذه المنصة" : "No real-money flows on this platform"}
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground leading-relaxed">
          {lang === "ar"
            ? "تم تعطيل الإيداع، السحب، والتنفيذ بأموال حقيقية. ForeSmart يقدّم تحليلات مالية بالذكاء الاصطناعي ورؤى تعليمية وذكاء سوقي فقط — لا نقدم خدمات وساطة، حفظ أصول، أو إدارة استثمار. يتم تقديم الأرصدة والمحافظ كأرصدة تجريبية ومحاكاة افتراضية لأغراض التعلم والتحليل."
            : "Deposits, withdrawals, and real-money execution are disabled. ForeSmart provides only AI financial analytics, educational insights, and market intelligence — no brokerage, custody, or investment management. All balances and portfolios shown are demo balances and simulated portfolios for learning and analysis."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/subscription">
            <Button className="gap-2"><Sparkles className="h-4 w-4" />
              {lang === "ar" ? "خطط الاشتراك (SaaS)" : "Subscription plans (SaaS)"}
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline">
              {lang === "ar" ? "الذهاب إلى لوحة التحكم" : "Go to dashboard"}
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {lang === "ar"
              ? "إذا كنت ترغب بتنفيذ صفقات حقيقية، استخدم وسيطك المرخّص. ForeSmart يقدم فقط أدوات تحليل وتوصيات تعليمية."
              : "If you wish to execute real trades, please use your own licensed broker. ForeSmart provides only analytical tools and educational recommendations."}
          </p>
        </div>
      </Card>
    </div>
  );
}
