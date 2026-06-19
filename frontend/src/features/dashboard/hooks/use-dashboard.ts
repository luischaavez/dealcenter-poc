import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLeads } from "@/lib/use-leads";
import { fetchDashboard, fetchTopLeads, type TopLead } from "@/lib/api";
import type { Opportunity } from "@/features/opportunities/model/opportunity.types";

const API_ENABLED = Boolean(import.meta.env.VITE_API_URL);

const SCORE_BUCKETS = [
  { bucket: "90-100", min: 90, max: 101 },
  { bucket: "80-89",  min: 80, max: 90  },
  { bucket: "70-79",  min: 70, max: 80  },
  { bucket: "60-69",  min: 60, max: 70  },
  { bucket: "50-59",  min: 50, max: 60  },
  { bucket: "0-49",   min: 0,  max: 50  },
];

function computeFromLeads(
  opportunities: Opportunity[],
  runStats: { ingested: number; filtered: number; qualified: number; surfaced: number; days_back: number },
  generatedAt: string,
) {
  let hot = 0, warm = 0;
  const statusCounts: Record<string, number> = {};
  const trendMap: Record<string, { changes: number; hot: number }> = {};

  for (const opp of opportunities) {
    if (opp.statusTier === "hot") hot++;
    else if (opp.statusTier === "warm") warm++;
    statusCounts[opp.status] = (statusCounts[opp.status] ?? 0) + 1;

    if (opp.lastUpdated) {
      const day = new Date(opp.lastUpdated).toLocaleDateString("en-US", { weekday: "short" });
      if (!trendMap[day]) trendMap[day] = { changes: 0, hot: 0 };
      trendMap[day].changes++;
      if (opp.statusTier === "hot") trendMap[day].hot++;
    }
  }

  return {
    generatedAt,
    stats: runStats,
    tiers: { hot, warm },
    passThroughRate: runStats.ingested > 0 ? runStats.filtered / runStats.ingested : 0,
    statusDistribution: Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    scoreDistribution: SCORE_BUCKETS
      .map(({ bucket, min, max }) => ({
        bucket,
        count: opportunities.filter((o) => o.score >= min && o.score < max).length,
      }))
      .filter((b) => b.count > 0),
    changeTrend: Object.entries(trendMap).map(([day, v]) => ({ day, ...v })),
    topLeads: opportunities.slice(0, 5).map((o): TopLead => ({
      rank:        o.rank,
      id:          o.id,
      name:        o.name,
      status:      o.status,
      score:       o.score,
      status_tier: o.statusTier,
    })),
  };
}

export function useDashboard() {
  // ── Dedicated API endpoints (used when API is configured) ──────────────────
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    enabled: API_ENABLED,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: apiTopLeads, isLoading: topLoading } = useQuery({
    queryKey: ["dashboard-top-leads"],
    queryFn: () => fetchTopLeads(5),
    enabled: API_ENABLED,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // ── Static build fallback (used when VITE_API_URL is not set) ─────────────
  const { opportunities, runStats, generatedAt } = useLeads();
  const fallback = useMemo(
    () => computeFromLeads(opportunities, runStats, generatedAt),
    [opportunities, runStats, generatedAt],
  );

  if (API_ENABLED) {
    const passThroughRate = summary
      ? (summary.stats.ingested > 0 ? summary.stats.filtered / summary.stats.ingested : 0)
      : fallback.passThroughRate;

    return {
      generatedAt:        summary?.generated_at        ?? fallback.generatedAt,
      stats:              summary?.stats               ?? fallback.stats,
      tiers:              summary?.tiers               ?? fallback.tiers,
      passThroughRate,
      statusDistribution: summary?.status_distribution ?? fallback.statusDistribution,
      scoreDistribution:  summary?.score_distribution  ?? fallback.scoreDistribution,
      changeTrend:        summary?.change_trend        ?? fallback.changeTrend,
      topLeads:           apiTopLeads                  ?? fallback.topLeads,
      isLoading:          summaryLoading || topLoading,
    };
  }

  return { ...fallback, isLoading: false };
}
