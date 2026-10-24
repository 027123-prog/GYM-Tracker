import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import LibraryExerciseDialog from '../components/LibraryExerciseDialog';
import { getExerciseRemovalImpact, referencesExercise } from '../utils/exerciseEditing';
import { normalizeExerciseSortMode, sortExerciseCards } from '../utils/exerciseSort';
import { getExerciseWorkoutCount, getLastExerciseSnapshot } from '../utils/workout';
import { formatSetSummary } from '../utils/setMeasurements';

const sortOptions = [
  { value: 'count-desc', label: 'Am häufigsten trainiert' },
  { value: 'name-asc', label: 'Alphabet A–Z' },
  { value: 'newest', label: 'Neueste Übungen' },
  { value: 'last-trained', label: 'Zuletzt trainiert' },
  { value: 'name-desc', label: 'Alphabet Z–A' },
];

const filters = [
  { value: 'all', label: 'Alle', description: 'Aktive Übungen in deiner Bibliothek.' },
  { value: 'templates', label: 'In Vorlagen', description: 'Übungen aus deinen gespeicherten Trainingsplänen.' },
  { value: 'unused', label: 'Unbenutzt', description: 'Ohne Sätze, ohne Vorlage und ohne Verweis in einem offenen Training.' },
  { value: 'archive', label: 'Archiv', description: 'Ausgeblendete Übungen mit erhaltenem Verlauf. Wiederherstellen ergänzt sie wieder in der Auswahl; Vorlagen bleiben wie eingerichtet.' },
];

