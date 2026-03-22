export default function DashboardHeader({ workoutCount, templateCount }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
      <div className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-pine/70">Dashboard</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Letzte Workouts auf einen Blick.</h2>
        <p className="mt-3 max-w-2xl text-sm text-ink/70">
          Die neuesten Sessions stehen oben. Starte direkt ein freies Workout oder ziehe eine editierbare Vorlage.
        </p>
      </div>
      <div className="panel grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Workouts</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{workoutCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Vorlagen</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{templateCount}</p>
        </div>
      </div>
    </section>
  );
}
