import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/portfolio-ai")({
  component: () => <Navigate to="/genesis-100" />,
  head: () => ({
    meta: [{ title: "ForeSmart Genesis 100" }],
  }),
});
