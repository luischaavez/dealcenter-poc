import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export function ScorePopover({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "h-9 px-3 rounded-md border bg-card text-[12.5px] flex items-center gap-1.5 transition-colors",
          value > 0
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        Min score
        {value > 0 && (
          <span className="num bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">
            {value}
          </span>
        )}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 z-30 bg-popover border border-border rounded-lg shadow-lg w-[260px] p-3">
            <div className="flex items-center justify-between text-[11.5px] mb-2">
              <span className="text-muted-foreground">Minimum match score</span>
              <span className="num font-semibold text-foreground">{value}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
