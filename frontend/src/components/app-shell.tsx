import {
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  Target,
  Activity,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/opportunities", label: "Opportunities", icon: Target },
  { to: "/changes", label: "Change Monitor", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children?: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const current =
    navItems.find((i) => pathname.startsWith(i.to))?.label ?? "DealCenter";

  const logout = () => {
    if (typeof window !== "undefined") localStorage.removeItem("dc_auth");
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center">
            <div
              className="size-3 bg-sidebar-primary-foreground"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
              }}
            />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">
              DealCenter
            </div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55">
              Opportunity Intel
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/45">
            Workspace
          </div>
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary -ml-[2px] pl-[10px]"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="size-8 rounded-full bg-sidebar-accent flex items-center justify-center text-[11px] font-medium">
              UI
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[12px] font-medium truncate">
                Local session
              </div>
              <div className="text-[10px] text-sidebar-foreground/55 truncate">
                Prototype access
              </div>
            </div>
            <button
              onClick={logout}
              className="size-7 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-sidebar-foreground/65 hover:text-sidebar-accent-foreground"
              aria-label="Logout"
            >
              <LogOut className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center gap-4 px-6">
          <h1 className="text-[15px] font-semibold tracking-tight text-charcoal">
            {current}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search projects, GCs, cities…"
                className="h-8 w-72 rounded-md bg-background border border-border pl-8 pr-3 text-[12.5px] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/60"
              />
            </div>
            <button className="relative size-8 rounded-md border border-border bg-background hover:bg-secondary flex items-center justify-center">
              <Bell
                className="size-4 text-muted-foreground"
                strokeWidth={1.75}
              />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
            </button>
          </div>
        </header>
        <main className="flex-1 min-w-0">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
