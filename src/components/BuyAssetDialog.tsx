import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { getWallet, ensureDefaultPortfolio, placeOrder } from "@/lib/wallet.functions";
import { toast } from "sonner";
import { Wallet, ShoppingCart, AlertTriangle } from "lucide-react";

interface BuyTarget {
  symbol: string;
  name?: string;
  market?: string;
  price: number;
  currency?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: BuyTarget | null;
  side?: "buy" | "sell";
}

export function BuyAssetDialog({ open, onOpenChange, asset, side = "buy" }: Props) {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");

  useEffect(() => { if (open) setQty("1"); }, [open]);

  const walletQ = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet(), enabled: open });
  const portfolioQ = useQuery({
    queryKey: ["default-portfolio"],
    queryFn: () => ensureDefaultPortfolio(),
    enabled: open,
  });

  const order = useMutation({
    mutationFn: async () => {
      if (!asset || !portfolioQ.data) throw new Error("Missing data");
      return placeOrder({
        data: {
          portfolioId: portfolioQ.data.id,
          symbol: asset.symbol,
          assetName: asset.name,
          market: asset.market,
          side,
          quantity: Number(qty),
          price: asset.price,
        },
      });
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تنفيذ الأمر بنجاح (محاكاة)" : "Order executed (paper trading)");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["portfolios"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quantity = Number(qty) || 0;
  const total = quantity * (asset?.price ?? 0);
  const balance = Number(walletQ.data?.wallet?.balance ?? 0);
  const insufficient = side === "buy" && total > balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {side === "buy"
              ? (lang === "ar" ? `شراء ${asset?.symbol ?? ""}` : `Buy ${asset?.symbol ?? ""}`)
              : (lang === "ar" ? `بيع ${asset?.symbol ?? ""}` : `Sell ${asset?.symbol ?? ""}`)}
          </DialogTitle>
          <DialogDescription>
            {asset?.name} — {asset?.price.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset?.currency ?? "USD"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {lang === "ar"
                ? "تنفيذ محاكاة باستخدام رصيد المحفظة الداخلي. لربط وسيط حقيقي لاحقاً، يمكن إضافة Alpaca أو غيره."
                : "Paper trading using internal wallet balance. Real broker (Alpaca) integration can be added later."}
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                {lang === "ar" ? "رصيد المحفظة" : "Wallet balance"}
              </span>
              <span className="font-semibold">{balance.toLocaleString()} {walletQ.data?.wallet?.currency ?? "USD"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{lang === "ar" ? "الكمية" : "Quantity"}</Label>
            <Input type="number" min="0" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-sm">
            <span className="text-muted-foreground">{lang === "ar" ? "الإجمالي" : "Total"}</span>
            <span className="font-display text-lg font-bold">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {asset?.currency ?? "USD"}</span>
          </div>

          {insufficient && (
            <p className="text-xs text-danger">
              {lang === "ar" ? "الرصيد غير كافٍ لإتمام الشراء." : "Insufficient balance."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button
            onClick={() => order.mutate()}
            disabled={!asset || quantity <= 0 || insufficient || order.isPending || !portfolioQ.data}
          >
            {order.isPending ? (lang === "ar" ? "جارٍ التنفيذ..." : "Processing...") : (side === "buy" ? (lang === "ar" ? "تأكيد الشراء" : "Confirm buy") : (lang === "ar" ? "تأكيد البيع" : "Confirm sell"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
