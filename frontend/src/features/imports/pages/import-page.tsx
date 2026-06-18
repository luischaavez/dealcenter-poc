import { useMemo, useState } from "react";
import { ClipboardCheck, FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/utils/cn";

type ImportKind = "opportunities" | "clients";
type ImportStatus = "ready" | "warning" | "duplicate";

interface PreviewRow {
  id: string;
  status: ImportStatus;
  cells: string[];
}

const importConfigs = {
  opportunities: {
    eyebrow: "Import workflow",
    title: "Import opportunities",
    description:
      "Upload a .csv or .xlsx file with opportunity records. This mock-up previews validation and import readiness without changing pipeline data.",
    mockFile: "q3-opportunity-intake.xlsx",
    accepted: ".csv, .xlsx",
    metrics: [
      { label: "Total rows", value: "128", hint: "Detected" },
      { label: "Valid rows", value: "119", hint: "Ready", tone: "success" },
      { label: "Warnings", value: "7", hint: "Review", tone: "warning" },
      { label: "Duplicates", value: "2", hint: "Matched", tone: "critical" },
    ],
    columns: [
      "Project",
      "Status",
      "Tier",
      "City",
      "Revenue opp.",
      "Services",
      "Import state",
    ],
    rows: [
      {
        id: "opp-import-1",
        status: "ready",
        cells: [
          "Northgate Distribution Center",
          "Bidding",
          "Hot",
          "Austin, TX",
          "$184K",
          "Dumpster, Portable Toilet",
        ],
      },
      {
        id: "opp-import-2",
        status: "warning",
        cells: [
          "Cedar Park Medical Plaza",
          "Planning",
          "Warm",
          "Cedar Park, TX",
          "$96K",
          "Concrete Washout",
        ],
      },
      {
        id: "opp-import-3",
        status: "duplicate",
        cells: [
          "Loop 1604 Retail Shell",
          "Awarded",
          "Warm",
          "San Antonio, TX",
          "$72K",
          "Dumpster",
        ],
      },
      {
        id: "opp-import-4",
        status: "ready",
        cells: [
          "Trinity Logistics Yard",
          "Construction",
          "Hot",
          "Fort Worth, TX",
          "$211K",
          "Dumpster, Concrete Washout",
        ],
      },
    ],
  },
  clients: {
    eyebrow: "Import workflow",
    title: "Import clients",
    description:
      "Upload a .csv or .xlsx file with client and company records used by opportunity matching. This mock-up does not create clients.",
    mockFile: "regional-client-roster.csv",
    accepted: ".csv, .xlsx",
    metrics: [
      { label: "Total clients", value: "84", hint: "Detected" },
      {
        label: "Matched companies",
        value: "61",
        hint: "Linked",
        tone: "success",
      },
      {
        label: "Missing contacts",
        value: "9",
        hint: "Review",
        tone: "warning",
      },
      { label: "Duplicates", value: "4", hint: "Matched", tone: "critical" },
    ],
    columns: [
      "Client",
      "Primary contact",
      "Email",
      "Market",
      "Owner",
      "Import state",
    ],
    rows: [
      {
        id: "client-import-1",
        status: "ready",
        cells: [
          "Brightline Builders",
          "Maya Torres",
          "maya@brightline.example",
          "Austin",
          "M. Reyes",
        ],
      },
      {
        id: "client-import-2",
        status: "warning",
        cells: [
          "Westward GC Partners",
          "Missing",
          "ops@westward.example",
          "San Antonio",
          "Unassigned",
        ],
      },
      {
        id: "client-import-3",
        status: "duplicate",
        cells: [
          "Summit Civic Construction",
          "Andre Hill",
          "andre@summitcivic.example",
          "Dallas",
          "L. Chen",
        ],
      },
      {
        id: "client-import-4",
        status: "ready",
        cells: [
          "Lone Star Siteworks",
          "Elena Cruz",
          "elena@lonestarsite.example",
          "Fort Worth",
          "M. Reyes",
        ],
      },
    ],
  },
} satisfies Record<
  ImportKind,
  {
    eyebrow: string;
    title: string;
    description: string;
    mockFile: string;
    accepted: string;
    metrics: {
      label: string;
      value: string;
      hint: string;
      tone?: "success" | "warning" | "critical";
    }[];
    columns: string[];
    rows: PreviewRow[];
  }
>;

export function ImportPage({ kind }: { kind: ImportKind }) {
  const [fileSelected, setFileSelected] = useState(true);
  const [validated, setValidated] = useState(false);
  const config = importConfigs[kind];

  const statusLabel = useMemo(
    () =>
      validated
        ? "Validation complete"
        : fileSelected
          ? "Ready to validate"
          : "Waiting for file",
    [fileSelected, validated],
  );

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {config.eyebrow}
          </p>
          <h2 className="text-[22px] font-semibold tracking-tight text-charcoal mt-1">
            {config.title}
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">
            {config.description}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-[11.5px] text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              validated
                ? "bg-success"
                : fileSelected
                  ? "bg-primary"
                  : "bg-muted-foreground/45",
            )}
          />
          {statusLabel}
        </span>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <button
            type="button"
            onClick={() => {
              setFileSelected(true);
              setValidated(false);
            }}
            className={cn(
              "rounded-lg border border-dashed p-5 text-left transition-colors min-h-40",
              fileSelected
                ? "border-primary/40 bg-primary/[0.03]"
                : "border-border bg-background hover:bg-secondary/40",
            )}
          >
            <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="size-4" />
            </div>
            <div className="mt-4 text-[14px] font-semibold text-charcoal">
              Drop a file here or click to browse
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-md">
              Accepted formats: .csv and .xlsx only.
            </p>
          </button>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
              Selected file
            </div>
            {fileSelected ? (
              <div className="mt-3 flex gap-3">
                <div className="size-9 rounded-md bg-card border border-border flex items-center justify-center text-primary shrink-0">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-charcoal truncate">
                    {config.mockFile}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    {config.accepted}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileSelected(false);
                      setValidated(false);
                    }}
                    className="text-[11.5px] text-muted-foreground hover:text-foreground mt-2 underline underline-offset-2"
                  >
                    Clear mock file
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-border px-3 py-4 text-[12.5px] text-muted-foreground">
                No file selected.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setFileSelected(true);
              setValidated(false);
            }}
            className="h-9 px-3 rounded-md border border-border bg-card text-[12.5px] font-medium hover:bg-secondary"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={!fileSelected}
            onClick={() => setValidated(true)}
            className="h-9 px-3 rounded-md border border-border bg-card text-[12.5px] font-medium hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Validate file
          </button>
          <button
            type="button"
            disabled={!fileSelected || !validated}
            className="h-9 px-4 rounded-md bg-charcoal text-white text-[12.5px] font-medium hover:bg-charcoal/85 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <ClipboardCheck className="size-3.5" />
            {kind === "opportunities"
              ? "Import opportunities"
              : "Import clients"}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
        {config.metrics.map((metric) => (
          <MetricCell key={metric.label} {...metric} />
        ))}
      </div>

      <section className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-charcoal">
              Import preview
            </h3>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              First rows from the mock file.
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {config.rows.length} preview rows
          </span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                {config.columns.map((column) => (
                  <th
                    key={column}
                    className={cn(
                      "text-left font-medium py-2 px-3 whitespace-nowrap",
                      column === "Import state" && "text-right",
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {config.rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.id}-${index}`}
                      className={cn(
                        "py-2.5 px-3 whitespace-nowrap",
                        index === 0
                          ? "font-medium text-charcoal"
                          : "text-foreground/85",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right">
                    <ImportStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "warning" | "critical";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "critical"
          ? "text-destructive"
          : "text-charcoal";

  return (
    <div className="bg-card p-3.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={cn(
          "text-[22px] font-semibold tracking-tight num mt-1",
          color,
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const styles = {
    ready:
      "bg-[oklch(0.62_0.13_155/0.12)] text-[oklch(0.4_0.13_155)] border-[oklch(0.62_0.13_155/0.3)]",
    warning:
      "bg-[oklch(0.72_0.15_70/0.13)] text-[oklch(0.42_0.15_70)] border-[oklch(0.72_0.15_70/0.3)]",
    duplicate:
      "bg-[oklch(0.605_0.21_28/0.10)] text-[oklch(0.5_0.21_28)] border-[oklch(0.605_0.21_28/0.3)]",
  }[status];
  const label =
    status === "ready"
      ? "Ready"
      : status === "warning"
        ? "Warning"
        : "Duplicate";

  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-1.5 rounded text-[10.5px] font-medium border tracking-wide whitespace-nowrap",
        styles,
      )}
    >
      {label}
    </span>
  );
}
