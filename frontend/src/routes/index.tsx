import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("dc_auth")) {
        throw redirect({ to: "/dashboard" });
      }
      throw redirect({ to: "/auth" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
