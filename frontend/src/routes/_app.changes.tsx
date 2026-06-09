import { createFileRoute } from "@tanstack/react-router";
import { ChangeMonitorPage } from "@/features/change-monitor/pages/change-monitor-page";

export const Route = createFileRoute("/_app/changes")({
  component: ChangeMonitorPage,
});
