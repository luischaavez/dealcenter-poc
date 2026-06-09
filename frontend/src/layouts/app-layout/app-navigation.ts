import {
  Activity,
  LayoutDashboard,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";

export const appNavigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/opportunities", label: "Opportunities", icon: Target },
  { to: "/changes", label: "Change Monitor", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];
