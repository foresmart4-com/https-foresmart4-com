import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ai")({
  component: () => <Navigate to="/genesis-100" />,
});
