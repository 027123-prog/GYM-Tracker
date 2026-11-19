export default function QuickEntryTile({ selected, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={`quick-entry-choice inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border px-2 text-sm font-bold tabular-nums transition ${
        selected
          ? 'border-amber bg-amber-soft text-amber-deep'
          : 'border-line bg-paper text-muted hover:border-amber/60 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
