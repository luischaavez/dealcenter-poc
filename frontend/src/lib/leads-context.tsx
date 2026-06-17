/**
 * LeadsContext — provides live pipeline data to all app routes.
 *
 * Strategy:
 *   1. Serve static build-time data immediately (no loading flash, works offline).
 *   2. If VITE_API_URL is set, fetch from the API and replace with live data.
 *   3. All routes call useLeads() instead of importing static constants.
 */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  computeLeadsData,
  type ComputedLeadsData,
  type LeadsDataFile,
} from "./leads-data";

// Build-time static snapshot (immediate, no network)
import {
  runId as staticRunId,
  generatedAt as staticGeneratedAt,
  runStats as staticRunStats,
  opportunities as staticOpportunities,
  allStatuses as staticAllStatuses,
  allServices as staticAllServices,
  allStatusTiers as staticAllStatusTiers,
  dashboardMetrics as staticDashboardMetrics,
  statusDistribution as staticStatusDistribution,
  pipelineByScore as staticPipelineByScore,
  revenueByStage as staticRevenueByStage,
  activityEvents as staticActivityEvents,
  changeTrend as staticChangeTrend,
} from "./leads-data";

import { fetchLatestLeads } from "./api";
import { LeadsContext, type LeadsContextValue } from "./leads-context-value";

const STATIC: ComputedLeadsData = {
  runId: staticRunId,
  generatedAt: staticGeneratedAt,
  runStats: staticRunStats,
  opportunities: staticOpportunities,
  allStatuses: staticAllStatuses,
  allServices: staticAllServices,
  allStatusTiers: staticAllStatusTiers,
  dashboardMetrics: staticDashboardMetrics,
  statusDistribution: staticStatusDistribution,
  pipelineByScore: staticPipelineByScore,
  revenueByStage: staticRevenueByStage,
  activityEvents: staticActivityEvents,
  changeTrend: staticChangeTrend,
};

export function LeadsProvider({ children }: { children: ReactNode }) {
  const { data: apiPayload, isLoading } = useQuery({
    queryKey: ["leads-latest"],
    queryFn: fetchLatestLeads,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const computed: ComputedLeadsData = apiPayload
    ? computeLeadsData(apiPayload as unknown as LeadsDataFile)
    : STATIC;

  return (
    <LeadsContext.Provider
      value={{
        ...computed,
        isLive: Boolean(apiPayload),
        isLoading,
      }}
    >
      {children}
    </LeadsContext.Provider>
  );
}
