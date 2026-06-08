import type { Opportunity } from "@/features/opportunities/model/opportunity.types";
import { serviceLabels } from "@/features/opportunities/model/opportunity.constants";
import type { Lead } from "./leads.types";

const midpoint = (low: number, high: number) => Math.round((low + high) / 2);

const getSourceName = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^app\./, "");
    return host
      .split(".")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(".");
  } catch {
    return "Project source";
  }
};

export function adaptLead(lead: Lead): Opportunity {
  return {
    id: lead.id,
    rank: lead.rank,
    score: lead.score,
    name: lead.project.title,
    status: lead.project.status,
    statusTier: lead.project.status_tier,
    city: lead.project.location.city,
    state: lead.project.location.state,
    projectValue: lead.project.value ?? 0,
    revenueOpportunity: midpoint(
      lead.revenue.total_low,
      lead.revenue.total_high,
    ),
    revenueLow: lead.revenue.total_low,
    revenueHigh: lead.revenue.total_high,
    monthlyLow: lead.revenue.monthly_low,
    monthlyHigh: lead.revenue.monthly_high,
    durationMonths: lead.revenue.duration_months,
    revenueBasis: lead.revenue.basis,
    services: lead.qualification.services.map(
      (service) => serviceLabels[service] ?? service,
    ),
    companies: lead.companies,
    source: getSourceName(lead.project.url),
    sourceUrl: lead.project.url,
    lastUpdated: lead.project.dates.last_updated,
    bidDate: lead.project.dates.bid,
    startDate: lead.project.dates.start,
    categories: lead.project.categories,
    constructionTypes: lead.project.construction_types,
    executiveSummary: lead.qualification.why_actionable,
    whyActionable: lead.qualification.factors,
    blockers: lead.qualification.blockers,
    recommendedAction: lead.qualification.recommended_action,
    scoreBreakdown: Object.values(lead.score_breakdown).map((part) => ({
      label: part.label,
      value: part.points,
      max: part.max,
    })),
  };
}
