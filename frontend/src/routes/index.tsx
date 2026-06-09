import { createFileRoute, redirect } from "@tanstack/react-router";
import { AUTH_STORAGE_KEY } from "@/constants/storage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem(AUTH_STORAGE_KEY)) {
        throw redirect({ to: "/dashboard" });
      }
      throw redirect({ to: "/auth" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
