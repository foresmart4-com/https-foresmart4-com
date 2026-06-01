import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test-binance")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.BINANCE_API_KEY;
        const secret = process.env.BINANCE_SECRET_KEY;

        if (!key || !secret) {
          return new Response(
            JSON.stringify({ connected: false, error: "Keys missing" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const timestamp = Date.now();
          const queryString = `timestamp=${timestamp}`;

          const crypto = await import("crypto");
          const signature = crypto
            .createHmac("sha256", secret)
            .update(queryString)
            .digest("hex");

          const res = await fetch(
            `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
            { headers: { "X-MBX-APIKEY": key } },
          );

          if (res.ok) {
            const data = await res.json() as {
              balances?: Array<{ asset: string; free: string; locked: string }>;
              accountType?: string;
            };

            const nonZeroBalances =
              data.balances?.filter(
                (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0,
              ) ?? [];

            return new Response(
              JSON.stringify({
                connected: true,
                accountType: data.accountType,
                balancesCount: nonZeroBalances.length,
                balances: nonZeroBalances.slice(0, 10),
              }, null, 2),
              { headers: { "Content-Type": "application/json" } },
            );
          } else {
            const err = await res.json();
            return new Response(
              JSON.stringify({ connected: false, httpStatus: res.status, error: err }, null, 2),
              { headers: { "Content-Type": "application/json" } },
            );
          }
        } catch (err) {
          return new Response(
            JSON.stringify({
              connected: false,
              error: err instanceof Error ? err.message : String(err),
            }, null, 2),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
