export type StatusTier = "hot" | "warm" | (string & {});
export type OpportunityStatus = string;
export type Service =
  | "Dumpster"
  | "Portable Toilet"
  | "Concrete Washout"
  | string;

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
}
