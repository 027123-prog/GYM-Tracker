import { Link } from 'react-router-dom';
import { calculateWorkoutStats } from '../utils/workout';
import { formatDate } from '../utils/date';

export default function WorkoutCard({ workout }) {
  const stats = calculateWorkoutStats(workout);

  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="panel flex min-h-[190px] flex-col justify-between p-6 transition hover:-translate-y-1 hover:border-pine/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/70">
            {workout.mode === 'template' ? 'Vorlage' : 'Frei'}
          </p>
          <h3 className="mt-3 font-display text-2xl font-semibold text-ink">{workout.name}</h3>
          <p className="mt-2 text-sm text-ink/65">{formatDate(workout.date)}</p>
        </div>
        <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/70">
          {workout.completedAt ? 'Abgeschlossen' : 'In Arbeit'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm text-ink/72">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Volumen</p>
          <p className="mt-2 font-semibold text-ink">{stats.totalVolume.toFixed(0)} kg</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Übungen</p>
          <p className="mt-2 font-semibold text-ink">{stats.exerciseCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Sätze</p>
          <p className="mt-2 font-semibold text-ink">{stats.setCount}</p>
        </div>
      </div>
    </Link>
  );
}
