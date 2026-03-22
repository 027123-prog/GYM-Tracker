import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import { calculateWorkoutStats } from '../utils/workout';
import { formatDateTime } from '../utils/date';

export default function WorkoutDetailPage() {
  const { workoutId } = useParams();
  const { state } = useAppData();
  const workout = state.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return (
      <EmptyState
        title="Workout nicht gefunden"
        description="Die angeforderte Session ist nicht in deiner lokalen Datenbank vorhanden."
      />
    );
  }

  const stats = calculateWorkoutStats(workout);

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine/70">
              {workout.mode === 'template' ? 'Vorlagen-Workout' : 'Freies Workout'}
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-ink">{workout.name}</h2>
            <p className="mt-3 text-sm text-ink/68">Zuletzt aktualisiert: {formatDateTime(workout.updatedAt)}</p>
          </div>
          <Link to={`/workouts/${workout.id}/edit`} className="action-button">
            Bearbeiten
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Volumen</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{stats.totalVolume.toFixed(0)} kg</p>
          </div>
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Übungen</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{stats.exerciseCount}</p>
          </div>
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Sätze</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{stats.setCount}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {workout.exercises.map((exercise) => (
          <article key={exercise.id} className="panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-2xl font-semibold text-ink">{exercise.name}</h3>
                  {exercise.skipped ? (
                    <span className="rounded-full bg-ember/15 px-3 py-1 text-xs font-semibold text-ember">Besetzt</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-ink/60">{exercise.sets.length} gespeicherte Sätze</p>
              </div>
              <Link to={`/exercises/${exercise.exerciseId}/chart`} className="secondary-button">
                Zum Diagramm
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {exercise.sets.map((setItem, index) => (
                <div key={setItem.id} className="rounded-3xl border border-ink/10 bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Satz {index + 1}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {setItem.weight} kg x {setItem.reps}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
