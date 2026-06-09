import {
  formatStatusTier,
  opportunities,
} from "@/features/opportunities/model/opportunity.selectors";
import type {
  Opportunity,
  StatusTier,
} from "@/features/opportunities/model/opportunity.types";

export interface ChangeEvent {
  date: string;
  label: string;
  detail: string;
  statusTier: StatusTier;
  opp: Opportunity;
}

export const activityEvents: ChangeEvent[] = opportunities
  .map((opp) => ({
    date: opp.lastUpdated,
    label: "Project updated",
    detail: `${opp.status} / ${formatStatusTier(opp.statusTier)} tier`,
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