function normalizeSearch(value) {
  return value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function matchesFilter(exercise, filter) {
  if (filter === 'archive') return Boolean(exercise.archivedAt);
  if (exercise.archivedAt) return false;
  if (filter === 'templates') return exercise.templateNames.length > 0;
  if (filter === 'unused') return !exercise.hasSets && !exercise.hasOpenWorkout && !exercise.templateNames.length;
  return true;
}

export default function ExerciseLibraryPage() {
  const { state, renameLibraryExercise, removeLibraryExercise, restoreLibraryExercise } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState(null);
  const query = searchParams.get('q') ?? '';
  const sortMode = normalizeExerciseSortMode(searchParams.get('sort'));
  const filter = filters.find((item) => item.value === searchParams.get('view')) ?? filters[0];

  const exerciseCards = useMemo(() => {
    const knownIds = new Set(state.exercises.map((exercise) => exercise.id));
    return state.exercises.map((exercise, sourceIndex) => {
    const isReference = (entry) => referencesExercise(entry, exercise, knownIds);
    const latestSnapshot = getLastExerciseSnapshot(state.workouts, exercise.id, null, exercise.name);
    const templateNames = state.templates
      .filter((template) => template.exerciseTemplates.some(isReference))
      .map((template) => template.name);
    const references = state.workouts.flatMap((workout) => workout.exercises
      .filter(isReference)
      .map((entry) => ({ entry, isOpen: !workout.completedAt })));

    return {
      ...exercise,
      sourceIndex,
      templateNames,
      hasSets: references.some(({ entry }) => entry.sets.length > 0),
      hasOpenWorkout: references.some(({ isOpen }) => isOpen),
      workoutCount: getExerciseWorkoutCount(state.workouts, exercise.id, exercise.name),
      lastTrainedAt: latestSnapshot?.workoutDate ?? null,
      latestSummary: latestSnapshot?.sets.map(formatSetSummary).join(' · ') ?? '',
    };
    });
  }, [state.exercises, state.templates, state.workouts]);

  const counts = Object.fromEntries(filters.map((item) => [item.value, exerciseCards.filter((exercise) => matchesFilter(exercise, item.value)).length]));
  const exercises = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return sortExerciseCards(exerciseCards.filter((exercise) => matchesFilter(exercise, filter.value)
      && (!normalizedQuery || normalizeSearch([exercise.name, ...exercise.templateNames].join(' ')).includes(normalizedQuery))), sortMode);
  }, [exerciseCards, filter.value, query, sortMode]);

  const currentSearch = searchParams.toString();
  const libraryReturnTo = currentSearch ? `/exercises?${currentSearch}` : '/exercises';
  const exerciseOrder = exercises.map((exercise) => exercise.id);
  const selectedExercise = action ? exerciseCards.find((exercise) => exercise.id === action.exerciseId) : null;

  function updateSearchParams(key, value, defaultValue = '') {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) nextParams.delete(key);
    else nextParams.set(key, value);
    setSearchParams(nextParams, { replace: true });
  }

  function openAction(type, exerciseId) {
    setNotice(null);
    setAction({ type, exerciseId });
  }

  function restoreExercise(exercise) {
    const error = restoreLibraryExercise(exercise.id);
    setNotice({ error: Boolean(error), text: error || `„${exercise.name}“ ist wieder in der Bibliothek.` });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Bibliothek</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase text-ink sm:text-4xl">Übungen</h1>
          <p className="mt-1 text-sm text-muted">{counts.all} aktiv · {counts.archive} im Archiv</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label>
            <span className="sr-only">Übungen durchsuchen</span>
            <input type="search" className="field" value={query} onChange={(event) => updateSearchParams('q', event.target.value)} placeholder="Übung oder Vorlage suchen …" />
          </label>
          <label>
            <span className="sr-only">Übungen sortieren</span>
            <select className="field h-full sm:w-auto" value={sortMode} onChange={(event) => updateSearchParams('sort', event.target.value, 'count-desc')}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Übungen filtern">
          {filters.map((item) => (
            <button key={item.value} type="button" onClick={() => updateSearchParams('view', item.value, 'all')}
              aria-pressed={item.value === filter.value}
              className={`${item.value === filter.value ? 'action-button' : 'secondary-button'} justify-between gap-2 px-3`}>
              <span>{item.label}</span><span className="tabular-nums opacity-75">{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">{filter.description}</p>
      </section>

      {notice ? <p role={notice.error ? 'alert' : 'status'} className={`rounded-sm border p-3 text-sm ${notice.error ? 'border-ember/35 bg-ember/10 text-ember' : 'border-amber/35 bg-amber-soft text-ink'}`}>{notice.text}</p> : null}

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{exercises.length} {exercises.length === 1 ? 'Übung' : 'Übungen'} angezeigt</span>
        {query ? <button type="button" className="min-h-9 px-2 font-semibold text-amber" onClick={() => updateSearchParams('q', '')}>Suche löschen</button> : null}
      </div>
      <section className="grid gap-3 lg:grid-cols-2" aria-label="Übungsliste">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="panel flex min-w-0 flex-col overflow-hidden" aria-label={exercise.name}>
            <div className="min-w-0 flex-1 space-y-2 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 break-words font-bold text-ink">{exercise.name}</h2>
                <span className="shrink-0 rounded-sm bg-paper px-2 py-1 text-[11px] tabular-nums text-muted">{exercise.workoutCount} {exercise.workoutCount === 1 ? 'Training' : 'Trainings'}</span>
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted">{exercise.latestSummary ? `Zuletzt: ${exercise.latestSummary}` : 'Noch keine abgeschlossenen Sätze'}</p>
              {exercise.templateNames.length ? <p className="break-words text-xs leading-relaxed text-amber-deep">Vorlagen: {exercise.templateNames.join(' · ')}</p> : null}
              {exercise.hasOpenWorkout ? <p className="text-xs text-muted">In einem offenen Training enthalten</p> : null}
            </div>
            <div className={`grid ${exercise.archivedAt ? 'grid-cols-2' : 'grid-cols-3'} gap-1 border-t border-line p-2`}>
              <Link to={`/exercises/${exercise.id}/chart`} state={{ exerciseOrder, libraryReturnTo }} className="secondary-button px-1 text-xs" aria-label={`Verlauf von ${exercise.name}`}>Verlauf</Link>
              <button type="button" className="secondary-button px-1 text-xs" aria-label={`${exercise.name} umbenennen`} onClick={() => openAction('rename', exercise.id)}>Umbenennen</button>
              {exercise.archivedAt ? (
                <button type="button" className="secondary-button col-span-2 px-1 text-xs text-amber" aria-label={`${exercise.name} wiederherstellen`} onClick={() => restoreExercise(exercise)}>Wiederherstellen</button>
              ) : (
                <button type="button" className="danger-button px-1 text-xs" aria-label={`${exercise.name} entfernen`} onClick={() => openAction('remove', exercise.id)}>Entfernen</button>
              )}
            </div>
          </article>
        ))}
      </section>
      {!exercises.length ? <div className="rounded-sm border border-dashed border-line p-6 text-center text-sm text-muted">{query ? `Keine passende Übung für „${query}“.` : filter.value === 'archive' ? 'Dein Archiv ist leer.' : filter.value === 'unused' ? 'Keine unbenutzten Übungen vorhanden.' : filter.value === 'templates' ? 'Keine Übungen in deinen Vorlagen.' : 'Deine Bibliothek ist leer.'}</div> : null}
      {selectedExercise ? <LibraryExerciseDialog key={`${action.type}-${selectedExercise.id}`} action={action.type} exercise={selectedExercise} impact={getExerciseRemovalImpact(state, selectedExercise.id)} onRename={renameLibraryExercise} onRemove={removeLibraryExercise} onClose={() => setAction(null)} onSuccess={(text) => setNotice({ error: false, text })} /> : null}
    </div>
  );
}
