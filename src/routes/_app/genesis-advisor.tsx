import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/genesis-advisor")({
  component: RedirectToGenesis,
});

function RedirectToGenesis() {
  return <Navigate to="/genesis" />;
}
