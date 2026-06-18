import {
  CircleDot,
  Download,
  Filter,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const metricWidths = ["w-10", "w-12", "w-16", "w-20"];
const cardWidths = ["w-[62%]", "w-[48%]", "w-[56%]"];

export function OpportunitiesLoadingState() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex h-6 items-center gap-2 rounded-md border border-primary/20 bg-primary/8 px-2.5 text-[11.5px] font-medium text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              Syncing opportunity signals
            </div>
            <Skeleton className="mt-3 h-7 w-44 bg-foreground/10" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 rounded-md border border-border bg-muted px-3 text-[12.5px] font-medium text-muted-foreground inline-flex items-center gap-1.5">
              <Download className="size-3.5" />
              Export CSV
            </div>
            <div className="h-8 rounded-md bg-charcoal/12 px-3 text-[12.5px] font-medium text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Run intelligence
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricWidths.map((width, index) => (
            <div
              key={width}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="size-7 rounded-md bg-primary/8 text-primary inline-flex items-center justify-center">
                  {index === 0 ? (
                    <Sparkles className="size-4" />
                  ) : (
                    <CircleDot className="size-4" />
                  )}
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className={`mt-4 h-8 ${width} bg-foreground/10`} />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="-mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/85 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <div className="h-9 w-full rounded-md bg-card border border-border pl-9 pr-3 flex items-center">
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            {["Status", "Services", "Tier"].map((label) => (
              <div
                key={label}
                className="h-9 px-3 rounded-md border border-border bg-card text-[12.5px] text-muted-foreground inline-flex items-center gap-1.5"
              >
                <Filter className="size-3.5" />
                {label}
              </div>
            ))}
            <Skeleton className="ml-auto h-9 w-28 rounded-md bg-card border border-border" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {cardWidths.map((width, index) => (
            <div
              key={width}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-sm" />
                    <Skeleton className="h-5 w-16 rounded-md bg-primary/10" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton
                    className={`mt-4 h-5 ${width} max-w-full bg-foreground/10`}
                  />
                  <div className="mt-3 flex items-center gap-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <div className="mt-4 flex items-center gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                    {index !== 1 && (
                      <Skeleton className="h-5 w-14 rounded-md" />
                    )}
                  </div>
                </div>
                <div className="lg:w-[180px] lg:border-l lg:border-border lg:pl-5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-3 h-7 w-24 bg-foreground/10" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
                <div className="lg:w-[200px] lg:border-l lg:border-border lg:pl-5 flex items-center justify-between gap-3">
                  <Skeleton className="size-12 rounded-full bg-primary/10" />
                  <Skeleton className="h-9 flex-1 rounded-md bg-foreground/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
