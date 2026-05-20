import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
} from "@/lib/paypal.functions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type PlanCode =
  | "quarterly" | "semi_annual" | "annual"
  | "pro_quarterly" | "pro_semi_annual" | "pro_annual";

interface Props {
  planCode: PlanCode;
  onSuccess?: () => void;
}

/**
 * PayPal subscription checkout button.
 * Opens PayPal in a popup; polls for closure and captures on return.
 */
export function PayPalCheckoutButton({ planCode, onSuccess }: Props) {
  const { lang } = useI18n();
  const createFn = useServerFn(createPayPalCheckoutOrder);
  const captureFn = useServerFn(capturePayPalCheckoutOrder);
  const [pendingOrder, setPendingOrder] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const startCheckout = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      return await createFn({
        data: {
          planCode,
          returnUrl: `${origin}/subscription?paypal=success`,
          cancelUrl: `${origin}/subscription?paypal=cancel`,
        },
      });
    },
    onSuccess: (res) => {
      if (!res?.approveUrl) {
        toast.error(lang === "ar" ? "تعذّر إنشاء الطلب" : "Failed to create order");
        return;
      }
      setPendingOrder(res.orderId);
      popupRef.current = window.open(res.approveUrl, "paypal-checkout", "width=480,height=720");
      if (!popupRef.current) {
        // Popup blocked — fall back to redirect.
        window.location.href = res.approveUrl;
      }
    },
    onError: (e: Error) =>
      toast.error(lang === "ar" ? "خطأ في PayPal: " + e.message : "PayPal error: " + e.message),
  });

  const capture = useMutation({
    mutationFn: (orderId: string) => captureFn({ data: { orderId } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success(lang === "ar" ? "تم تفعيل الاشتراك بنجاح" : "Subscription activated");
        onSuccess?.();
      } else {
        toast.error(lang === "ar" ? "لم يكتمل الدفع" : "Payment not completed");
      }
    },
    onError: (e: Error) =>
      toast.error(lang === "ar" ? "تعذّر التأكيد: " + e.message : "Capture failed: " + e.message),
  });

  // Poll popup for closure to trigger capture.
  useEffect(() => {
    if (!pendingOrder) return;
    const id = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(id);
        const orderId = pendingOrder;
        setPendingOrder(null);
        popupRef.current = null;
        capture.mutate(orderId);
      }
    }, 800);
    return () => clearInterval(id);
  }, [pendingOrder, capture]);

  // Also handle the case where PayPal redirects back in same tab (?paypal=success&token=ORDER_ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("paypal");
    const token = params.get("token");
    if (status === "success" && token) {
      capture.mutate(token);
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("paypal");
      url.searchParams.delete("token");
      url.searchParams.delete("PayerID");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = startCheckout.isPending || capture.isPending || !!pendingOrder;

  return (
    <Button
      type="button"
      onClick={() => startCheckout.mutate()}
      disabled={loading}
      className="w-full bg-[#0070ba] text-white hover:bg-[#005ea6]"
    >
      {loading ? (
        <>
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          {lang === "ar" ? "جارٍ التحويل إلى PayPal..." : "Redirecting to PayPal..."}
        </>
      ) : (
        <>{lang === "ar" ? "الدفع عبر PayPal" : "Pay with PayPal"}</>
      )}
    </Button>
  );
}
