import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import { calculateWorkoutStats } from '../utils/workout';
import { formatDateTime, formatSetTime } from '../utils/date';
import { formatSetSummary } from '../utils/setMeasurements';
import { getWorkoutLoadMetrics } from '../utils/workoutPresentation';

function ChartIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M4 19V5M4 19H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="m7 15 3.2-3.4 3 2.1L19 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WorkoutDetailPage() {
  const { workoutId } = useParams();
  const { state } = useAppData();
  const workout = state.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return (
      <EmptyState
        title="Workout nicht gefunden"
      />
    );
  }

  const stats = calculateWorkoutStats(workout);
  const { primary, additional } = getWorkoutLoadMetrics(stats);

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{workout.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {workout.completedAt ? `Abgeschlossen ${formatDateTime(workout.completedAt)}` : 'Noch nicht abgeschlossen'}
            </p>
          </div>
          <Link to={`/workouts/${workout.id}/edit`} className="action-button">
            {workout.completedAt ? 'Korrigieren' : 'Fortsetzen'}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{primary.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink">{primary.display}</p>
            {primary.unit ? <p className="text-[10px] text-muted">{primary.unit}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Übungen</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink">{stats.exerciseCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Sätze</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink">{stats.setCount}</p>
          </div>
        </div>
        {additional ? <p className="mt-3 text-sm text-muted">{additional}</p> : null}
      </section>

      <section className="space-y-3">
        {workout.exercises.map((exercise, exerciseIndex) => {
          const legacyMachineSettings = (exercise.machineSettings ?? [])
            .map((setting) => `${setting.label}: ${setting.value}`)
            .join(' · ');
          const libraryExercise = state.exercises.find((item) => item.id === exercise.exerciseId);
          const setupNotes = libraryExercise?.settings?.setupNotes ?? '';
          const machineSettings = [setupNotes, legacyMachineSettings && !setupNotes.includes(legacyMachineSettings) ? legacyMachineSettings : ''].filter(Boolean).join(' · ');

          return (
            <article
              key={exercise.id}
              className={`panel overflow-hidden ${exercise.skipped ? 'border-ember/35' : ''}`}
            >
              <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow">Übung {String(exerciseIndex + 1).padStart(2, '0')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{exercise.name}</h2>
                    {exercise.skipped ? (
                      <span className="rounded-sm border border-ember/40 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
                        Ausgelassen
                      </span>
                    ) : null}
                  </div>
                  {machineSettings ? <p className="mt-2 text-xs text-muted">Setup · {machineSettings}</p> : null}
                </div>
                <Link
                  to={`/exercises/${exercise.exerciseId}/chart`}
                  className="icon-button"
                  aria-label={`Übungsverlauf von ${exercise.name} als Diagramm öffnen`}
                  title="Übungsverlauf öffnen"
                >
                  <ChartIcon />
                </Link>
              </div>

              {exercise.sets.length ? (
                <div className="divide-y divide-line">
                  {exercise.sets.map((setItem, index) => {
                    const setTime = workout.completedAt ? formatSetTime(setItem.savedAt) : '';

                    return (
                      <div
                        key={setItem.id}
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[70px_150px_minmax(0,1fr)] sm:items-center"
                      >
                        <div>
                          <span className="eyebrow">Satz {String(index + 1).padStart(2, '0')}</span>
                          {setTime ? (
                            <time
                              dateTime={setItem.savedAt}
                              className="mt-0.5 block text-[10px] leading-tight tabular-nums text-muted"
                              title={`Satz gespeichert um ${setTime}`}
                              aria-label={`Satz gespeichert um ${setTime}`}
                            >
                              {setTime}
                            </time>
                          ) : null}
                        </div>
                        <p className="font-display text-lg font-bold tabular-nums text-ink">
                          {formatSetSummary(setItem)}
                        </p>
                        {setItem.comment ? (
                          <div className="text-xs italic text-muted">
                            <p>{setItem.comment}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm text-muted">
                  {exercise.skipped ? 'Ausgelassen' : 'Keine Sätze'}
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
