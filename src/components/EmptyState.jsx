export default function EmptyState({ title, description }) {
  return (
    <div className="rounded-sm border border-dashed border-line bg-paper/40 p-7 text-center">
      <p className="eyebrow">Keine Daten</p>
      <h3 className="mt-2 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{description}</p>
    </div>
  );
}
