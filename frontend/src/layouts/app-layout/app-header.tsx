export function AppHeader({ title }: { title: string }) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center gap-4 px-6">
      <h1 className="text-[15px] font-semibold tracking-tight text-charcoal">
        {title}
      </h1>
    </header>
  );
}
