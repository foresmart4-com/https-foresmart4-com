import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ASSET_PICKER, CATEGORY_LABELS, type IntelCategory, type PickerAsset } from "@/lib/asset-picker";
import { Search } from "lucide-react";

const CAT_TO_TYPE: Record<IntelCategory, "US_STOCK"|"SAUDI_STOCK"|"CRYPTO"|"METAL"|"COMMODITY"|"BOND"|"ETF"> = {
  us_stock: "US_STOCK",
  sa_stock: "SAUDI_STOCK",
  crypto: "CRYPTO",
  metal: "METAL",
  commodity: "COMMODITY",
  etf_bond: "ETF",
};

export interface PickedAsset {
  symbol: string;
  name: string;
  asset_type: "US_STOCK"|"SAUDI_STOCK"|"CRYPTO"|"METAL"|"COMMODITY"|"BOND"|"ETF"|"CASH";
  market: string;
  category: IntelCategory;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (a: PickedAsset) => void;
  title?: string;
}

export function AssetPickerDialog({ open, onOpenChange, onPick, title }: Props) {
  const [cat, setCat] = useState<IntelCategory>("us_stock");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const list: PickerAsset[] = ASSET_PICKER[cat] ?? [];
    const ql = q.trim().toLowerCase();
    if (!ql) return list;
    return list.filter((a) =>
      a.symbol.toLowerCase().includes(ql) ||
      a.name.toLowerCase().includes(ql) ||
      (a.nameAr ?? "").includes(ql)
    );
  }, [cat, q]);

  const pick = (a: PickerAsset) => {
    onPick({
      symbol: a.symbol,
      name: a.nameAr ?? a.name,
      asset_type: CAT_TO_TYPE[a.category],
      market: CATEGORY_LABELS[a.category].ar,
      category: a.category,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title ?? "اختيار أصل"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as IntelCategory[]).map((c) => (
            <Button key={c} variant={cat === c ? "default" : "outline"} size="sm" onClick={() => setCat(c)}>
              {CATEGORY_LABELS[c].ar}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو الرمز…"
            className="pr-8"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto space-y-1">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد نتائج</p>
          )}
          {items.map((a) => (
            <button
              key={a.symbol}
              onClick={() => pick(a)}
              className="w-full flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/40 hover:bg-card/80 transition px-3 py-2 text-right"
            >
              <Badge variant="outline" className="text-[10px] font-mono">{a.symbol}</Badge>
              <span className="flex-1 text-sm truncate">{a.nameAr ?? a.name}</span>
              <span className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[a.category].ar}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
