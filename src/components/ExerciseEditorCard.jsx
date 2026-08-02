import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ExerciseSettingsModal from './ExerciseSettingsModal';
import SetEntryModal from './SetEntryModal';

const compactIconButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-raised text-ink transition hover:border-amber/70 hover:text-amber-deep disabled:cursor-not-allowed disabled:opacity-35 min-[380px]:h-11 min-[380px]:w-11';

function formatBodyweightFormula(setItem) {
  if (setItem.weightMode !== 'bodyweight' || !setItem.bodyWeight || !setItem.bodyweightFactor) {
    return '';
  }

  const format = (value) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
  const percent = format(setItem.bodyweightFactor * 100);
  const addedWeight = Number(setItem.addedWeight) || 0;
  const addedLabel = addedWeight
    ? ` ${addedWeight > 0 ? '+' : '−'} ${format(Math.abs(addedWeight))} kg`
    : '';

  return `Körpergewicht ${format(setItem.bodyWeight)} kg × ${percent} %${addedLabel}`;
}

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

function PlusIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12l2-1.2-2-3.5-2.2.7a7.5 7.5 0 0 0-1.3-.8L15 5h-4l-.5 2.2a7.5 7.5 0 0 0-1.3.8L7 7.3l-2 3.5L7 12c0 .5 0 .9.1 1.3L5 14.5 7 18l2.2-.7c.4.3.8.6 1.3.8L11 20h4l.5-1.9c.5-.2.9-.5 1.3-.8l2.2.7 2-3.5-2.1-1.2c.1-.4.1-.8.1-1.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ExerciseEditorCard({
  exercise,
  compact = false,
  libraryEntry,
  lastWorkoutSummary,
  lastWorkoutCommentText,
  onPrevExercise,
  onNextExercise,
  onInsertExercise,
  canMovePrevExercise,
  canMoveNextExercise,
  onRenameExercise,
  onUpdateExerciseSettings,
  onDeleteExercise,
  onSaveSet,
  onDeleteSet,
}) {
  const location = useLocation();
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState('');
  const [draftName, setDraftName] = useState(exercise.name);
  const bottomAnchorRef = useRef(null);

  const legacyMachineSettingsText = useMemo(
    () => (exercise.machineSettings ?? [])
        .map((item) => ({
          label: item.label?.trim() ?? '',
          value: item.value?.trim() ?? '',
        }))
        .filter((item) => item.label || item.value)
        .map((item) => (item.label && item.value ? `${item.label}: ${item.value}` : item.label || item.value))
        .join(' · '),
    [exercise.machineSettings],
  );
  const machineSettingsText = libraryEntry?.settings?.setupNotes || legacyMachineSettingsText;

  useEffect(() => {
    setDraftName(exercise.name);
  }, [exercise.name]);

  function openNewSet() {
    setEditingSet(null);
    setSetModalOpen(true);
  }

  function editSet(setItem) {
    setEditingSet(setItem);
    setSetModalOpen(true);
  }

  function saveSet(payload) {
    const savedSetId = onSaveSet(payload);
    setRecentlySaved(savedSetId ?? payload.id ?? 'new');
    window.setTimeout(() => setRecentlySaved(''), 900);

    if (!payload.id) {
      window.requestAnimationFrame(() => bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  }

  function repeatLastSet() {
    const latest = exercise.sets[exercise.sets.length - 1];

    if (!latest) {
      return;
    }

    saveSet({
      weight: latest.weight,
      reps: latest.reps,
      comment: '',
      weightMode: latest.weightMode,
      bodyWeight: latest.bodyWeight,
      bodyweightFactor: latest.bodyweightFactor,
      addedWeight: latest.addedWeight,
    });
  }

  function deleteExercise() {
    if (window.confirm(`Übung „${exercise.name}“ wirklich aus diesem Workout entfernen?`)) {
      onDeleteExercise();
    }
  }

  return (
    <>
      <article className="panel overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          {!compact ? (
            <div className="min-w-0">
              <label htmlFor={`exercise-name-${exercise.id}`} className="sr-only">
                Übungsname
              </label>
              <input
                id={`exercise-name-${exercise.id}`}
                className="field text-center font-display text-lg font-bold sm:text-2xl"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => {
                  if (draftName.trim() && draftName !== exercise.name) {
                    onRenameExercise(draftName);
                  } else {
                    setDraftName(exercise.name);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          ) : null}

          <div
            className={`${compact ? '' : 'mt-3'} grid gap-x-5 gap-y-3 bg-surface-raised px-3 py-3 text-sm ${
              machineSettingsText ? 'md:grid-cols-2' : ''
            }`}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Letztes Workout</p>
              <p className="mt-1 italic text-ink">{lastWorkoutSummary || 'Noch keine abgeschlossene Historie'}</p>
              {lastWorkoutCommentText ? <p className="mt-1 text-xs italic text-muted">{lastWorkoutCommentText}</p> : null}
            </div>
            {machineSettingsText ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Setup</p>
                <p className="mt-1 italic text-ink">{machineSettingsText}</p>
              </div>
            ) : null}
          </div>

          <div
            className="mt-3 flex w-full items-center justify-between gap-0.5 min-[380px]:gap-1"
            role="toolbar"
            aria-label="Übungsaktionen"
          >
            <button
              type="button"
              onClick={onPrevExercise}
              disabled={!canMovePrevExercise}
              className={compactIconButtonClass}
              aria-label="Vorherige Übung"
              title="Vorherige Übung"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onInsertExercise}
              className={compactIconButtonClass}
              aria-label="Übung einfügen"
              title="Übung einfügen"
            >
              <PlusIcon />
            </button>
            <Link
              to={`/exercises/${exercise.exerciseId}/chart`}
              state={{ returnTo: `${location.pathname}${location.search}` }}
              className={compactIconButtonClass}
              aria-label="Übungsverlauf als Diagramm öffnen"
              title="Übungsverlauf öffnen"
            >
              <ChartIcon />
            </Link>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className={compactIconButtonClass}
              aria-label="Übung einstellen"
              title="Übung einstellen"
            >
              <SettingsIcon />
            </button>
            <button
              type="button"
              onClick={deleteExercise}
              className={`${compactIconButtonClass} border-ember/35 bg-ember/10 text-ember hover:border-ember hover:text-ember`}
              aria-label="Übung löschen"
              title="Übung löschen"
            >
              <TrashIcon />
            </button>
            <button
              type="button"
              onClick={onNextExercise}
              disabled={!canMoveNextExercise}
              className={compactIconButtonClass}
              aria-label="Nächste Übung"
              title="Nächste Übung"
            >
              →
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
            <div>
              <p className="eyebrow">Arbeitssätze</p>
              <p className="mt-1 text-xs text-muted">{exercise.sets.length} gespeichert</p>
            </div>
            <div className="grid grid-cols-2 gap-2 min-[380px]:flex">
              {exercise.sets.length ? (
                <button type="button" onClick={repeatLastSet} className="secondary-button w-full min-[380px]:w-auto">
                  Letzten wiederholen
                </button>
              ) : null}
              <button
                type="button"
                onClick={openNewSet}
                className={`action-button w-full min-[380px]:w-auto ${exercise.sets.length ? '' : 'col-span-2'}`}
              >
                + Satz
              </button>
            </div>
          </div>

          {exercise.sets.length ? (
            <div className="divide-y divide-line border-y border-line">
              {exercise.sets.map((setItem, index) => (
                <div
                  key={setItem.id}
                  className={`grid gap-3 px-2 py-3 transition sm:grid-cols-[70px_150px_minmax(0,1fr)_auto] sm:items-center ${
                    recentlySaved === setItem.id ? 'bg-amber-soft' : 'hover:bg-surface-raised'
                  }`}
                >
                  <span className="eyebrow">Satz {String(index + 1).padStart(2, '0')}</span>
                  <p className="font-display text-lg font-bold tabular-nums text-ink">
                    {setItem.weight} kg <span className="text-amber">×</span> {setItem.reps}
                  </p>
                  {setItem.comment || formatBodyweightFormula(setItem) ? (
                    <div className="min-w-0 text-xs italic text-muted">
                      {setItem.comment ? <p className="truncate">{setItem.comment}</p> : null}
                      {formatBodyweightFormula(setItem) ? <p>{formatBodyweightFormula(setItem)}</p> : null}
                    </div>
                  ) : null}
                  <div className="flex gap-2 sm:col-start-4">
                    <button type="button" onClick={() => editSet(setItem)} className="secondary-button">
                      Ändern
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Satz ${index + 1} wirklich löschen?`)) {
                          onDeleteSet(setItem.id);
                        }
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ember/35 bg-ember/10 text-ember transition hover:border-ember hover:bg-ember/15"
                      aria-label={`Satz ${index + 1} löschen`}
                      title={`Satz ${index + 1} löschen`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-line px-4 py-7 text-center text-sm text-muted">
              Noch keine Sätze. Starte mit Gewicht und Wiederholungen.
            </div>
          )}
          <div ref={bottomAnchorRef} />
        </div>
      </article>

      <SetEntryModal
        isOpen={setModalOpen}
        initialSet={editingSet}
        exerciseName={exercise.name}
        exerciseSettings={libraryEntry?.settings}
        lastWorkoutSummary={lastWorkoutSummary}
        weightOptions={libraryEntry?.weightOptions ?? []}
        onClose={() => setSetModalOpen(false)}
        onSave={saveSet}
      />
      <ExerciseSettingsModal
        isOpen={settingsModalOpen}
        exerciseName={exercise.name}
        settings={libraryEntry?.settings}
        onClose={() => setSettingsModalOpen(false)}
        onSave={onUpdateExerciseSettings}
      />
    </>
  );
}
