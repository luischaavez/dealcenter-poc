import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Filter,
  MapPin,
  MoreHorizontal,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { RunPipelineButton } from "@/features/pipeline/components/run-pipeline-button";
import { formatStatusTier } from "@/features/opportunities/model/opportunity.selectors";
import type {
  Opportunity,
  OpportunityStatus,
} from "@/features/opportunities/model/opportunity.types";
import { OpportunityDrawer } from "@/features/opportunities/components/opportunity-drawer";
import { OpportunitiesLoadingState } from "@/features/opportunities/components/opportunities-loading-state";
import { StatusTierBadge } from "@/features/opportunities/components/opportunity-badges";
import { FilterPopover } from "@/features/opportunities/components/filter-popover";
import { ScorePopover } from "@/features/opportunities/components/score-popover";
import { formatRelative } from "@/utils/date";
import { cn } from "@/utils/cn";
import {
  useOpportunityFilters,
  type OpportunitySortKey,
} from "@/features/opportunities/hooks/use-opportunity-filters";
import { Checkbox } from "@/components/ui/checkbox";

const PER_PAGE = 20;

export function OpportunitiesPage() {
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const {
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
  } = useOpportunityFilters();

  const selectedOpportunities = useMemo(
    () => opportunities.filter((opp) => selectedIds.has(opp.id)),
    [opportunities, selectedIds],
  );

  // Reset to page 1 whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [filtered.length, q, statuses, services, tiers, minScore, hotOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageStart = (page - 1) * PER_PAGE;
  const paginated = filtered.slice(pageStart, pageStart + PER_PAGE);
  const visibleIds = useMemo(() => paginated.map((opp) => opp.id), [paginated]);
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  const toggleOpportunity = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleFiltered = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const exportSelected = () => {
    if (selectedOpportunities.length === 0 || typeof window === "undefined")
      return;

    const headers = [
      "rank",
      "name",
      "status",
      "status_tier",
      "score",
      "city",
      "state",
      "primary_company",
      "revenue_opportunity",
      "project_value",
      "services",
      "last_updated",
      "source_url",
    ];
    const rows = selectedOpportunities.map((opp) => [
      opp.rank,
      opp.name,
      opp.status,
      formatStatusTier(opp.statusTier),
      opp.score,
      opp.city,
      opp.state,
      opp.companies[0]?.name ?? "",
      opp.revenueOpportunity,
      opp.projectValue,
      opp.services.join("; "),
      opp.lastUpdated,
      opp.sourceUrl,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dealcenter-opportunities-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <OpportunitiesLoadingState />;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Opportunities
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {opportunities.length} tracked projects · ranked by what needs
              attention today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportSelected}
              disabled={selectedOpportunities.length === 0}
              className="h-8 px-3 rounded-md bg-charcoal text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-charcoal/85 transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              <Download className="size-3.5" />
              Export CSV
              {selectedOpportunities.length > 0 && (
                <span className="num">({selectedOpportunities.length})</span>
              )}
            </button>
            <RunPipelineButton />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            tone="critical"
            icon={<Sparkles className="size-4" />}
            label="Hot tier"
            value={kpis.hot}
            hint="From source data"
          />
          <KpiCard
            tone="info"
            icon={<CircleDot className="size-4" />}
            label="Warm tier"
            value={kpis.warm}
            hint="From source data"
          />
          <KpiCard
            tone="neutral"
            icon={<CircleDot className="size-4" />}
            label="Tracked opportunities"
            value={kpis.updated}
            hint="Latest run"
          />
        </div>

        {/* Filter bar (sticky) */}
        <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search project, city or GC…"
                className="h-9 w-full rounded-md bg-card border border-border pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50"
              />
            </div>
            <FilterPopover
              label="Status"
              items={allStatuses}
              selected={statuses}
              onChange={setStatuses}
            />
            <FilterPopover
              label="Services"
              items={allServices}
              selected={services}
              onChange={setServices}
            />
            <FilterPopover
              label="Tier"
              items={allStatusTiers}
              selected={tiers}
              onChange={setTiers}
              formatLabel={formatStatusTier}
            />
            <ScorePopover value={minScore} onChange={setMinScore} />
            <button
              onClick={() => setHotOnly((v) => !v)}
              className={cn(
                "h-9 px-3 rounded-md border text-[12.5px] inline-flex items-center gap-1.5 transition-colors",
                hotOnly
                  ? "border-destructive/40 bg-destructive/8 text-destructive"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  hotOnly ? "bg-destructive" : "bg-muted-foreground/40",
                )}
              />
              Hot tier only
            </button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11.5px] text-muted-foreground">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as OpportunitySortKey)}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="tier">Status tier</option>
                <option value="score">Match score</option>
                <option value="updated">Last updated</option>
              </select>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-secondary text-[11.5px] text-foreground hover:bg-secondary/70"
                >
                  {f.label}
                  <X className="size-3 opacity-60" />
                </button>
              ))}
              <button
                onClick={clearAll}
                className="text-[11.5px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results meta */}
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                disabled={filtered.length === 0}
                onCheckedChange={(checked) => toggleFiltered(checked === true)}
                aria-label="Select all visible opportunities"
              />
              Select visible
            </div>
            <div>
              <span className="num text-foreground font-medium">
                {selectedVisibleCount}
              </span>{" "}
              selected in view
              {selectedOpportunities.length > selectedVisibleCount && (
                <span> · {selectedOpportunities.length} total selected</span>
              )}
            </div>
          </div>
          <div>
            {filtered.length > 0 && (
              <>
                Showing{" "}
                <span className="num text-foreground font-medium">
                  {pageStart + 1}-
                  {Math.min(pageStart + PER_PAGE, filtered.length)}
                </span>{" "}
                of{" "}
              </>
            )}
            <span className="num text-foreground font-medium">
              {filtered.length}
            </span>
            {filtered.length !== opportunities.length && (
              <span> (filtered from {opportunities.length})</span>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-3">
          {paginated.map((o) => (
            <OpportunityCard
              key={o.id}
              o={o}
              selected={selectedIds.has(o.id)}
              onSelect={(checked) => toggleOpportunity(o.id, checked)}
              onOpen={() => setSelected(o)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-20 text-muted-foreground text-[13px] border border-dashed border-border rounded-lg">
              <Filter className="size-6 mx-auto mb-2 opacity-40" />
              No opportunities match these filters.
              <div className="mt-2">
                <button
                  onClick={clearAll}
                  className="text-primary hover:underline text-[12.5px]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="size-8 rounded-md border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "size-8 rounded-md border text-[12.5px] font-medium num",
                  p === page
                    ? "border-charcoal bg-charcoal text-white"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="size-8 rounded-md border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <OpportunityDrawer opp={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/* ---------------- KPI ---------------- */

function KpiCard({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: "critical" | "info" | "neutral" | "success";
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint: string;
}) {
  const tones = {
    critical: {
      icon: "bg-destructive/10 text-destructive",
      accent: "before:bg-destructive",
    },
    info: {
      icon: "bg-info/10 text-info",
      accent: "before:bg-info",
    },
    neutral: {
      icon: "bg-foreground/8 text-foreground",
      accent: "before:bg-foreground",
    },
    success: {
      icon: "bg-success/10 text-success",
      accent: "before:bg-success",
    },
  }[tone];

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card p-4 overflow-hidden",
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]",
        tones.accent,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "size-7 rounded-md inline-flex items-center justify-center",
            tones.icon,
          )}
        >
          {icon}
        </div>
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </span>
      </div>
      <div className="mt-3">
        <div
          className="font-semibold tabular-nums text-foreground tracking-tight text-[28px]"
        >
          {value}
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

/* ---------------- Card ---------------- */

function OpportunityCard({
  o,
  selected,
  onSelect,
  onOpen,
}: {
  o: Opportunity;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const isHot = o.statusTier === "hot";
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative rounded-xl border bg-card transition-all cursor-pointer",
        "hover:border-border-strong hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]",
        selected && "border-primary/40 bg-primary/[0.025]",
        !selected && isHot && "border-destructive/30",
        !selected && !isHot && "border-border",
      )}
    >
      {isHot && (
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-destructive" />
      )}

      <div className="p-5 flex flex-col lg:flex-row gap-5">
        {/* LEFT: priority + project */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <Checkbox
              checked={selected}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={(checked) => onSelect(checked === true)}
              aria-label={`Select ${o.name}`}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusTierBadge tier={o.statusTier} />
                <StatusChip status={o.status} />
                <span className="text-[11px] text-muted-foreground">
                  · updated {formatRelative(o.lastUpdated)}
                </span>
              </div>
            </div>
          </div>

          <h3 className="text-[15.5px] font-semibold text-foreground leading-snug truncate pl-7">
            {o.name}
          </h3>

          <div className="mt-2 pl-7 flex items-center flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {o.city}, {o.state}
            </span>
            {o.companies[0] && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                {o.companies[0].name}
              </span>
            )}
          </div>

          <div className="mt-3 pl-7 flex items-center gap-1.5">
            {o.services.map((s) => (
              <span
                key={s}
                className="inline-flex items-center h-5 px-2 rounded-md bg-secondary text-[10.5px] font-medium text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT: score + CTA */}
        <div className="lg:w-[200px] lg:border-l lg:border-border lg:pl-5 flex lg:flex-col items-center lg:items-start justify-between gap-3">
          <MatchScore score={o.score} />
          <div className="flex items-center gap-1 w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition-opacity"
            >
              View opportunity
              <ArrowUpRight className="size-3.5" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="size-9 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: OpportunityStatus }) {
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-md bg-secondary text-foreground/80 text-[10.5px] font-medium">
      {status}
    </span>
  );
}

function MatchScore({ score }: { score: number }) {
  const quality =
    score >= 85
      ? "Excellent fit"
      : score >= 70
        ? "Strong fit"
        : score >= 55
          ? "Fair fit"
          : "Low fit";
  const color =
    score >= 85
      ? "text-success"
      : score >= 70
        ? "text-info"
        : score >= 55
          ? "text-warning"
          : "text-muted-foreground";
  const ring =
    score >= 85
      ? "var(--success)"
      : score >= 70
        ? "var(--info)"
        : score >= 55
          ? "var(--warning)"
          : "var(--muted-foreground)";
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative size-12 rounded-full shrink-0"
        style={{
          background: `conic-gradient(${ring} ${pct * 3.6}deg, var(--secondary) 0)`,
        }}
      >
        <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
          <span className={cn("text-[13px] font-semibold tabular-nums", color)}>
            {score}
          </span>
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Match score
        </div>
        <div className={cn("text-[13px] font-medium", color)}>{quality}</div>
      </div>
    </div>
  );
}
