import { leadsData } from "@/data/leads/leads-source";
import { adaptLead } from "@/data/leads/leads-adapter";
import { unique } from "@/utils/collections";
import type { StatusTier } from "./opportunity.types";

export const runId = leadsData.run_id;
export const generatedAt = leadsData.generated_at;
export const runStats = leadsData.stats;

export const opportunities = leadsData.leads
  .map(adaptLead)
  .sort((a, b) => a.rank - b.rank);

export const allStatuses = unique(opportunities.map((opp) => opp.status));
export const allServices = unique(opportunities.flatMap((opp) => opp.services));
export const allStatusTiers = unique(
  opportunities.map((opp) => opp.statusTier),
);

export function formatStatusTier(tier: StatusTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
