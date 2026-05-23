import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getCredibilityReport } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const APIRoute = createAPIFileRoute("/api/public/genesis100/credibility")({
  GET: async () => {
    const report = getCredibilityReport();
    return Response.json({
      product: "ForeSmart Genesis 100",
      ...report,
      liveExecutionEnabled: false,
    });
  },
});
