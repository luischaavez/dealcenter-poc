import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Filter } from "lucide-react";
import { formatRelative } from "@/lib/leads-data";
import { useLeads } from "@/lib/leads-context";
import { StatusBadge, StatusTierBadge } from "@/components/badges";
import { OpportunityDrawer } from "@/components/opportunity-drawer";
import type { ChangeEvent, Opportunity } from "@/lib/leads-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/changes")({
  component: ChangesPage,
});

type Row = ChangeEvent;

function ChangesPage() {
  const { activityEvents } = useLeads();
  const [filter, setFilter] = useState<"all" | "hot" | "warm">("all");
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const rows: Row[] = useMemo(() => activityEvents, [activityEvents]);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "hot") return r.statusTier === "hot";
    if (filter === "warm") return r.statusTier === "warm";
    return true;
  });

  const hotCount = rows.filter((r) => r.statusTier === "hot").length;
  const warmCount = rows.filter((r) => r.statusTier === "warm").length;

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Change monitor · Source updates
          </p>
          <h2 className="text-[22px] font-semibold tracking-tight text-charcoal mt-1">
            Pipeline movements
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden mb-5">
        <Tile
          label="Total changes"
          value={rows.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <Tile
          label="Hot tier"
          value={hotCount}
          accent="text-[oklch(0.5_0.21_28)]"
          active={filter === "hot"}
          onClick={() => setFilter("hot")}
        />
        <Tile
          label="Warm tier"
          value={warmCount}
          accent="text-[oklch(0.42_0.14_240)]"
          active={filter === "warm"}
          onClick={() => setFilter("warm")}
        />
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-charcoal">
            Activity feed
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} events
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-[13px]">
            <Filter className="size-6 mx-auto mb-2 opacity-40" />
            No changes match this filter.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r, i) => (
              <li
                key={i}
                onClick={() => setSelected(r.opp)}
                className={cn(
                  "flex gap-4 px-4 py-3.5 hover:bg-secondary/40 cursor-pointer items-start",
                  r.statusTier === "hot" &&
                    "border-l-2 border-[#de422f] -ml-px",
                )}
              >
                <div className="flex flex-col items-center pt-0.5 w-14 shrink-0">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatRelative(r.date)}
                  </span>
                </div>

                <div
                  className="size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background:
                      r.statusTier === "hot"
                        ? "oklch(0.605 0.21 28 / 0.12)"
                        : "oklch(0.68 0.14 240 / 0.12)",
                  }}
                >
                  {r.statusTier === "hot" ? (
                    <AlertTriangle
                      className="size-3.5 text-[#de422f]"
                      strokeWidth={2}
                    />
                  ) : (
                    <ArrowRight
                      className="size-3.5 text-[#339CEC]"
                      strokeWidth={2}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-charcoal">
                      {r.label}
                    </span>
                    <StatusTierBadge tier={r.statusTier} />
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {r.detail}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11.5px] text-foreground/85 font-medium">
                      {r.opp.name}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <StatusBadge status={r.opp.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {r.opp.city}, {r.opp.state}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    Score
                  </div>
                  <div className="text-[16px] font-semibold num text-charcoal">
                    {r.opp.score}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <OpportunityDrawer opp={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card p-4 text-left transition-colors",
        active ? "bg-secondary/60" : "hover:bg-secondary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        {active && <span className="size-1.5 rounded-full bg-primary" />}
      </div>
      <div
        className={cn(
          "text-[22px] font-semibold tracking-tight num mt-1",
          accent ?? "text-charcoal",
        )}
      >
        {value}
      </div>
    </button>
  );
}
