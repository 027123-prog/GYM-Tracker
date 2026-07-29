import { Link } from 'react-router-dom';
import { calculateWorkoutStats } from '../utils/workout';
import { formatDate } from '../utils/date';

function formatVolume(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

export default function WorkoutCard({ workout, compact = false }) {
  const stats = calculateWorkoutStats(workout);

  if (compact) {
    return (
      <Link
        to={workout.completedAt ? `/workouts/${workout.id}` : `/workouts/${workout.id}/edit`}
        className="grid gap-3 bg-surface px-4 py-4 transition hover:bg-surface-raised sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{workout.mode === 'template' ? 'Vorlage' : 'Frei'}</span>
            <span className="text-xs text-muted">{formatDate(workout.date)}</span>
            {!workout.completedAt ? (
              <span className="rounded-sm border border-amber/30 bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-deep">
                Offen
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-ink sm:text-lg">{workout.name}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-left sm:min-w-[250px] sm:text-right">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Volumen</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-ink">{formatVolume(stats.totalVolume)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Übungen</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-ink">{stats.exerciseCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Sätze</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-ink">{stats.setCount}</p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="panel flex min-h-[170px] flex-col justify-between p-5 transition hover:border-amber/55"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{workout.mode === 'template' ? 'Vorlage' : 'Frei'}</p>
          <span className="text-xs text-muted">{formatDate(workout.date)}</span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold text-ink">{workout.name}</h3>
      </div>
      <div className="grid grid-cols-3 border-t border-line pt-3 text-sm">
        <span className="font-bold tabular-nums text-ink">{formatVolume(stats.totalVolume)} kg</span>
        <span className="text-center font-bold tabular-nums text-ink">{stats.exerciseCount} Üb.</span>
        <span className="text-right font-bold tabular-nums text-ink">{stats.setCount} Sätze</span>
      </div>
    </Link>
  );
}
