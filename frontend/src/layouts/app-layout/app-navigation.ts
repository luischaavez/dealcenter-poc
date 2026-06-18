import {
  Activity,
  LayoutDashboard,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";

export const appNavigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/opportunities", label: "Opportunities", icon: Target },
  // { to: "/changes", label: "Change Monitor", icon: Activity },
  // Hidden — currently mirrors Opportunities. Restore when alert-based
  // change tracking (status_changed, new, updated) is wired to the feed.
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];
