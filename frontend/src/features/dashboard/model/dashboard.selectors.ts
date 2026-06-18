import { countBy } from "@/utils/collections";
import {
  opportunities,
  runStats,
} from "@/features/opportunities/model/opportunity.selectors";

const statusTierCounts = countBy(opportunities.map((opp) => opp.statusTier));

export const dashboardMetrics = {
  ingested: runStats.ingested,
  filtered: runStats.filtered,
  qualified: runStats.qualified,
  surfaced: runStats.surfaced,
  hot: statusTierCounts.hot ?? 0,
  warm: statusTierCounts.warm ?? 0,
  recentChanges: opportunities.filter((opp) => Boolean(opp.lastUpdated)).length,
  passThroughRate:
    runStats.ingested > 0 ? runStats.filtered / runStats.ingested : 0,
};

export const statusDistribution = Object.entries(
  countBy(opportunities.map((opp) => opp.status)),
).map(([status, count]) => ({ status, count }));

const scoreBuckets = [
  { bucket: "90-100", min: 90, max: 100 },
  { bucket: "80-89", min: 80, max: 89.999 },
  { bucket: "70-79", min: 70, max: 79.999 },
  { bucket: "60-69", min: 60, max: 69.999 },
  { bucket: "50-59", min: 50, max: 59.999 },
  { bucket: "0-49", min: 0, max: 49.999 },
];

export const pipelineByScore = scoreBuckets
  .map(({ bucket, min, max }) => ({
    bucket,
    count: opportunities.filter((opp) => opp.score >= min && opp.score <= max)
      .length,
  }))
  .filter((bucket) => bucket.count > 0);

export const revenueByStage = statusDistribution.map(({ status }) => ({
  stage: status,
  revenue: 0,
}));
