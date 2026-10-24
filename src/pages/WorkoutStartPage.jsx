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
      </div>
    </section>
  );
}
