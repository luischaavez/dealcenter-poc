import type { StatusTier } from "@/features/opportunities/model/opportunity.types";

type RawService = "dumpster" | "toilet" | "washout" | string;

interface LeadScorePart {
  points: number;
  max: number;
  label: string;
}

export interface Lead {
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
  narrative_summary?: string;
  alert?: string | null;
  alert_detail?: string | null;
}

export interface LeadsDataFile {
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
