import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import ExerciseNotes from '../components/ExerciseNotes';
import WorkoutGoal from '../components/WorkoutGoal';
import { calculateWorkoutStats } from '../utils/workout';
import { formatDateTime, formatSetTime } from '../utils/date';
import { formatSetSummary } from '../utils/setMeasurements';
import { getWorkoutLoadMetrics } from '../utils/workoutPresentation';
import { formatWorkoutDuration } from '../utils/workoutDuration';

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
  const navigate = useNavigate();
  const { state, resumeWorkout } = useAppData();
  const workout = state.workouts.find((item) => item.id === workoutId);

  if (!workout) {
    return (
      <EmptyState
        title="Workout nicht gefunden"
      />
    );
  }

  const stats = calculateWorkoutStats(workout);
  const { primary, additional } = getWorkoutLoadMetrics(stats, { showAdditionalDuration: false });
  const duration = workout.completedAt ? formatWorkoutDuration(workout) : null;

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
          <button
            type="button"
            onClick={() => {
              if (resumeWorkout(workout.id)) navigate(`/workouts/${workout.id}/edit`);
            }}
            className="action-button"
          >
            {workout.completedAt ? 'Korrigieren' : 'Fortsetzen'}
          </button>
        </div>

        <div className={`mt-5 grid gap-2 border-t border-line pt-4 ${duration ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
          {duration ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Gesamtzeit</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{duration}</p>
              {duration !== '–' && <p className="text-xs text-muted">inkl. 5 min Warm-up</p>}
            </div>
          ) : null}
        </div>
        {additional ? <p className="mt-3 text-sm text-muted">{additional}</p> : null}
      </section>

      <section className="space-y-3">
        {workout.exercises.map((exercise, exerciseIndex) => (
          <article
            key={exercise.id}
            className={`panel overflow-hidden ${exercise.skipped ? 'border-ember/35' : ''}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex min-w-0 items-baseline gap-2 font-display text-xl font-bold text-ink sm:text-2xl">
                    <span className="shrink-0 tabular-nums text-muted">{exerciseIndex + 1}</span>
                    <span className="min-w-0 break-words">{exercise.name}</span>
                  </h2>
                  {exercise.skipped ? (
                    <span className="rounded-sm border border-ember/40 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
                      Ausgelassen
                    </span>
                  ) : null}
                </div>
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

            <WorkoutGoal exercise={exercise} />
            {exercise.sets.length ? (
              <div className="divide-y divide-line">
                {exercise.sets.map((setItem, index) => {
                  const setTime = formatSetTime(setItem.savedAt);

                  return (
                    <div
                      key={setItem.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 px-4 py-2"
                    >
                      <span className="whitespace-nowrap text-xs font-bold tabular-nums text-amber-deep [[data-theme=calendar]_&]:text-orange-800">
                        <span className="sr-only">Satz </span>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="font-display text-base font-bold leading-snug tabular-nums text-ink">
                        {formatSetSummary(setItem)}
                      </p>
                      {setTime ? (
                        <time
                          dateTime={setItem.savedAt}
                          className="text-xs tabular-nums text-muted"
                          title={`Satz gespeichert um ${setTime}`}
                          aria-label={`Satz gespeichert um ${setTime}`}
                        >
                          {setTime}
                        </time>
                      ) : null}
                      {setItem.comment ? (
                        <p className="col-start-2 col-end-4 row-start-2 whitespace-pre-line break-words text-xs italic text-muted">
                          {setItem.comment}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : !exercise.notes?.length ? (
              <p className="px-4 py-3 text-sm text-muted">
                {exercise.skipped ? 'Ausgelassen' : 'Keine Sätze'}
              </p>
            ) : null}
            <ExerciseNotes notes={exercise.notes} />
          </article>
        ))}
      </section>
    </div>
  );
}
