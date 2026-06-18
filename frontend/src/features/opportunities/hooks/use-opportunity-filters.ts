import { useMemo, useState } from "react";
import { useLeads } from "@/lib/use-leads";
import { formatStatusTier } from "@/features/opportunities/model/opportunity.selectors";
import type {
  OpportunityStatus,
  Service,
  StatusTier,
} from "@/features/opportunities/model/opportunity.types";

export type OpportunitySortKey = "tier" | "score" | "revenue" | "updated";

export function useOpportunityFilters() {
  const {
    opportunities,
    allStatuses,
    allServices,
    allStatusTiers,
    isLoading,
  } = useLeads();

  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<OpportunityStatus[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tiers, setTiers] = useState<StatusTier[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [hotOnly, setHotOnly] = useState(false);
  const [sort, setSort] = useState<OpportunitySortKey>("tier");

  const filtered = useMemo(() => {
    return opportunities
      .filter((opportunity) => {
        if (q) {
          const term = q.toLowerCase();
          if (
            !opportunity.name.toLowerCase().includes(term) &&
            !opportunity.city.toLowerCase().includes(term) &&
            !opportunity.companies.some((company) =>
              company.name.toLowerCase().includes(term),
            )
          )
            return false;
        }
        if (statuses.length && !statuses.includes(opportunity.status))
          return false;
        if (
          services.length &&
          !services.every((service) => opportunity.services.includes(service))
        )
          return false;
        if (tiers.length && !tiers.includes(opportunity.statusTier))
          return false;
        if (opportunity.score < minScore) return false;
        if (hotOnly && opportunity.statusTier !== "hot") return false;
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "tier":
            return (
              (a.statusTier === "hot" ? 0 : 1) -
                (b.statusTier === "hot" ? 0 : 1) || b.score - a.score
            );
          case "score":
            return b.score - a.score;
          case "revenue":
            return b.revenueOpportunity - a.revenueOpportunity;
          case "updated":
            return (
              new Date(b.lastUpdated).getTime() -
              new Date(a.lastUpdated).getTime()
            );
        }
      });
  }, [q, statuses, services, tiers, minScore, hotOnly, sort, opportunities]);

  const kpis = useMemo(() => {
    const hot = opportunities.filter((o) => o.statusTier === "hot").length;
    const warm = opportunities.filter((o) => o.statusTier === "warm").length;
    const updated = opportunities.length;
    const pipeline = opportunities.reduce(
      (sum, opportunity) => sum + opportunity.revenueOpportunity,
      0,
    );
    return { hot, warm, updated, pipeline };
  }, [opportunities]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...statuses.map((status) => ({
      key: `s-${status}`,
      label: `Status: ${status}`,
      clear: () => setStatuses(statuses.filter((value) => value !== status)),
    })),
    ...services.map((service) => ({
      key: `sv-${service}`,
      label: `Service: ${service}`,
      clear: () => setServices(services.filter((value) => value !== service)),
    })),
    ...tiers.map((tier) => ({
      key: `p-${tier}`,
      label: `Tier: ${formatStatusTier(tier)}`,
      clear: () => setTiers(tiers.filter((value) => value !== tier)),
    })),
    ...(minScore > 0
      ? [
          {
            key: "ms",
            label: `Score ≥ ${minScore}`,
            clear: () => setMinScore(0),
          },
        ]
      : []),
    ...(hotOnly
      ? [{ key: "hot", label: "Hot tier only", clear: () => setHotOnly(false) }]
      : []),
  ];

  const clearAll = () => {
    setStatuses([]);
    setServices([]);
    setTiers([]);
    setMinScore(0);
    setHotOnly(false);
    setQ("");
  };

  return {
    activeFilters,
    allServices,
    allStatuses,
    allStatusTiers,
    clearAll,
    filtered,
    hotOnly,
    isLoading,
    kpis,
    minScore,
    opportunities,
    q,
    services,
    setHotOnly,
    setMinScore,
    setQ,
    setServices,
    setSort,
    setStatuses,
    setTiers,
    sort,
    statuses,
    tiers,
  };
}
