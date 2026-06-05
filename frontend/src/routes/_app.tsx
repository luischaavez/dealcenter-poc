import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("dc_auth")) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
