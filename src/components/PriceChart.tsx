import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useI18n } from "@/lib/i18n";
import type { AssetQuote } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export function PriceChart({ asset }: { asset: AssetQuote }) {
  const { t, lang } = useI18n();
  const data = useMemo(
    () =>
      asset.history.map((p) => ({
        time: new Date(p.t).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", {
          hour: "2-digit", minute: "2-digit",
        }),
        price: p.p,
      })),
    [asset, lang],
  );
  const up = asset.changePct >= 0;

  return (
    <div className="h-72 w-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{asset.name}</div>
          <div className="font-display text-2xl font-bold">
            {asset.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
        </div>
        <div className={cn("rounded-md px-2 py-1 text-sm font-semibold", up ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
          {up ? "▲" : "▼"} {asset.changePct.toFixed(2)}%
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-1">{t("last24h")}</div>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.74 0.16 175)" />
              <stop offset="100%" stopColor="oklch(0.65 0.22 290)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={["auto", "auto"]} tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }} width={50} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.22 0.035 250)",
              border: "1px solid oklch(0.3 0.03 250)",
              borderRadius: 8,
              color: "oklch(0.97 0.01 250)",
            }}
            formatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          />
          <Line type="monotone" dataKey="price" stroke="url(#g)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
