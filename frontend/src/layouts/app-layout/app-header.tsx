import { Bell, Search } from "lucide-react";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center gap-4 px-6">
      <h1 className="text-[15px] font-semibold tracking-tight text-charcoal">
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search projects, GCs, cities…"
            className="h-8 w-72 rounded-md bg-background border border-border pl-8 pr-3 text-[12.5px] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/60"
          />
        </div>
        <button className="relative size-8 rounded-md border border-border bg-background hover:bg-secondary flex items-center justify-center">
          <Bell className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
        </button>
      </div>
    </header>
  );
}
