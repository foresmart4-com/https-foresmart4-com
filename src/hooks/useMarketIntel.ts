import { useQuery } from "@tanstack/react-query";
import { getMarketIntel } from "@/services/analysis";
import type { AssetKey } from "@/services/market/marketData";

export function useMarketIntel(keys?: AssetKey[], refetchMs = 60_000) {
  return useQuery({
    queryKey: ["market-intel", keys?.join(",") ?? "all"],
    queryFn: () => getMarketIntel(keys),
    refetchInterval: refetchMs,
    refetchOnWindowFocus: false,
  });
}
