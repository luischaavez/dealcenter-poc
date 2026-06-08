import { useState } from "react";
import { Info } from "lucide-react";
import {
  allServices,
  allStatusTiers,
  formatStatusTier,
  generatedAt,
  opportunities,
  runStats,
} from "@/features/opportunities/model/opportunity.selectors";
import {
  settingsTabs,
  type SettingsTab,
} from "@/features/settings/settings.constants";
import { formatDateTime } from "@/utils/date";
import { cn } from "@/utils/cn";

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("sources");

  return (
    <div className="px-6 py-6 max-w-[1100px] mx-auto">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Configuration
        </p>
        <h2 className="text-[22px] font-semibold tracking-tight text-charcoal mt-1">
          Settings
        </h2>
      </div>

      <div className="flex gap-6">
        <nav className="w-52 shrink-0 space-y-0.5">
          {settingsTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors",
                tab === t.id
                  ? "bg-secondary text-charcoal font-medium border-l-2 border-primary pl-[10px] -ml-[2px]"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-charcoal",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-5">
          {tab === "sources" && <SourcesPanel />}
          {tab === "scoring" && <ScoringPanel />}
          {tab === "notifications" && <NotificationsPanel />}
          {tab === "users" && <UsersPanel />}
          {tab === "integrations" && <IntegrationsPanel />}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-md p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-charcoal">{title}</h3>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0 gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-charcoal">{label}</div>
        {hint && (
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SourcesPanel() {
  const sources = Array.from(new Set(opportunities.map((opp) => opp.source)));

  return (
    <>
      <Card
        title="Connected sources"
        subtitle="Ingestion of construction project data"
      >
        {sources.map((source) => (
          <Row
            key={source}
            label={source}
            hint={`Latest file generated ${formatDateTime(generatedAt)}`}
          >
            <SourceState />
          </Row>
        ))}
      </Card>

      <Card
        title="Search window"
        subtitle="Look-back range for new and updated projects"
      >
        <Row
          label="Window (days)"
          hint="Projects updated within this range are considered active"
        >
          <ReadOnlyValue value={runStats.days_back.toString()} />
        </Row>
      </Card>

      <Card
        title="Monitored states / markets"
        subtitle="Geographies included in ingestion"
      >
        <div className="flex flex-wrap gap-1.5">
          {runStats.states.map((state) => (
            <span
              key={state}
              className="h-8 px-3 rounded-md text-[12px] font-medium border bg-charcoal text-white border-charcoal inline-flex items-center"
            >
              {state}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

function SourceState() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-[oklch(0.5_0.13_155)]">
      <span className="size-1.5 rounded-full bg-[oklch(0.5_0.13_155)]" />
      Available
    </span>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <span className="min-w-16 h-9 rounded-md border border-input bg-background px-3 text-[13px] num text-charcoal inline-flex items-center justify-end">
      {value}
    </span>
  );
}

function ScoringPanel() {
  return (
    <>
      <Card
        title="Status tiers"
        subtitle="Tiers present in the latest data file"
      >
        {allStatusTiers.map((tier) => (
          <Row
            key={tier}
            label={formatStatusTier(tier)}
            hint="Provided by project.status_tier"
          >
            <ReadOnlyValue
              value={opportunities
                .filter((opp) => opp.statusTier === tier)
                .length.toString()}
            />
          </Row>
        ))}
      </Card>

      <Card
        title="Enabled services"
        subtitle="Service lines factored into revenue opportunity model"
      >
        {allServices.map((s) => (
          <Row key={s} label={s}>
            <SourceState />
          </Row>
        ))}
      </Card>
    </>
  );
}

function NotificationsPanel() {
  return (
    <Card
      title="Change notifications"
      subtitle="How the team is alerted to pipeline movements"
    >
      <EmptyState message="Notification configuration is not included in ui/data." />
    </Card>
  );
}

function UsersPanel() {
  return (
    <Card title="Users & roles" subtitle="Manage workspace access">
      <EmptyState message="User and role records are not included in ui/data." />
    </Card>
  );
}

function IntegrationsPanel() {
  return (
    <Card
      title="Integrations"
      subtitle="Connect DealCenter to operational tools"
    >
      <EmptyState message="Integration records are not included in ui/data." />
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-[12.5px] text-muted-foreground flex items-center gap-2">
      <Info className="size-4" />
      {message}
    </div>
  );
}
