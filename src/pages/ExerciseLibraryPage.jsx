import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import { getExerciseWorkoutCount, getLastExerciseSummaryText } from '../utils/workout';

function normalizeSearch(value) {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export default function ExerciseLibraryPage() {
  const { state } = useAppData();
  const [query, setQuery] = useState('');

  const exercises = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    return [...state.exercises]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .filter((exercise) => !normalizedQuery || normalizeSearch(exercise.name).includes(normalizedQuery))
      .map((exercise) => ({
        ...exercise,
        workoutCount: getExerciseWorkoutCount(state.workouts, exercise.id, exercise.name),
        latestSummary: getLastExerciseSummaryText(state.workouts, exercise.id, null, exercise.name),
      }));
  }, [query, state.exercises, state.workouts]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Bibliothek</p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase text-ink sm:text-4xl">Übungen</h1>
          <p className="mt-2 text-sm text-muted">{state.exercises.length} Übungen mit Verlauf und Gewichten.</p>
        </div>
        <label className="w-full md:max-w-sm">
          <span className="sr-only">Übungen durchsuchen</span>
          <input
            type="search"
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Übung suchen …"
          />
        </label>
      </section>

      <section className="grid gap-2 lg:grid-cols-2">
        {exercises.map((exercise) => (
          <Link
            key={exercise.id}
            to={`/exercises/${exercise.id}/chart`}
            className="panel group grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 transition hover:border-amber/55 hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <h2 className="font-bold text-ink group-hover:text-amber-deep">{exercise.name}</h2>
              <p className="mt-1 truncate text-xs text-muted">
                {exercise.latestSummary || 'Noch keine abgeschlossene Historie'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold tabular-nums text-ink">{exercise.workoutCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Workouts</p>
            </div>
          </Link>
        ))}
      </section>

      {!exercises.length ? (
        <div className="rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
          Keine Übung passt zu „{query}“.
        </div>
      ) : null}
    </div>
  );
}
