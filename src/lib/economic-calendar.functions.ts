import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


interface EconEvent {
  date: string; time: string; country: string; flag: string;
  event: string; impact: "low" | "medium" | "high";
  previous?: string; forecast?: string;
}

// Try Trading Economics free guest endpoint; fall back to a curated rolling weekly schedule.
async function fetchLive(): Promise<EconEvent[] | null> {
  try {
    const cred = process.env.TRADING_ECONOMICS_KEY || "guest:guest";
    const r = await fetch(`https://api.tradingeconomics.com/calendar?c=${cred}&f=json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{
      Date: string; Country: string; Event: string; Importance: number;
      Previous?: string | number; Forecast?: string | number;
    }>;
    const flags: Record<string, string> = {
      "United States": "🇺🇸", "Euro Area": "🇪🇺", "Germany": "🇩🇪", "United Kingdom": "🇬🇧",
      "China": "🇨🇳", "Japan": "🇯🇵", "Saudi Arabia": "🇸🇦", "United Arab Emirates": "🇦🇪",
      "India": "🇮🇳", "Canada": "🇨🇦", "Australia": "🇦🇺", "France": "🇫🇷", "Switzerland": "🇨🇭",
    };
    const now = Date.now();
    const week = now + 7 * 86400000;
    return data
      .filter((e) => {
        const t = Date.parse(e.Date);
        return t >= now && t <= week;
      })
      .slice(0, 50)
      .map((e) => {
        const d = new Date(e.Date);
        return {
          date: d.toISOString().slice(0, 10),
          time: d.toISOString().slice(11, 16),
          country: e.Country,
          flag: flags[e.Country] || "🌐",
          event: e.Event,
          impact: e.Importance >= 3 ? "high" : e.Importance === 2 ? "medium" : "low",
          previous: e.Previous?.toString(),
          forecast: e.Forecast?.toString(),
        } as EconEvent;
      });
  } catch { return null; }
}

function syntheticWeekly(): EconEvent[] {
  const baseEvents: Omit<EconEvent, "date" | "time">[] = [
    { country: "United States", flag: "🇺🇸", event: "CPI Inflation YoY", impact: "high", forecast: "2.7%", previous: "2.6%" },
    { country: "United States", flag: "🇺🇸", event: "FOMC Interest Rate Decision", impact: "high", forecast: "4.50%", previous: "4.50%" },
    { country: "United States", flag: "🇺🇸", event: "Non-Farm Payrolls", impact: "high", forecast: "180K", previous: "143K" },
    { country: "Euro Area", flag: "🇪🇺", event: "ECB Press Conference", impact: "high" },
    { country: "United Kingdom", flag: "🇬🇧", event: "BoE Interest Rate Decision", impact: "high", forecast: "4.50%", previous: "4.75%" },
    { country: "China", flag: "🇨🇳", event: "Industrial Production YoY", impact: "medium", forecast: "5.6%", previous: "5.4%" },
    { country: "Japan", flag: "🇯🇵", event: "BoJ Rate Decision", impact: "high", forecast: "0.50%", previous: "0.50%" },
    { country: "Germany", flag: "🇩🇪", event: "ZEW Economic Sentiment", impact: "medium", forecast: "12.0", previous: "10.3" },
    { country: "Saudi Arabia", flag: "🇸🇦", event: "GDP Growth Rate YoY", impact: "medium", forecast: "2.8%", previous: "2.5%" },
    { country: "United Arab Emirates", flag: "🇦🇪", event: "Inflation Rate YoY", impact: "low", forecast: "2.1%", previous: "2.0%" },
    { country: "United States", flag: "🇺🇸", event: "Initial Jobless Claims", impact: "medium", forecast: "215K", previous: "220K" },
    { country: "United States", flag: "🇺🇸", event: "Crude Oil Inventories", impact: "medium" },
    { country: "Euro Area", flag: "🇪🇺", event: "PMI Composite Flash", impact: "medium", forecast: "50.4", previous: "50.2" },
    { country: "China", flag: "🇨🇳", event: "PBOC Loan Prime Rate", impact: "high", forecast: "3.10%", previous: "3.10%" },
  ];
  const now = new Date();
  return baseEvents.map((e, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + Math.floor(i / 2));
    d.setHours(8 + (i % 8), (i * 15) % 60, 0, 0);
    return {
      ...e,
      date: d.toISOString().slice(0, 10),
      time: d.toISOString().slice(11, 16),
    };
  });
}

export const getEconomicEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const hasKey = !!process.env.TRADING_ECONOMICS_KEY;
    const live = await fetchLive();
    if (live && live.length > 0) {
      return { events: live, fetchedAt: Date.now(), source: hasKey ? "Trading Economics" : "Trading Economics (guest)", mode: hasKey ? "live" : "delayed" as const };
    }
    return { events: syntheticWeekly(), fetchedAt: Date.now(), source: "synthetic weekly schedule", mode: "mock" as const };
  });
