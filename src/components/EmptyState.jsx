export default function EmptyState({ title, description }) {
  return (
    <div className="panel p-8 text-center">
      <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm text-ink/70">{description}</p>
    </div>
  );
}
