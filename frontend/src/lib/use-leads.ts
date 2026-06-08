import { useContext } from "react";
import { LeadsContext } from "./leads-context-value";

export function useLeads() {
  const context = useContext(LeadsContext);

  if (!context) {
    throw new Error("useLeads must be used within a LeadsProvider.");
  }

  return context;
}
