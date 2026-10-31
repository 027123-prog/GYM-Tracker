import { Link } from 'react-router-dom';

export default function WorkoutStartPage() {
  return (
    <section className="mx-auto w-full max-w-lg space-y-4">
      <div className="border-b border-line pb-4 text-center">
        <h1 className="font-display text-3xl font-bold uppercase text-ink">Training starten</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/workouts/new"
          className="panel flex min-h-36 flex-col items-center justify-center border-amber/35 p-5 text-center transition hover:border-amber hover:bg-amber-soft"
        >
          <span aria-hidden="true" className="font-display text-3xl font-bold text-amber">+</span>
          <span className="mt-2 text-lg font-bold text-ink">Freies Workout</span>
        </Link>

        <Link
          to="/workouts/template"
          className="panel flex min-h-36 flex-col items-center justify-center p-5 text-center transition hover:border-amber hover:bg-amber-soft"
        >
          <span aria-hidden="true" className="font-display text-xl font-bold text-amber">01</span>
          <span className="mt-2 text-lg font-bold text-ink">Aus Vorlage</span>
        </Link>

        <Link
          to="/templates"
          className="panel flex min-h-36 flex-col items-center justify-center p-5 text-center transition hover:border-amber hover:bg-amber-soft sm:col-span-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-6 w-6 text-amber"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
          <span className="mt-2 text-lg font-bold text-ink">Vorlagenübersicht</span>
        </Link>
      </div>
    </section>
  );
}
