import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchTopLeads } from "@/lib/api";

export function useDashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: topLeads, isLoading: topLoading } = useQuery({
    queryKey: ["dashboard-top-leads"],
    queryFn: () => fetchTopLeads(5),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const passThroughRate = summary
    ? (summary.stats.ingested > 0 ? summary.stats.filtered / summary.stats.ingested : 0)
    : 0;

  return {
    generatedAt:        summary?.generated_at        ?? "",
    stats:              summary?.stats               ?? { ingested: 0, filtered: 0, qualified: 0, surfaced: 0, days_back: 0 },
    tiers:              summary?.tiers               ?? { hot: 0, warm: 0 },
    passThroughRate,
    statusDistribution: summary?.status_distribution ?? [],
    scoreDistribution:  summary?.score_distribution  ?? [],
    changeTrend:        summary?.change_trend        ?? [],
    topLeads:           topLeads                     ?? [],
    isLoading:          summaryLoading || topLoading,
  };
}
