import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/features/auth/pages/auth-page";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});
