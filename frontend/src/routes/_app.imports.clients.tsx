import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/features/imports/pages/import-page";

export const Route = createFileRoute("/_app/imports/clients")({
  component: ClientImportRoute,
});

function ClientImportRoute() {
  return <ImportPage kind="clients" />;
}
