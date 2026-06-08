import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  CircleDot,
  Filter,
  MapPin,
  MoreHorizontal,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import {
  formatCurrency,
  formatRelative,
  formatStatusTier,
  type Opportunity,
  type OpportunityStatus,
  type Service,
  type StatusTier,
} from "@/lib/leads-data";
import { useLeads } from "@/lib/leads-context";
import { OpportunityDrawer } from "@/components/opportunity-drawer";
import { AlertBadge, StatusTierBadge } from "@/components/badges";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/opportunities")({
  component: OpportunitiesPage,
});

type SortKey = "tier" | "score" | "revenue" | "updated";

function OpportunitiesPage() {
  const { opportunities, allStatuses, allServices, allStatusTiers } = useLeads();
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<OpportunityStatus[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tiers, setTiers] = useState<StatusTier[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [hotOnly, setHotOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("tier");
  const [selected, setSelected] = useState<Opportunity | null>(null);

  const filtered = useMemo(() => {
    return opportunities
      .filter((o) => {
        if (q) {
          const t = q.toLowerCase();
          if (
            !o.name.toLowerCase().includes(t) &&
            !o.city.toLowerCase().includes(t) &&
            !o.companies.some((company) =>
              company.name.toLowerCase().includes(t),
            )
          )
            return false;
        }
        if (statuses.length && !statuses.includes(o.status)) return false;
        if (services.length && !services.every((s) => o.services.includes(s)))
          return false;
        if (tiers.length && !tiers.includes(o.statusTier)) return false;
        if (o.score < minScore) return false;
        if (hotOnly && o.statusTier !== "hot") return false;
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
  }, [q, statuses, services, tiers, minScore, hotOnly, sort]);

  const kpis = useMemo(() => {
    const hot = opportunities.filter((o) => o.statusTier === "hot").length;
    const warm = opportunities.filter((o) => o.statusTier === "warm").length;
    const updated = opportunities.length;
    const pipeline = opportunities.reduce(
      (s, o) => s + o.revenueOpportunity,
      0,
    );
    return { hot, warm, updated, pipeline };
  }, [opportunities]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...statuses.map((s) => ({
      key: `s-${s}`,
      label: `Status: ${s}`,
      clear: () => setStatuses(statuses.filter((x) => x !== s)),
    })),
    ...services.map((s) => ({
      key: `sv-${s}`,
      label: `Service: ${s}`,
      clear: () => setServices(services.filter((x) => x !== s)),
    })),
    ...tiers.map((p) => ({
      key: `p-${p}`,
      label: `Tier: ${formatStatusTier(p)}`,
      clear: () => setTiers(tiers.filter((x) => x !== p)),
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
            <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-[13px] hover:bg-secondary/60 transition-colors">
              <Bell className="size-3.5" /> Alerts
            </button>
            <button className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity">
              <Sparkles className="size-3.5" /> Run intelligence
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <KpiCard
            tone="success"
            icon={<TrendingUp className="size-4" />}
            label="Pipeline revenue"
            value={formatCurrency(kpis.pipeline)}
            hint="Across all tracked"
            big
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
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="tier">Status tier</option>
                <option value="score">Match score</option>
                <option value="revenue">Revenue opportunity</option>
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
          <div>
            Showing{" "}
            <span className="num text-foreground font-medium">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="num text-foreground font-medium">
              {opportunities.length}
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((o) => (
            <OpportunityCard key={o.id} o={o} onOpen={() => setSelected(o)} />
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
      </div>

      <OpportunityDrawer opp={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* ---------------- KPI ---------------- */

function KpiCard({
  tone,
  icon,
  label,
  value,
  hint,
  big,
}: {
  tone: "critical" | "info" | "neutral" | "success";
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint: string;
  big?: boolean;
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
          className={cn(
            "font-semibold tabular-nums text-foreground tracking-tight",
            big ? "text-[26px]" : "text-[28px]",
          )}
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
  onOpen,
}: {
  o: Opportunity;
  onOpen: () => void;
}) {
  const isHot = o.statusTier === "hot";
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative rounded-xl border bg-card transition-all cursor-pointer",
        "hover:border-border-strong hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]",
        isHot ? "border-destructive/30" : "border-border",
      )}
    >
      {isHot && (
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-destructive" />
      )}

      <div className="p-5 flex flex-col lg:flex-row gap-5">
        {/* LEFT: priority + project */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusTierBadge tier={o.statusTier} />
            <StatusChip status={o.status} />
            {o.alert && (
              <AlertBadge alert={o.alert} detail={o.alertDetail} />
            )}
            <span className="text-[11px] text-muted-foreground">
              · updated {formatRelative(o.lastUpdated)}
            </span>
          </div>

          <h3 className="text-[15.5px] font-semibold text-foreground leading-snug truncate">
            {o.name}
          </h3>

          <div className="mt-2 flex items-center flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
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

          <div className="mt-3 flex items-center gap-1.5">
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

        {/* MIDDLE: revenue */}
        <div className="lg:w-[180px] lg:border-l lg:border-border lg:pl-5 flex lg:flex-col gap-4 lg:gap-1 items-baseline lg:items-start">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Revenue opportunity
            </div>
            <div className="text-[22px] font-semibold tabular-nums text-foreground tracking-tight leading-none mt-1">
              {formatCurrency(o.revenueOpportunity)}
            </div>
            <div className="text-[11.5px] text-muted-foreground mt-1.5">
              Project value ·{" "}
              <span className="text-foreground/80 num">
                {formatCurrency(o.projectValue)}
              </span>
            </div>
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

/* ---------------- Filter primitives ---------------- */

function FilterPopover<T extends string>({
  label,
  items,
  selected,
  onChange,
  formatLabel = (value: T) => value,
}: {
  label: string;
  items: readonly T[];
  selected: T[];
  onChange: (v: T[]) => void;
  formatLabel?: (value: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (it: T) =>
    onChange(
      selected.includes(it)
        ? selected.filter((x) => x !== it)
        : [...selected, it],
    );
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 px-3 rounded-md border bg-card text-[12.5px] flex items-center gap-1.5 transition-colors",
          selected.length
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="num bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 z-30 bg-popover border border-border rounded-lg shadow-lg min-w-[220px] p-1.5">
            {items.map((it) => (
              <label
                key={it}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] hover:bg-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(it)}
                  onChange={() => toggle(it)}
                  className="accent-primary"
                />
                <span className="text-foreground">{formatLabel(it)}</span>
              </label>
            ))}
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-2 py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground border-t border-border mt-1"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScorePopover({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-9 px-3 rounded-md border bg-card text-[12.5px] flex items-center gap-1.5 transition-colors",
          value > 0
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        Min score
        {value > 0 && (
          <span className="num bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">
            {value}
          </span>
        )}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 z-30 bg-popover border border-border rounded-lg shadow-lg w-[260px] p-3">
            <div className="flex items-center justify-between text-[11.5px] mb-2">
              <span className="text-muted-foreground">Minimum match score</span>
              <span className="num font-semibold text-foreground">{value}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
