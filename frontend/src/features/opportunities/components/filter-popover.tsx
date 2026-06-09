import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export function FilterPopover<T extends string>({
  label,
  items,
  selected,
  onChange,
  formatLabel = (value: T) => value,
}: {
  label: string;
  items: readonly T[];
  selected: T[];
  onChange: (value: T[]) => void;
  formatLabel?: (value: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (item: T) =>
    onChange(
      selected.includes(item)
        ? selected.filter((value) => value !== item)
        : [...selected, item],
    );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "h-9 px-3 rounded-md border bg-card text-[12.5px] flex items-center gap-1.5 transition-colors",
          selected.length
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="num bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 z-30 bg-popover border border-border rounded-lg shadow-lg min-w-[220px] p-1.5">
            {items.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] hover:bg-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() => toggle(item)}
                  className="accent-primary"
                />
                <span className="text-foreground">{formatLabel(item)}</span>
              </label>
            ))}
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-2 py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground border-t border-border mt-1"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
