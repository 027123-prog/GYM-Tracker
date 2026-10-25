import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import LibraryExerciseDialog from '../components/LibraryExerciseDialog';
import ModalShell from '../components/ModalShell';
import ExerciseChartPreview from '../components/ExerciseChartPreview';
import LibraryIcon, { compactIconButtonClass as iconButtonClass } from '../components/InterfaceIcon';
import { getExerciseRemovalImpact, referencesExercise } from '../utils/exerciseEditing';
import { exerciseSortOptions as sortOptions, normalizeExerciseSortMode, sortExerciseCards } from '../utils/exerciseSort';
import { buildExerciseChartData, getExerciseWorkoutCount, getLastExerciseSnapshot } from '../utils/workout';
import { formatSetSummary } from '../utils/setMeasurements';

function normalizeSearch(value) {
  return value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export default function ExerciseLibraryPage() {
  const { state, renameLibraryExercise, removeLibraryExercise, restoreLibraryExercise } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showSort, setShowSort] = useState(false);
  const query = searchParams.get('q') ?? '';
  const sortMode = normalizeExerciseSortMode(searchParams.get('sort'));
  const previewMode = searchParams.get('layout') === 'preview';
  const archiveOpen = searchParams.get('archive') === '1' || searchParams.get('view') === 'archive';

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
      hasOpenWorkout: references.some(({ isOpen }) => isOpen),
      workoutCount: getExerciseWorkoutCount(state.workouts, exercise.id, exercise.name),
      lastTrainedAt: latestSnapshot?.workoutDate ?? null,
      latestSummary: latestSnapshot?.sets.map(formatSetSummary).join(' · ') ?? '',
    };
    });
  }, [state.exercises, state.templates, state.workouts]);

  const matchingExercises = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return sortExerciseCards(exerciseCards.filter((exercise) => !normalizedQuery
      || normalizeSearch([exercise.name, ...exercise.templateNames].join(' ')).includes(normalizedQuery)), sortMode);
  }, [exerciseCards, query, sortMode]);
  const exercises = useMemo(() => matchingExercises.filter((exercise) => !exercise.archivedAt), [matchingExercises]);
  const archivedExercises = matchingExercises.filter((exercise) => exercise.archivedAt);

  const chartPreviews = useMemo(() => previewMode
    ? new Map(exercises.map((exercise) => [exercise.id, buildExerciseChartData(state.workouts, exercise.id, exercise.name)]))
    : null, [previewMode, exercises, state.workouts]);

  const currentParams = new URLSearchParams(searchParams);
  currentParams.delete('view');
  if (archiveOpen) currentParams.set('archive', '1');
  const currentSearch = currentParams.toString();
  const libraryReturnTo = currentSearch ? `/exercises?${currentSearch}` : '/exercises';
  const exerciseOrder = exercises.map((exercise) => exercise.id);
  const archiveOrder = archivedExercises.map((exercise) => exercise.id);
  const selectedExercise = action ? exerciseCards.find((exercise) => exercise.id === action.exerciseId) : null;

  function updateSearchParams(key, value, defaultValue = '') {
    const nextParams = new URLSearchParams(currentParams);
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
      <section className="space-y-2 border-b border-line pb-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <span />
          <h1 className="font-display text-[22px] font-bold leading-7 text-ink">Übungen</h1>
          <div className="flex justify-self-end">
            <button type="button" className={`${iconButtonClass} ${sortMode !== 'count-desc' ? 'bg-amber-soft text-amber' : ''}`} aria-label="Übungen sortieren" title="Sortierung" aria-haspopup="dialog" aria-expanded={showSort} onClick={() => setShowSort(true)}>
              <LibraryIcon name="sort" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Übungen durchsuchen</span>
            <input type="search" className="field h-10 py-2" value={query} onChange={(event) => updateSearchParams('q', event.target.value)} placeholder="Suchen …" />
          </label>
          <div className="flex shrink-0" role="group" aria-label="Darstellung">
            <button type="button" className={`${iconButtonClass} ${!previewMode ? 'bg-amber-soft text-amber' : ''}`} aria-label="Listenansicht" aria-pressed={!previewMode} onClick={() => updateSearchParams('layout', '')}><LibraryIcon name="list" /></button>
            <button type="button" className={`${iconButtonClass} ${previewMode ? 'bg-amber-soft text-amber' : ''}`} aria-label="Diagrammvorschau" aria-pressed={previewMode} onClick={() => updateSearchParams('layout', 'preview')}><LibraryIcon name="preview" /></button>
          </div>
        </div>
      </section>

      {notice ? <p role={notice.error ? 'alert' : 'status'} className={`rounded-sm border p-3 text-sm ${notice.error ? 'border-ember/35 bg-ember/10 text-ember' : 'border-amber/35 bg-amber-soft text-ink'}`}>{notice.text}</p> : null}

      {query ? <div className="flex items-center justify-between text-xs text-muted">
        <span>{exercises.length} Treffer</span>
        <button type="button" className="min-h-9 px-2 font-semibold text-amber" onClick={() => updateSearchParams('q', '')}>Suche löschen</button>
      </div> : null}
      <section className={previewMode ? 'grid gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'divide-y divide-line'} aria-label="Übungsliste">
        {exercises.map((exercise) => (
          <article key={exercise.id} className={`min-w-0 ${previewMode ? 'panel flex flex-col overflow-hidden p-2.5' : 'py-2'}`} aria-label={exercise.name}>
            <div className={`flex min-w-0 items-start gap-1 ${previewMode ? 'flex-wrap' : ''}`}>
              <div className="flex min-w-0 flex-1 items-start">
                <h2 className={`min-w-0 flex-1 break-words pt-2 font-bold leading-5 text-ink ${previewMode ? 'line-clamp-2 text-sm' : 'text-base'}`} title={exercise.name}>{exercise.name}</h2>
                <button type="button" className={iconButtonClass} aria-label={`${exercise.name} umbenennen`} title="Umbenennen" onClick={() => openAction('rename', exercise.id)}><LibraryIcon name="pencil" /></button>
              </div>
              {!previewMode ? <div className="flex shrink-0">
                <Link to={`/exercises/${exercise.id}/chart`} state={{ exerciseOrder, libraryReturnTo }} className={iconButtonClass} aria-label={`Verlauf von ${exercise.name}`} title="Verlauf"><LibraryIcon name="chart" /></Link>
                <button type="button" className={`${iconButtonClass} ${exercise.archivedAt ? 'text-amber' : 'hover:text-ember'}`} aria-label={`${exercise.name} ${exercise.archivedAt ? 'wiederherstellen' : 'entfernen'}`} title={exercise.archivedAt ? 'Wiederherstellen' : 'Entfernen'} onClick={() => exercise.archivedAt ? restoreExercise(exercise) : openAction('remove', exercise.id)}><LibraryIcon name={exercise.archivedAt ? 'restore' : 'trash'} /></button>
              </div> : null}
            </div>
            {previewMode ? <Link to={`/exercises/${exercise.id}/chart`} state={{ exerciseOrder, libraryReturnTo }} className="mt-auto block py-2" aria-label={`Diagrammvorschau von ${exercise.name}`}>
              <ExerciseChartPreview data={chartPreviews.get(exercise.id)} settings={exercise.settings} />
            </Link> : exercise.latestSummary ? <p className="truncate text-xs leading-5 text-muted" title={exercise.latestSummary}>{exercise.latestSummary}</p> : null}
            <div className={`flex items-center justify-between gap-1 ${previewMode ? 'border-t border-line pt-1' : 'mt-0.5'}`}>
              <span className="min-w-0 text-[10px] text-muted">{exercise.workoutCount} {exercise.workoutCount === 1 ? 'Training' : 'Trainings'}{exercise.hasOpenWorkout ? ' · offen' : ''}</span>
              {previewMode ? <div className="flex shrink-0">
                <Link to={`/exercises/${exercise.id}/chart`} state={{ exerciseOrder, libraryReturnTo }} className={iconButtonClass} aria-label={`Verlauf von ${exercise.name}`} title="Verlauf"><LibraryIcon name="chart" /></Link>
                <button type="button" className={`${iconButtonClass} ${exercise.archivedAt ? 'text-amber' : 'hover:text-ember'}`} aria-label={`${exercise.name} ${exercise.archivedAt ? 'wiederherstellen' : 'entfernen'}`} title={exercise.archivedAt ? 'Wiederherstellen' : 'Entfernen'} onClick={() => exercise.archivedAt ? restoreExercise(exercise) : openAction('remove', exercise.id)}><LibraryIcon name={exercise.archivedAt ? 'restore' : 'trash'} /></button>
              </div> : null}
            </div>
          </article>
        ))}
      </section>
      {!exercises.length ? <div className="rounded-sm border border-dashed border-line p-6 text-center text-sm text-muted">{query ? `Keine aktive Übung für „${query}“.` : 'Deine Bibliothek ist leer.'}</div> : null}
      {archivedExercises.length ? <section className="border-t border-line pt-1">
        <button type="button" className="flex min-h-11 w-full items-center justify-between text-xs text-muted" aria-expanded={archiveOpen} aria-controls="exercise-archive" onClick={() => updateSearchParams('archive', archiveOpen ? '' : '1')}>
          <span>Archiv ({archivedExercises.length})</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${archiveOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {archiveOpen ? <div id="exercise-archive" className="divide-y divide-line">
          {archivedExercises.map((exercise) => <article key={exercise.id} className="flex min-w-0 items-center gap-1 py-2" aria-label={exercise.name}>
            <h2 className="min-w-0 flex-1 break-words text-sm font-bold text-muted">{exercise.name}</h2>
            <button type="button" className={iconButtonClass} aria-label={`${exercise.name} umbenennen`} title="Umbenennen" onClick={() => openAction('rename', exercise.id)}><LibraryIcon name="pencil" /></button>
            <Link to={`/exercises/${exercise.id}/chart`} state={{ exerciseOrder: archiveOrder, libraryReturnTo }} className={iconButtonClass} aria-label={`Verlauf von ${exercise.name}`} title="Verlauf"><LibraryIcon name="chart" /></Link>
            <button type="button" className={`${iconButtonClass} text-amber`} aria-label={`${exercise.name} wiederherstellen`} title="Wiederherstellen" onClick={() => restoreExercise(exercise)}><LibraryIcon name="restore" /></button>
          </article>)}
        </div> : null}
      </section> : null}
      <ModalShell isOpen={showSort} onClose={() => setShowSort(false)} labelledBy="library-sort-title" maxWidth="max-w-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="library-sort-title" className="text-lg font-bold text-ink">Sortierung</h2>
          <button type="button" className="icon-button" aria-label="Einstellung schließen" onClick={() => setShowSort(false)}>×</button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="sr-only">Sortierung</span>
            <select className="field" aria-label="Übungen sortieren" value={sortMode} onChange={(event) => updateSearchParams('sort', event.target.value, 'count-desc')}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="action-button w-full" onClick={() => setShowSort(false)}>Fertig</button>
        </div>
      </ModalShell>
      {selectedExercise ? <LibraryExerciseDialog key={`${action.type}-${selectedExercise.id}`} action={action.type} exercise={selectedExercise} impact={getExerciseRemovalImpact(state, selectedExercise.id)} onRename={renameLibraryExercise} onRemove={removeLibraryExercise} onClose={() => setAction(null)} onSuccess={(text) => setNotice({ error: false, text })} /> : null}
    </div>
  );
}
