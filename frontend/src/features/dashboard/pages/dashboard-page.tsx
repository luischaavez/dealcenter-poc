import {
  Activity,
  ArrowDown,
  ArrowUp,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  dashboardMetrics,
  pipelineByScore,
  revenueByStage,
  statusDistribution,
} from "@/features/dashboard/model/dashboard.selectors";
import { changeTrend } from "@/features/change-monitor/model/change-monitor.selectors";
import {
  generatedAt,
  opportunities,
  runStats,
} from "@/features/opportunities/model/opportunity.selectors";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import {
  ScoreCell,
  StatusBadge,
  StatusTierBadge,
} from "@/features/opportunities/components/opportunity-badges";

export function DashboardPage() {
  const top = opportunities.slice(0, 5);
  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Pipeline overview · {runStats.days_back}d data window
          </p>
          <h2 className="text-[22px] font-semibold tracking-tight text-charcoal mt-1">
            Executive briefing
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[oklch(0.62_0.13_155)]" />
          Pipeline refreshed {formatDateTime(generatedAt)}
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-px bg-border border border-border rounded-md overflow-hidden">
        <MetricCell
          label="Ingested"
          value={dashboardMetrics.ingested.toLocaleString()}
          sub={`${runStats.days_back}d window`}
        />
        <MetricCell
          label="Filtered"
          value={dashboardMetrics.filtered.toLocaleString()}
          sub={`${Math.round(dashboardMetrics.passThroughRate * 100)}% pass-through`}
        />
        <MetricCell
          label="Qualified"
          value={dashboardMetrics.qualified.toString()}
          sub={`${dashboardMetrics.surfaced} surfaced`}
          trend="up"
        />
        <MetricCell
          label="Hot opps"
          value={dashboardMetrics.hot.toString()}
          sub="Status tier"
          accent="text-[oklch(0.5_0.21_28)]"
          icon={Flame}
        />
        <MetricCell
          label="Warm opps"
          value={dashboardMetrics.warm.toString()}
          sub="Status tier"
        />
        <MetricCell
          label="Revenue potential"
          value={formatCurrency(dashboardMetrics.revenuePotential)}
          sub="Avg. range"
          accent="text-[oklch(0.42_0.14_240)]"
          icon={TrendingUp}
        />
        <MetricCell
          label="Recent updates"
          value={dashboardMetrics.recentChanges.toString()}
          sub="With last updated"
          icon={Activity}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Pipeline by status"
          subtitle="Active projects across stages"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={statusDistribution}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.9 0.005 70)"
                vertical={false}
              />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11, fill: "oklch(0.5 0.008 60)" }}
                tickLine={false}
                axisLine={{ stroke: "oklch(0.9 0.005 70)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.5 0.008 60)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "oklch(0.95 0.005 80)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid oklch(0.82 0.006 70)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {statusDistribution.map((d, i) => {
                  const colors = [
                    "#339CEC",
                    "#232323",
                    "#de422f",
                    "#8a8a8a",
                    "#bbb",
                  ];
                  return (
                    <Cell key={d.status} fill={colors[i % colors.length]} />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Score distribution" subtitle="Match score bands">
          <div className="space-y-3 pt-2">
            {pipelineByScore.map((b, i) => {
              const max = Math.max(...pipelineByScore.map((x) => x.count));
              const w = (b.count / max) * 100;
              const color =
                i === 0 ? "#de422f" : i === 1 ? "#339CEC" : "#232323";
              return (
                <div key={b.bucket}>
                  <div className="flex items-baseline justify-between text-[11.5px] mb-1">
                    <span className="font-mono text-muted-foreground">
                      {b.bucket}
                    </span>
                    <span className="num font-medium text-charcoal">
                      {b.count}
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${w}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Revenue potential by stage" subtitle="In thousands USD">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={revenueByStage}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.9 0.005 70)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "oklch(0.5 0.008 60)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fontSize: 11, fill: "oklch(0.35 0.005 50)" }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip
                cursor={{ fill: "oklch(0.95 0.005 80)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid oklch(0.82 0.006 70)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`$${v}K`, "Revenue"]}
              />
              <Bar
                dataKey="revenue"
                fill="#339CEC"
                radius={[0, 2, 2, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Update activity"
          subtitle="Project last-updated timestamps"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={changeTrend}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.9 0.005 70)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "oklch(0.5 0.008 60)" }}
                tickLine={false}
                axisLine={{ stroke: "oklch(0.9 0.005 70)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.5 0.008 60)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid oklch(0.82 0.006 70)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="changes"
                stroke="#339CEC"
                strokeWidth={2}
                dot={{ r: 3, fill: "#339CEC" }}
              />
              <Line
                type="monotone"
                dataKey="hot"
                stroke="#de422f"
                strokeWidth={2}
                dot={{ r: 3, fill: "#de422f" }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[11.5px]">
            <Legend color="#339CEC" label="All updates" />
            <Legend color="#de422f" label="Hot tier" />
          </div>
        </Panel>
      </div>

      <Panel title="Top opportunities right now" subtitle="Sorted by rank">
        <table className="w-full text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left font-medium py-2 pl-1">#</th>
              <th className="text-left font-medium py-2">Project</th>
              <th className="text-left font-medium py-2">Status</th>
              <th className="text-left font-medium py-2">Score</th>
              <th className="text-right font-medium py-2 pr-1">Revenue opp.</th>
              <th className="text-left font-medium py-2 pl-3">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {top.map((o) => (
              <tr key={o.id} className="hover:bg-secondary/40">
                <td className="py-2.5 pl-1 num text-muted-foreground">
                  {o.rank}
                </td>
                <td className="py-2.5 font-medium text-charcoal">{o.name}</td>
                <td className="py-2.5">
                  <StatusBadge status={o.status} />
                </td>
                <td className="py-2.5 w-[160px]">
                  <ScoreCell score={o.score} />
                </td>
                <td className="py-2.5 text-right num font-medium text-charcoal pr-1">
                  {formatCurrency(o.revenueOpportunity)}
                </td>
                <td className="py-2.5 pl-3">
                  <StatusTierBadge tier={o.statusTier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-card border border-border rounded-md p-4 ${className}`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-charcoal">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCell({
  label,
  value,
  sub,
  accent,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  trend?: "up" | "down";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="bg-card p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        {Icon && (
          <Icon
            className="size-3.5 text-muted-foreground/60"
            strokeWidth={1.75}
          />
        )}
      </div>
      <div
        className={`text-[20px] font-semibold tracking-tight num mt-1 ${accent ?? "text-charcoal"}`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
          {trend === "up" && (
            <ArrowUp className="size-3 text-[oklch(0.5_0.13_155)]" />
          )}
          {trend === "down" && (
            <ArrowDown className="size-3 text-[oklch(0.5_0.21_28)]" />
          )}
          {sub}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-sm" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
