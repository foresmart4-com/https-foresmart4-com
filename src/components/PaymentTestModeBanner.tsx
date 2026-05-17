// Test-mode banner — visible only when running with a Stripe test publishable key.
// Safe to mount globally: renders nothing in production (live key).
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full bg-warning/15 border-b border-warning/40 px-4 py-1.5 text-center text-xs text-warning-foreground">
      <span className="font-semibold">وضع اختبار الدفع</span> — جميع المدفوعات وهمية (Stripe Test Mode). استخدم بطاقة <code className="px-1 rounded bg-warning/20">4242 4242 4242 4242</code>
    </div>
  );
}
