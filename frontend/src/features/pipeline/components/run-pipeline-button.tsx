import { AlertCircle, Loader2, Zap } from "lucide-react";
import { usePipelineRun } from "../hooks/use-pipeline-run";

export function RunPipelineButton() {
  const { pipeline, trigger, isRunning, isError } = usePipelineRun();

  if (isRunning) {
    const { stage, progress } = pipeline;
    const progressLabel =
      progress ? ` (${progress.current}/${progress.total})` : "";
    const stageLabel = stage ? `${stage}${progressLabel}` : "Running…";

    return (
      <button
        disabled
        title={stageLabel}
        className="h-8 px-3 rounded-md bg-muted text-muted-foreground text-[12.5px] font-medium flex items-center gap-1.5 cursor-not-allowed max-w-[220px]"
      >
        <Loader2 className="size-3.5 animate-spin shrink-0" />
        <span className="truncate">{stageLabel}</span>
      </button>
    );
  }

  if (isError) {
    const errorTitle = pipeline.error ?? "Unknown error";
    return (
      <button
        onClick={trigger}
        title={errorTitle}
        className="h-8 px-3 rounded-md bg-destructive/10 text-destructive border border-destructive/30 text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-destructive/20 transition-colors max-w-[220px]"
      >
        <AlertCircle className="size-3.5 shrink-0" />
        <span className="truncate">Run failed — retry</span>
      </button>
    );
  }

  return (
    <button
      onClick={trigger}
      className="h-8 px-3 rounded-md bg-charcoal text-white text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-charcoal/85 transition-colors"
    >
      <Zap className="size-3.5" />
      Run Intelligence
    </button>
  );
}
