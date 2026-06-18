export const settingsTabs = [
  { id: "sources", label: "Data sources" },
  { id: "imports", label: "Dodge imports" },
  { id: "customer-imports", label: "Customer imports" },
  { id: "scoring", label: "Scoring & filters" },
  { id: "notifications", label: "Notifications" },
  { id: "users", label: "Users & roles" },
  { id: "integrations", label: "Integrations" },
] as const;

export type SettingsTab = (typeof settingsTabs)[number]["id"];
