import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { AUTH_STORAGE_KEY } from "@/constants/storage";
import { cn } from "@/utils/cn";
import { appNavigation } from "./app-navigation";

export function AppSidebar({ pathname }: { pathname: string }) {
  const navigate = useNavigate();

  const logout = () => {
    if (typeof window !== "undefined")
      localStorage.removeItem(AUTH_STORAGE_KEY);
    navigate({ to: "/auth" });
  };

  return (
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
        {appNavigation.map((item) => {
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
  );
}
