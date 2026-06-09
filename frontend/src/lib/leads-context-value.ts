import { createContext } from "react";
import type { ComputedLeadsData } from "./leads-data";

export interface LeadsContextValue extends ComputedLeadsData {
  isLive: boolean;
  isLoading: boolean;
}

export const LeadsContext = createContext<LeadsContextValue | null>(null);
