import { useState, useRef, useCallback } from "react";
import {
  Info,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCustomerImports,
  fetchDodgeUploads,
  uploadCustomerImportFile,
  uploadDodgeFile,
  type CustomerImport,
} from "@/lib/api";
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
          {tab === "imports" && <ImportsPanel />}
          {tab === "customer-imports" && <CustomerImportsPanel />}
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

function ImportsPanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: uploads, isLoading } = useQuery({
    queryKey: ["dodge-uploads"],
    queryFn: fetchDodgeUploads,
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
        toast.error("Only .xlsx and .csv files are accepted");
        return;
      }
      setUploading(true);
      try {
        await uploadDodgeFile(file);
        await queryClient.invalidateQueries({ queryKey: ["dodge-uploads"] });
        toast.success(`${file.name} uploaded — pipeline will use it today`);
      } catch (e) {
        toast.error(`Upload failed: ${e}`);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [queryClient],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <>
      <Card
        title="Upload Dodge export"
        subtitle="The pipeline automatically uses the file uploaded on the day it runs"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 transition-colors cursor-pointer select-none",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-background hover:border-muted-foreground/40 hover:bg-secondary/30",
            uploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploading ? (
            <Loader2 className="size-7 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="size-7 text-muted-foreground" />
          )}
          <p className="text-[13px] font-medium text-charcoal">
            {uploading ? "Uploading…" : "Drop your .xlsx file here"}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {uploading ? "Please wait" : ".xlsx or .csv · click to browse"}
          </p>
        </div>
      </Card>

      <Card title="Upload history" subtitle="Files available in object storage">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </div>
        ) : !uploads?.length ? (
          <EmptyState message="No Dodge files uploaded yet." />
        ) : (
          <div className="divide-y divide-border">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-3">
                <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-charcoal truncate">
                    {u.filename}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    For {u.file_date}
                    {u.uploaded_at
                      ? ` · uploaded ${formatDateTime(u.uploaded_at)}`
                      : ""}
                  </p>
                </div>
                <CheckCircle2 className="size-4 text-[oklch(0.5_0.13_155)] shrink-0" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

const customerPreviewColumns: Array<{
  key: keyof CustomerImport["preview_rows"][number];
  label: string;
  className?: string;
}> = [
  { key: "email", label: "Email Address", className: "min-w-[210px]" },
  { key: "first_name", label: "First Name", className: "min-w-[130px]" },
  { key: "last_name", label: "Last Name", className: "min-w-[130px]" },
  { key: "company", label: "Company", className: "min-w-[220px]" },
  { key: "phone", label: "Phone Number", className: "min-w-[150px]" },
  { key: "address", label: "Address", className: "min-w-[260px]" },
  { key: "address_2", label: "Address 2", className: "min-w-[150px]" },
  { key: "city", label: "City", className: "min-w-[130px]" },
  { key: "state_province", label: "State/Province", className: "min-w-[150px]" },
  { key: "postal_code", label: "Postal Code", className: "min-w-[130px]" },
  { key: "country", label: "Country", className: "min-w-[120px]" },
  { key: "tags", label: "Tags", className: "min-w-[180px]" },
];

function CustomerImportsPanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data: imports, isLoading } = useQuery({
    queryKey: ["customer-imports"],
    queryFn: fetchCustomerImports,
  });

  const latestImport = imports?.[0];

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Only .csv files are accepted");
        return;
      }
      setProcessing(true);
      try {
        const result = await uploadCustomerImportFile(file);
        await queryClient.invalidateQueries({ queryKey: ["customer-imports"] });
        toast.success(
          `${file.name} imported: ${result.created_rows} created, ${result.updated_rows} updated`,
        );
      } catch (e) {
        toast.error(`Import failed: ${e}`);
      } finally {
        setProcessing(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [queryClient],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <>
      <Card
        title="Upload customer list"
        subtitle="Import TrashLab customer contacts used by opportunity matching"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !processing && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 transition-colors cursor-pointer select-none",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-background hover:border-muted-foreground/40 hover:bg-secondary/30",
            processing && "pointer-events-none opacity-70",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {processing ? (
            <Loader2 className="size-7 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="size-7 text-muted-foreground" />
          )}
          <p className="text-[13px] font-medium text-charcoal">
            {processing ? "Processing customer import…" : "Drop a customer .csv file here"}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {processing
              ? "Parsing rows and updating customer contacts"
              : "TrashLab CSV export · click to browse"}
          </p>
        </div>
      </Card>

      <CustomerImportSummary latestImport={latestImport} isLoading={isLoading} />

      <Card
        title="Preview"
        subtitle={
          latestImport
            ? `Latest rows from ${latestImport.filename}`
            : "Rows from the latest customer import"
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading customer imports…
          </div>
        ) : !latestImport ? (
          <EmptyState message="No customer imports uploaded yet." />
        ) : !latestImport.preview_rows.length ? (
          <EmptyState message="The latest import did not contain previewable rows." />
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1900px] w-full text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  {customerPreviewColumns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "text-left font-medium py-2 px-3 first:pl-0",
                        column.className,
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="text-right font-medium py-2 pl-3 min-w-[110px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latestImport.preview_rows.map((row, index) => (
                  <tr key={`${row.email}-${index}`} className="hover:bg-secondary/40">
                    {customerPreviewColumns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "py-2.5 px-3 first:pl-0 align-top text-foreground/85",
                          column.key === "company" && "font-medium text-charcoal",
                        )}
                      >
                        <span className="line-clamp-2 break-words">
                          {row[column.key] || "-"}
                        </span>
                      </td>
                    ))}
                    <td className="py-2.5 pl-3 text-right">
                      <ImportStateBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Import history" subtitle="Customer files imported into DealCenter">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading history…
          </div>
        ) : !imports?.length ? (
          <EmptyState message="No customer import history yet." />
        ) : (
          <div className="divide-y divide-border">
            {imports.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-charcoal truncate">
                    {item.filename}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {item.total_rows} rows · {item.created_rows} created ·{" "}
                    {item.updated_rows} updated · {item.skipped_rows} skipped
                    {item.uploaded_at
                      ? ` · imported ${formatDateTime(item.uploaded_at)}`
                      : ""}
                  </p>
                </div>
                <CheckCircle2 className="size-4 text-[oklch(0.5_0.13_155)] shrink-0" />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function CustomerImportSummary({
  latestImport,
  isLoading,
}: {
  latestImport?: CustomerImport;
  isLoading: boolean;
}) {
  return (
    <Card title="Latest import" subtitle="Customer contact records created or updated">
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["Rows", "Created", "Updated", "Needs review"].map((label) => (
            <div key={label} className="rounded-md border border-border bg-background p-3">
              <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
              <div className="mt-3 h-5 w-10 rounded bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
      ) : !latestImport ? (
        <EmptyState message="Import a customer CSV to populate customer contacts." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SummaryStat label="Rows" value={latestImport.total_rows} />
          <SummaryStat label="Created" value={latestImport.created_rows} />
          <SummaryStat label="Updated" value={latestImport.updated_rows} />
          <SummaryStat label="Needs review" value={latestImport.review_rows} />
        </div>
      )}
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold text-charcoal num">{value}</p>
    </div>
  );
}

function ImportStateBadge({ status }: { status: string }) {
  const styles =
    status === "Created"
      ? "bg-[oklch(0.62_0.13_155/0.12)] text-[oklch(0.4_0.13_155)] border-[oklch(0.62_0.13_155/0.3)]"
      : status === "Updated"
        ? "bg-primary/10 text-primary border-primary/25"
        : status === "Review"
        ? "bg-[oklch(0.72_0.15_70/0.13)] text-[oklch(0.42_0.15_70)] border-[oklch(0.72_0.15_70/0.3)]"
        : "bg-[oklch(0.605_0.21_28/0.10)] text-[oklch(0.5_0.21_28)] border-[oklch(0.605_0.21_28/0.3)]";

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
