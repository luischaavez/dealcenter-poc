import { useMemo } from "react";
import { useLeads } from "@/lib/use-leads";
import type { TopLead } from "@/lib/api";

const SCORE_BUCKETS = [
  { bucket: "90-100", min: 90, max: 101 },
  { bucket: "80-89",  min: 80, max: 90  },
  { bucket: "70-79",  min: 70, max: 80  },
  { bucket: "60-69",  min: 60, max: 70  },
  { bucket: "50-59",  min: 50, max: 60  },
  { bucket: "0-49",   min: 0,  max: 50  },
];

export function useDashboard() {
  const { opportunities, runStats, generatedAt, isLoading } = useLeads();

  const metrics = useMemo(() => {
    let hot = 0, warm = 0;
    const statusCounts: Record<string, number> = {};
    const trendMap: Record<string, { changes: number; hot: number }> = {};

    for (const opp of opportunities) {
      if (opp.statusTier === "hot") hot++;
      else if (opp.statusTier === "warm") warm++;

      statusCounts[opp.status] = (statusCounts[opp.status] ?? 0) + 1;

      if (opp.lastUpdated) {
        const day = new Date(opp.lastUpdated).toLocaleDateString("en-US", {
          weekday: "short",
        });
        if (!trendMap[day]) trendMap[day] = { changes: 0, hot: 0 };
        trendMap[day].changes++;
        if (opp.statusTier === "hot") trendMap[day].hot++;
      }
    }

    const statusDistribution = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const scoreDistribution = SCORE_BUCKETS
      .map(({ bucket, min, max }) => ({
        bucket,
        count: opportunities.filter((o) => o.score >= min && o.score < max).length,
      }))
      .filter((b) => b.count > 0);

    const changeTrend = Object.entries(trendMap).map(([day, v]) => ({
      day,
      changes: v.changes,
      hot: v.hot,
    }));

    const topLeads: TopLead[] = opportunities.slice(0, 5).map((o) => ({
      rank:        o.rank,
      id:          o.id,
      name:        o.name,
      status:      o.status,
      score:       o.score,
      status_tier: o.statusTier,
    }));

    const passThroughRate =
      runStats.ingested > 0 ? runStats.filtered / runStats.ingested : 0;

    return {
      generatedAt,
      stats: runStats,
      tiers: { hot, warm },
      passThroughRate,
      statusDistribution,
      scoreDistribution,
      changeTrend,
      topLeads,
    };
  }, [opportunities, runStats, generatedAt]);

  return { ...metrics, isLoading };
}
