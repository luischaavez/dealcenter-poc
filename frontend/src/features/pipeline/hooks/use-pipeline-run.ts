import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  triggerPipeline,
  fetchPipelineStatus,
  type PipelineStatus,
} from "@/lib/api";

const IDLE: PipelineStatus = {
  status: "idle",
  run_id: null,
  started_at: null,
  error: null,
};

export function usePipelineRun() {
  const queryClient = useQueryClient();
  const [pipeline, setPipeline] = useState<PipelineStatus>(IDLE);

  // Check status on mount — surface any in-progress run immediately
  useEffect(() => {
    fetchPipelineStatus()
      .then(setPipeline)
      .catch(() => {});
  }, []);

  // Poll every 3s while running
  useEffect(() => {
    if (pipeline.status !== "running") return;

    const id = setInterval(async () => {
      try {
        const s = await fetchPipelineStatus();
        setPipeline(s);
        if (s.status === "idle") {
          await queryClient.invalidateQueries({ queryKey: ["leads-latest"] });
          toast.success("Pipeline complete — leads refreshed");
        } else if (s.status === "error") {
          toast.error(`Pipeline error: ${s.error ?? "unknown"}`);
        }
      } catch {
        // ignore transient polling failures
      }
    }, 3000);

    return () => clearInterval(id);
  }, [pipeline.status, queryClient]);

  const trigger = useCallback(async () => {
    try {
      const result = await triggerPipeline();
      if (result.accepted) {
        setPipeline({ ...IDLE, status: "running" });
        toast.info("Pipeline started…");
      } else {
        toast.warning(result.message);
      }
    } catch (e) {
      toast.error(`Could not start pipeline: ${e}`);
    }
  }, []);

  return {
    pipeline,
    trigger,
    isRunning: pipeline.status === "running",
    isError: pipeline.status === "error",
  };
}
