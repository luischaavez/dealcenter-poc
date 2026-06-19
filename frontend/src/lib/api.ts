/**
 * DealCenter API client.
 * Reads VITE_API_URL from the environment. All functions throw if the URL is missing.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface RunSummary {
  id: string;
  run_at: string;
  stats: {
    ingested: number;
    filtered: number;
    qualified: number;
    surfaced: number;
    states: string[];
    days_back: number;
  };
}

export interface PipelineStatus {
  status: "idle" | "running" | "error";
  run_id: string | null;
  started_at: string | null;
  stage: string | null;
  progress: { current: number; total: number } | null;
  error: string | null;
}

/** Fetch the latest pipeline run (stats + leads). Response shape is identical to leads_latest.json. */
export async function fetchLatestLeads(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/leads`);
  if (!res.ok) throw new Error(`API /leads returned ${res.status}`);
  return res.json();
}

/** Fetch the list of all pipeline runs (newest first). */
export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${API_URL}/runs`);
  if (!res.ok) throw new Error(`API /runs returned ${res.status}`);
  return res.json();
}

/** Fetch leads for a specific historical run. */
export async function fetchRunById(
  runId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/runs/${runId}`);
  if (!res.ok) throw new Error(`API /runs/${runId} returned ${res.status}`);
  return res.json();
}

/** Trigger a new pipeline run. */
export async function triggerPipeline(): Promise<{
  accepted: boolean;
  message: string;
}> {
  const res = await fetch(`${API_URL}/pipeline/run`, { method: "POST" });
  if (!res.ok) throw new Error(`API /pipeline/run returned ${res.status}`);
  return res.json();
}

/** Poll the pipeline status. */
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API_URL}/pipeline/status`);
  if (!res.ok) throw new Error(`API /pipeline/status returned ${res.status}`);
  return res.json();
}

export interface DodgeUpload {
  id: number;
  file_date: string;
  uploaded_at: string | null;
  storage_key: string;
  filename: string;
}

export interface DashboardSummary {
  run_id: string;
  generated_at: string;
  stats: {
    ingested: number;
    filtered: number;
    qualified: number;
    surfaced: number;
    days_back: number;
  };
  tiers: { hot: number; warm: number };
  status_distribution: { status: string; count: number }[];
  score_distribution: { bucket: string; count: number }[];
  change_trend: { day: string; changes: number; hot: number }[];
}

export interface TopLead {
  rank: number;
  id: string;
  name: string;
  status: string;
  score: number;
  status_tier: string;
}

/** Lightweight dashboard summary for the latest pipeline run. */
export async function fetchDashboard(): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard`);
  if (!res.ok) throw new Error(`API /dashboard returned ${res.status}`);
  return res.json();
}

/** Top N leads (rank, name, status, score, tier) for the latest run. */
export async function fetchTopLeads(limit = 5): Promise<TopLead[]> {
  const res = await fetch(`${API_URL}/dashboard/top-leads?limit=${limit}`);
  if (!res.ok) throw new Error(`API /dashboard/top-leads returned ${res.status}`);
  return res.json();
}

/** List all registered Dodge uploads, newest first. */
export async function fetchDodgeUploads(): Promise<DodgeUpload[]> {
  const res = await fetch(`${API_URL}/dodge/uploads`);
  if (!res.ok) throw new Error(`API /dodge/uploads returned ${res.status}`);
  return res.json();
}

/** Upload a Dodge Excel file and register it for the given date (defaults to today). */
export async function uploadDodgeFile(
  file: File,
  fileDate?: string,
): Promise<DodgeUpload> {
  const form = new FormData();
  form.append("file", file);
  const url = fileDate
    ? `${API_URL}/dodge/upload?file_date=${fileDate}`
    : `${API_URL}/dodge/upload`;
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { detail?: string })?.detail ?? `Upload failed (${res.status})`);
  }
  return res.json();
}
