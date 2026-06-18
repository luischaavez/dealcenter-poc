import { useEffect } from "react";
import {
  X,
  ExternalLink,
  AlertTriangle,
  Check,
  Activity,
} from "lucide-react";
import type { Opportunity } from "@/features/opportunities/model/opportunity.types";
import { formatDateTime, formatRelative } from "@/utils/date";
import { AlertBadge, StatusBadge, StatusTierBadge } from "./opportunity-badges";
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
          "fixed inset-0 bg-black/45 backdrop-blur-[1px] z-40 transition-opacity",
          opp ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 h-screen w-[620px] max-w-[94vw] bg-background border-l border-border z-50 shadow-2xl shadow-charcoal/10 transition-transform overflow-y-auto",
          opp ? "translate-x-0" : "translate-x-full",
        )}
      >
        {opp && <DrawerBody opp={opp} onClose={onClose} />}
      </aside>
    </>
  );
}

function DrawerBody({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  return (
    <div className="flex flex-col">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-6 pt-5 pb-4 z-10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">
              {opp.id}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusTierBadge tier={opp.statusTier} />
            {opp.alert && <AlertBadge alert={opp.alert} detail={opp.alertDetail} />}
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="text-[19px] font-semibold tracking-tight text-charcoal leading-snug">
          {opp.name}
        </h2>

        <div className="flex items-center gap-2.5 mt-2 text-[12px] text-muted-foreground flex-wrap">
          <StatusBadge status={opp.status} />
          <span>·</span>
          <span>{opp.city}, {opp.state}</span>
          {opp.companies[0] && (
            <>
              <span>·</span>
              <span className="text-charcoal/80">{opp.companies[0].name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          {/* <button className="h-9 px-3.5 rounded-md bg-charcoal text-white text-[12.5px] font-medium hover:bg-black/85 inline-flex items-center gap-1.5">
            <UserPlus className="size-3.5" />
            Assign to me
          </button>
          <button className="h-9 px-3.5 rounded-md border border-border bg-background text-[12.5px] font-medium hover:bg-secondary inline-flex items-center gap-1.5">
            <ListPlus className="size-3.5" />
            Add to pursuit list
          </button> */}
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

      <div className="px-6 py-6 space-y-6">

        {/* ── SECTION 1: AI VERDICT ───────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <ScoreRing score={opp.score} />
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] uppercase tracking-[0.1em] font-semibold text-muted-foreground mb-1">
                AI Qualification
              </div>
              <div className="text-[14px] font-semibold text-charcoal leading-snug">
                {opp.score >= 85
                  ? "Excellent fit — pursue immediately"
                  : opp.score >= 70
                    ? "Strong fit — qualified to pursue"
                    : "Moderate fit — monitor before acting"}
              </div>
              {opp.executiveSummary && (
                <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed">
                  {opp.executiveSummary}
                </p>
              )}
              {opp.recommendedAction && (
                <p className="text-[12.5px] text-charcoal/80 mt-2 font-medium">
                  → {opp.recommendedAction}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 2: QUALIFICATION FACTORS ───────────────────────── */}
        {(opp.whyActionable.length > 0 || opp.blockers.length > 0) && (
          <Section title="Why this qualifies" icon={<Check className="size-3" />}>
            <ul className="space-y-2">
              {opp.whyActionable.map((w) => (
                <li key={w} className="flex gap-2.5 text-[13px] text-charcoal/90 leading-snug">
                  <span className="mt-[3px] size-4 rounded-full bg-[oklch(0.62_0.13_155/0.15)] flex items-center justify-center shrink-0">
                    <Check className="size-2.5 text-[oklch(0.42_0.13_155)]" strokeWidth={3} />
                  </span>
                  <span>{w}</span>
                </li>
              ))}
              {opp.blockers.map((b) => (
                <li key={b} className="flex gap-2.5 text-[13px] text-charcoal/90 leading-snug">
                  <span className="mt-[3px] size-4 rounded-full bg-[#de422f]/12 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-2.5 text-[#de422f]" strokeWidth={2.5} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── SECTION 3: SCORE BREAKDOWN ──────────────────────────────── */}
        {opp.scoreBreakdown.length > 0 && (
          <Section title="Score breakdown">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              {opp.scoreBreakdown.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span className="text-charcoal/80">{s.label}</span>
                    <span className="num font-medium text-charcoal">{s.value}/{s.max}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-charcoal rounded-full"
                      style={{ width: `${(s.value / s.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── SECTION 4: RECENT ACTIVITY ──────────────────────────────── */}
        <Section title="Recent activity" icon={<Activity className="size-3" />}>
          <div className="rounded-lg border border-border bg-card p-4 text-[12.5px] text-charcoal/90 space-y-2">
            {opp.alert && (
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <AlertBadge alert={opp.alert} detail={opp.alertDetail} />
                <span className="text-muted-foreground text-[11.5px]">Detected this run</span>
              </div>
            )}
            <div className="font-medium">
              {opp.alert === "new"
                ? "First seen in DealCenter"
                : opp.alert === "status_changed"
                  ? `Status changed: ${opp.alertDetail ?? ""}`
                  : opp.alert === "updated"
                    ? "Key details updated"
                    : "Project active — no changes detected"}
            </div>
            <div className="text-muted-foreground">
              {formatDateTime(opp.lastUpdated)} · {opp.status} / {opp.statusTier} tier
            </div>
          </div>
        </Section>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
          <a
            href={opp.sourceUrl}
            target="_blank"
            rel="noreferrer"
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
        <circle cx="28" cy="28" r={r} fill="none" stroke="oklch(0.92 0.005 80)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold num text-charcoal">
        {score}
      </div>
    </div>
  );
}
