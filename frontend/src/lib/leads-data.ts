import leadsDataJson from "../../../ui/data/leads_latest.json";

export type StatusTier = "hot" | "warm" | (string & {});
export type OpportunityStatus = string;
export type Service =
  | "Dumpster"
  | "Portable Toilet"
  | "Concrete Washout"
  | string;

type RawService = "dumpster" | "toilet" | "washout" | string;

interface LeadScorePart {
  points: number;
  max: number;
  label: string;
}

interface Lead {
  id: string;
  rank: number;
  score: number;
  score_breakdown: Record<string, LeadScorePart>;
  project: {
    title: string;
    status: string;
    status_tier: StatusTier;
    value: number | null;
    value_label?: string | null;
    categories: string[];
    construction_types: string[];
    location: {
      city: string;
      state: string;
      zip?: string | null;
      lat?: number | null;
      lng?: number | null;
    };
    dates: {
      bid?: string | null;
      start?: string | null;
      last_updated: string;
    };
    url: string;
  };
  companies: {
    name: string;
    city?: string | null;
  }[];
  qualification: {
    services: RawService[];
    why_actionable: string;
    recommended_action: string;
    factors: string[];
    blockers: string[];
  };
  revenue: {
    monthly_low: number;
    monthly_high: number;
    total_low: number;
    total_high: number;
    duration_months: number;
    basis: string;
  };
  // Sonnet-generated 3-paragraph sales narrative. Empty string if not yet generated.
  narrative_summary?: string;
  // Ledger change signal: "new" | "status_changed" | "updated" | null
  alert?: string | null;
  alert_detail?: string | null;
}

interface LeadsDataFile {
  run_id: string;
  generated_at: string;
  stats: {
    ingested: number;
    filtered: number;
    qualified: number;
    surfaced: number;
    states: string[];
    days_back: number;
  };
  leads: Lead[];
}

export interface ChangeEvent {
  date: string;
  label: string;
  detail: string;
  statusTier: StatusTier;
  opp: Opportunity;
}

export interface Opportunity {
  id: string;
  rank: number;
  score: number;
  name: string;
  status: OpportunityStatus;
  statusTier: StatusTier;
  city: string;
  state: string;
  projectValue: number;
  revenueOpportunity: number;
  revenueLow: number;
  revenueHigh: number;
  monthlyLow: number;
  monthlyHigh: number;
  durationMonths: number;
  revenueBasis: string;
  services: Service[];
  companies: { name: string; city?: string | null }[];
  source: string;
  sourceUrl: string;
  lastUpdated: string;
  bidDate?: string | null;
  startDate?: string | null;
  categories: string[];
  constructionTypes: string[];
  executiveSummary: string;
  whyActionable: string[];
  blockers: string[];
  recommendedAction: string;
  scoreBreakdown: { label: string; value: number; max: number }[];
  // Sonnet-generated 3-paragraph sales narrative (~150 words)
  salesBrief: string;
  // Ledger alert for this run
  alert: string | null;
  alertDetail: string | null;
}

const serviceLabels: Record<string, Service> = {
  dumpster: "Dumpster",
  toilet: "Portable Toilet",
  washout: "Concrete Washout",
};

const data = leadsDataJson as LeadsDataFile;

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

export const runId = data.run_id;
export const generatedAt = data.generated_at;
export const runStats = data.stats;

export const opportunities: Opportunity[] = data.leads
  .map((lead) => ({
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
    salesBrief: lead.narrative_summary ?? "",
    alert: lead.alert ?? null,
    alertDetail: lead.alert_detail ?? null,
  }))
  .sort((a, b) => a.rank - b.rank);

const unique = <T>(values: T[]) => Array.from(new Set(values));

export const allStatuses = unique(opportunities.map((opp) => opp.status));
export const allServices = unique(opportunities.flatMap((opp) => opp.services));
export const allStatusTiers = unique(
  opportunities.map((opp) => opp.statusTier),
);

const countBy = <T extends string>(values: T[]) =>
  values.reduce<Record<T, number>>(
    (acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }),
    {} as Record<T, number>,
  );

const statusTierCounts = countBy(opportunities.map((opp) => opp.statusTier));

export const dashboardMetrics = {
  ingested: data.stats.ingested,
  filtered: data.stats.filtered,
  qualified: data.stats.qualified,
  surfaced: data.stats.surfaced,
  hot: statusTierCounts.hot ?? 0,
  warm: statusTierCounts.warm ?? 0,
  revenuePotential: opportunities.reduce(
    (sum, opp) => sum + opp.revenueOpportunity,
    0,
  ),
  recentChanges: opportunities.filter((opp) => Boolean(opp.lastUpdated)).length,
  passThroughRate:
    data.stats.ingested > 0 ? data.stats.filtered / data.stats.ingested : 0,
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
  revenue: Math.round(
    opportunities
      .filter((opp) => opp.status === status)
      .reduce((sum, opp) => sum + opp.revenueOpportunity, 0) / 1000,
  ),
}));

export const activityEvents: ChangeEvent[] = opportunities
  .map((opp) => ({
    date: opp.lastUpdated,
    label:
      opp.alert === "new"
        ? "New project detected"
        : opp.alert === "status_changed"
          ? "Status changed"
          : opp.alert === "updated"
            ? "Details updated"
            : "Project active",
    detail:
      opp.alert === "status_changed" && opp.alertDetail
        ? opp.alertDetail
        : `${opp.status} / ${formatStatusTier(opp.statusTier)} tier`,
    statusTier: opp.statusTier,
    opp,
  }))
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const changeTrend = activityEvents.reduce<
  { day: string; changes: number; hot: number }[]
>((acc, event) => {
  const day = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "short",
  });
  const existing = acc.find((item) => item.day === day);
  if (existing) {
    existing.changes += 1;
    if (event.statusTier === "hot") existing.hot += 1;
    return acc;
  }
  acc.push({ day, changes: 1, hot: event.statusTier === "hot" ? 1 : 0 });
  return acc;
}, []);

export function formatStatusTier(tier: StatusTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function formatCurrency(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

export function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  if (diff < 14) return `${Math.floor(diff)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
