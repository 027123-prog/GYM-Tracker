import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import { normalizeExerciseSortMode, sortExerciseCards } from '../utils/exerciseSort';
import { getExerciseWorkoutCount, getLastExerciseSnapshot } from '../utils/workout';

const sortOptions = [
  { value: 'count-desc', label: 'Anzahl: meiste' },
  { value: 'name-asc', label: 'Alphabet A–Z' },
  { value: 'newest', label: 'Neueste Übungen' },
  { value: 'last-trained', label: 'Zuletzt trainiert' },
  { value: 'name-desc', label: 'Alphabet Z–A' },
];

function normalizeSearch(value) {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export default function ExerciseLibraryPage() {
  const { state } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const sortMode = normalizeExerciseSortMode(searchParams.get('sort'));

  const exercises = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    const exerciseCards = state.exercises
      .map((exercise, sourceIndex) => {
        const latestSnapshot = getLastExerciseSnapshot(state.workouts, exercise.id, null, exercise.name);

        return {
          ...exercise,
          sourceIndex,
          workoutCount: getExerciseWorkoutCount(state.workouts, exercise.id, exercise.name),
          lastTrainedAt: latestSnapshot?.workoutDate ?? null,
          latestSummary:
            latestSnapshot?.sets.map((setItem) => `${setItem.weight}kgx${setItem.reps}`).join(' ') ?? '',
        };
      })
      .filter((exercise) => !normalizedQuery || normalizeSearch(exercise.name).includes(normalizedQuery));

    return sortExerciseCards(exerciseCards, sortMode);
  }, [query, sortMode, state.exercises, state.workouts]);

  const currentSearch = searchParams.toString();
  const libraryReturnTo = currentSearch ? `/exercises?${currentSearch}` : '/exercises';
  const exerciseOrder = exercises.map((exercise) => exercise.id);

  function updateSearchParams(key, value, defaultValue = '') {
    const nextParams = new URLSearchParams(searchParams);

    if (!value || value === defaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Bibliothek</p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase text-ink sm:text-4xl">Übungen</h1>
          <p className="mt-2 text-sm text-muted">{state.exercises.length} Übungen mit Verlauf und Gewichten.</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] md:max-w-xl">
          <label>
            <span className="sr-only">Übungen durchsuchen</span>
            <input
              type="search"
              className="field"
              value={query}
              onChange={(event) => updateSearchParams('q', event.target.value)}
              placeholder="Übung suchen …"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Übungen sortieren</span>
            <select
              className="secondary-button h-[46px] w-full appearance-none justify-start pl-3 pr-10 text-left sm:w-auto"
              value={sortMode}
              onChange={(event) => updateSearchParams('sort', event.target.value, 'count-desc')}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-display text-base font-bold text-amber"
            >
              ⇅
            </span>
          </label>
        </div>
      </section>

      <section className="grid gap-2 lg:grid-cols-2">
        {exercises.map((exercise) => (
          <Link
            key={exercise.id}
            to={`/exercises/${exercise.id}/chart`}
            state={{ exerciseOrder, libraryReturnTo }}
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
