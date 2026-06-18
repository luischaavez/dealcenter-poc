import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/features/imports/pages/import-page";

export const Route = createFileRoute("/_app/imports/opportunities")({
  component: OpportunityImportRoute,
});

function OpportunityImportRoute() {
  return <ImportPage kind="opportunities" />;
}
