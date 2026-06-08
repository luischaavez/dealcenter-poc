import { Outlet, useRouterState } from "@tanstack/react-router";
import { AppHeader } from "./app-header";
import { appNavigation } from "./app-navigation";
import { AppSidebar } from "./app-sidebar";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    appNavigation.find((item) => pathname.startsWith(item.to))?.label ??
    "DealCenter";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar pathname={pathname} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader title={current} />
        <main className="flex-1 min-w-0">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
