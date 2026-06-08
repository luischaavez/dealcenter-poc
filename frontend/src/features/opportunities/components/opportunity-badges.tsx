import { cn } from "@/utils/cn";
import type {
  OpportunityStatus,
  StatusTier,
} from "@/features/opportunities/model/opportunity.types";
import { formatStatusTier } from "@/features/opportunities/model/opportunity.selectors";

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const styles =
    status.includes("Award") || status.includes("Construction")
      ? "bg-[oklch(0.62_0.13_155/0.12)] text-[oklch(0.4_0.13_155)] border-[oklch(0.62_0.13_155/0.3)]"
      : status.includes("Bidding")
        ? "bg-[oklch(0.72_0.15_70/0.13)] text-[oklch(0.42_0.15_70)] border-[oklch(0.72_0.15_70/0.3)]"
        : "bg-[oklch(0.93_0.005_80)] text-[oklch(0.35_0.005_50)] border-[oklch(0.85_0.005_70)]";
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-1.5 rounded text-[10.5px] font-medium border tracking-wide whitespace-nowrap",
        styles,
      )}
    >
      {status}
    </span>
  );
}

export function StatusTierBadge({ tier }: { tier: StatusTier }) {
  const styles =
    tier === "hot"
      ? "bg-[oklch(0.605_0.21_28/0.10)] text-[oklch(0.5_0.21_28)] border-[oklch(0.605_0.21_28/0.3)]"
      : tier === "warm"
        ? "bg-[oklch(0.68_0.14_240/0.10)] text-[oklch(0.42_0.14_240)] border-[oklch(0.68_0.14_240/0.3)]"
        : "bg-[oklch(0.93_0.005_80)] text-[oklch(0.4_0.005_50)] border-[oklch(0.85_0.005_70)]";
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-1.5 rounded text-[10.5px] font-medium border tracking-wide uppercase",
        styles,
      )}
    >
      {formatStatusTier(tier)}
    </span>
  );
}

export function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 85
      ? "text-[oklch(0.5_0.21_28)]"
      : score >= 70
        ? "text-[oklch(0.42_0.14_240)]"
        : "text-charcoal";
  const bar =
    score >= 85 ? "bg-[#de422f]" : score >= 70 ? "bg-[#339CEC]" : "bg-charcoal";
  return (
    <div className="flex items-center gap-2 min-w-[68px]">
      <span
        className={cn("text-[13px] font-semibold num tabular-nums w-7", color)}
      >
        {score}
      </span>
      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full", bar)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
