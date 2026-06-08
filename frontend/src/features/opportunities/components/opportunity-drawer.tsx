import { useEffect } from "react";
import {
  X,
  ExternalLink,
  AlertTriangle,
  Check,
  Sparkles,
  UserPlus,
  ListPlus,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import type { Opportunity } from "@/features/opportunities/model/opportunity.types";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime, formatRelative } from "@/utils/date";
import { StatusBadge, StatusTierBadge } from "./opportunity-badges";
import { cn } from "@/utils/cn";

export function OpportunityDrawer({
  opp,
  onClose,
}: {
  opp: Opportunity | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-charcoal/30 backdrop-blur-[1px] z-40 transition-opacity",
          opp ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 h-screen w-[720px] max-w-[94vw] bg-background border-l border-border z-50 shadow-2xl shadow-charcoal/10 transition-transform overflow-y-auto",
          opp ? "translate-x-0" : "translate-x-full",
        )}
      >
        {opp && <DrawerBody opp={opp} onClose={onClose} />}
      </aside>
    </>
  );
}

function DrawerBody({
  opp,
  onClose,
}: {
  opp: Opportunity;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* ===== SECTION 1: HEADER ===== */}
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-7 pt-5 pb-4 z-10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">
              {opp.id}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusTierBadge tier={opp.statusTier} />
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight text-charcoal leading-snug">
          {opp.name}
        </h2>
        <div className="flex items-center gap-2.5 mt-2 text-[12px] text-muted-foreground">
          <StatusBadge status={opp.status} />
          <span>·</span>
          <span>
            {opp.city}, {opp.state}
          </span>
          {opp.companies[0] && (
            <>
              <span>·</span>
              <span className="text-charcoal/80">{opp.companies[0].name}</span>
            </>
          )}
        </div>

        {/* ===== SECTION 2: PRIMARY ACTIONS ===== */}
        <div className="flex items-center gap-2 mt-4">
          <button className="h-9 px-3.5 rounded-md bg-charcoal text-white text-[12.5px] font-medium hover:bg-black/85 inline-flex items-center gap-1.5">
            <UserPlus className="size-3.5" />
            Assign to me
          </button>
          <button className="h-9 px-3.5 rounded-md border border-border bg-background text-[12.5px] font-medium hover:bg-secondary inline-flex items-center gap-1.5">
            <ListPlus className="size-3.5" />
            Add to pursuit list
          </button>
          <a
            href={opp.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3.5 rounded-md border border-border bg-background text-[12.5px] font-medium hover:bg-secondary inline-flex items-center gap-1.5 ml-auto"
          >
            Open project
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </header>

      <div className="px-7 py-6 space-y-7">
        {/* ===== SECTION 3: OPPORTUNITY VALUE ===== */}
        <section>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-7 rounded-xl border border-border bg-gradient-to-br from-[oklch(0.68_0.14_240/0.06)] to-transparent p-5">
              <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                Revenue opportunity
              </div>
              <div className="text-[40px] font-semibold num text-charcoal leading-none mt-2 tracking-tight">
                {formatCurrency(opp.revenueOpportunity)}
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-2">
                Across {opp.services.length} service line
                {opp.services.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="col-span-5 grid grid-rows-3 gap-2">
              <MiniMetric
                label="Project value"
                value={formatCurrency(opp.projectValue)}
              />
              <MiniMetric label="Duration" value={`${opp.durationMonths} mo`} />
              <MiniMetric
                label="Revenue range"
                value={`${formatCurrency(opp.revenueLow)}-${formatCurrency(opp.revenueHigh)}`}
                accent="text-[oklch(0.45_0.13_155)]"
              />
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: NEXT BEST ACTION ===== */}
        <section className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-primary" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="size-6 rounded-md bg-primary/15 flex items-center justify-center">
              <Sparkles className="size-3.5 text-primary" />
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-primary">
              Next best action
            </div>
          </div>
          <p className="text-[15px] text-charcoal font-medium leading-snug">
            {opp.recommendedAction}
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed">
            <span className="font-medium text-charcoal/80">Reason: </span>
            {opp.executiveSummary}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12.5px] font-medium hover:bg-primary/90 inline-flex items-center gap-1.5">
              Start pursuit
              <ArrowUpRight className="size-3.5" />
            </button>
            <button className="h-9 px-3 rounded-md text-[12.5px] font-medium text-muted-foreground hover:bg-secondary">
              Snooze 24h
            </button>
          </div>
        </section>

        {/* ===== SECTION 5: WHY THIS MATTERS ===== */}
        <Section title="Why this matters" icon={<Check className="size-3" />}>
          <ul className="space-y-2">
            {opp.whyActionable.map((w) => (
              <li
                key={w}
                className="flex gap-2.5 text-[13px] text-charcoal/90 leading-snug"
              >
                <span className="mt-[3px] size-4 rounded-full bg-[oklch(0.62_0.13_155/0.15)] flex items-center justify-center shrink-0">
                  <Check
                    className="size-2.5 text-[oklch(0.42_0.13_155)]"
                    strokeWidth={3}
                  />
                </span>
                <span>{w}</span>
              </li>
            ))}
            {opp.blockers.slice(0, 1).map((b) => (
              <li
                key={b}
                className="flex gap-2.5 text-[13px] text-charcoal/90 leading-snug"
              >
                <span className="mt-[3px] size-4 rounded-full bg-[#de422f]/12 flex items-center justify-center shrink-0">
                  <AlertTriangle
                    className="size-2.5 text-[#de422f]"
                    strokeWidth={2.5}
                  />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ===== SECTION 6: RECENT ACTIVITY ===== */}
        <Section title="Recent activity" icon={<Activity className="size-3" />}>
          <div className="rounded-lg border border-border bg-card p-4 text-[12.5px] text-charcoal/90">
            <div className="font-medium">Project updated</div>
            <div className="text-muted-foreground mt-0.5">
              {formatDateTime(opp.lastUpdated)} · {opp.status} /{" "}
              {opp.statusTier} tier
            </div>
          </div>
        </Section>

        {/* ===== SECTION 7: WHY THIS SCORED HIGH ===== */}
        <Section title="Why this scored high">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-4 mb-4">
              <ScoreRing score={opp.score} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-charcoal">
                  Match Score {opp.score}/100
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  {opp.score >= 85
                    ? "Excellent fit — top-tier opportunity"
                    : opp.score >= 70
                      ? "Strong fit — qualified to pursue"
                      : "Moderate fit — monitor before acting"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {opp.scoreBreakdown.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[11.5px] mb-0.5">
                    <span className="text-charcoal/80">{s.label}</span>
                    <span className="num font-medium text-charcoal">
                      {s.value}/{s.max}
                    </span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-charcoal rounded-full"
                      style={{ width: `${(s.value / s.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ===== SECTION 8: RISKS & BLOCKERS ===== */}
        {opp.blockers.length > 0 && (
          <Section title="Risks & blockers">
            <div className="rounded-lg border border-[#de422f]/25 bg-[#de422f]/[0.04] p-4">
              <ul className="space-y-2">
                {opp.blockers.map((b) => (
                  <li
                    key={b}
                    className="flex gap-2.5 text-[12.5px] text-charcoal/90 leading-snug"
                  >
                    <AlertTriangle className="size-3.5 mt-0.5 text-[#de422f] shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* ===== SECTION 9: SERVICES NEEDED ===== */}
        <Section title="Services needed">
          <div className="flex flex-wrap gap-1.5">
            {opp.services.map((s) => (
              <span
                key={s}
                className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-md bg-secondary border border-border text-charcoal/80"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>

        {/* Companies + Source — utility footer info */}
        <Section title="Companies">
          <div className="divide-y divide-border border border-border rounded-lg">
            {opp.companies.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-charcoal truncate">
                    {c.name}
                  </div>
                  {c.city && (
                    <div className="text-[11px] text-muted-foreground">
                      {c.city}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
          <a
            href={opp.sourceUrl}
            className="inline-flex items-center gap-1.5 hover:text-primary"
          >
            Source: {opp.source}
            <ExternalLink className="size-3" />
          </a>
          <span>Updated {formatRelative(opp.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2.5 flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[15px] font-semibold num",
          accent ?? "text-charcoal",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color =
    score >= 85
      ? "oklch(0.55 0.15 155)"
      : score >= 70
        ? "oklch(0.55 0.15 240)"
        : "oklch(0.6 0.05 80)";
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="oklch(0.92 0.005 80)"
          strokeWidth="4"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold num text-charcoal">
        {score}
      </div>
    </div>
  );
}
