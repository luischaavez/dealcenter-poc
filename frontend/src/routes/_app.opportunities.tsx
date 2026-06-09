import { createFileRoute } from "@tanstack/react-router";
import { OpportunitiesPage } from "@/features/opportunities/pages/opportunities-page";

export const Route = createFileRoute("/_app/opportunities")({
  component: OpportunitiesPage,
});
