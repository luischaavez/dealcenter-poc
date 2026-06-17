import { AlertCircle, Loader2, Zap } from "lucide-react";
import { usePipelineRun } from "../hooks/use-pipeline-run";

export function RunPipelineButton() {
  const { trigger, isRunning, isError } = usePipelineRun();

  if (isRunning) {
    return (
      <button
        disabled
        className="h-8 px-3 rounded-md bg-muted text-muted-foreground text-[12.5px] font-medium flex items-center gap-1.5 cursor-not-allowed"
      >
        <Loader2 className="size-3.5 animate-spin" />
        Running…
      </button>
    );
  }

  if (isError) {
    return (
      <button
        onClick={trigger}
        className="h-8 px-3 rounded-md bg-destructive/10 text-destructive border border-destructive/30 text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-destructive/20 transition-colors"
      >
        <AlertCircle className="size-3.5" />
        Run failed — retry
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
