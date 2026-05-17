import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { portfolioAllocation } from "@/lib/mock-data";
import { PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export function AllocationPanel() {
  const { lang } = useI18n();
  const data = portfolioAllocation.map((s) => ({
    name: lang === "ar" ? s.label_ar : s.label_en, value: s.value, color: s.color,
  }));
  return (
    <Card className="gradient-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><PieIcon className="h-4 w-4" /></span>
        <div>
          <h3 className="font-display text-lg font-bold">{lang === "ar" ? "توزيع الأصول" : "Asset Allocation"}</h3>
          <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "نسب تجريبية بناءً على بيانات الديمو" : "Demo allocation"}</p>
        </div>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="hsl(var(--background))">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => `${v}%`}
            />
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
