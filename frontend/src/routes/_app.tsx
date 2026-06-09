import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/layouts/app-layout/app-layout";
import { AUTH_STORAGE_KEY } from "@/constants/storage";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
