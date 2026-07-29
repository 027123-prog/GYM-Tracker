import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatDateTime } from '../utils/date';
import MachineSettingsModal from './MachineSettingsModal';
import SetEntryModal from './SetEntryModal';

const compactIconButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-raised text-ink transition hover:border-amber/70 hover:text-amber-deep disabled:cursor-not-allowed disabled:opacity-35 sm:h-9 sm:w-9';

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

function MachineIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M5 6h14M5 12h14M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="11" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function MoveIcon({ direction }) {
  const points = direction === 'left' ? '14 7 9 12 14 17' : '10 7 15 12 10 17';
  const edgeX = direction === 'left' ? 6 : 18;

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d={`M${edgeX} 6v12`} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

export default function ExerciseEditorCard({
  exercise,
  libraryEntry,
  lastWorkoutSummary,
  lastWorkoutCommentText,
  activeExerciseIndex,
  exerciseCount,
  onPrevExercise,
  onNextExercise,
  canMovePrevExercise,
  canMoveNextExercise,
  onRenameExercise,
  onMoveUp,
  onMoveDown,
  onDeleteExercise,
  onSaveSet,
  onDeleteSet,
  onSaveMachineSettings,
}) {
  const location = useLocation();
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState('');
  const [draftName, setDraftName] = useState(exercise.name);
  const bottomAnchorRef = useRef(null);

  const machineSettingsText = useMemo(
    () =>
      (exercise.machineSettings ?? [])
        .filter((item) => item.label || item.value)
        .map((item) => `${item.label}: ${item.value}`)
        .join(' · '),
    [exercise.machineSettings],
  );

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
      seatHeight: latest.seatHeight ?? '',
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="eyebrow">
              Übung {activeExerciseIndex + 1} / {exerciseCount}
            </span>
            {exercise.targetRepScheme ? (
              <span className="rounded-sm border border-amber/35 bg-amber-soft px-2 py-1 text-xs font-bold text-amber-deep">
                Ziel {exercise.targetRepScheme}
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-x-5 gap-y-3 bg-surface-raised px-3 py-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Letztes Workout</p>
              <p className="mt-1 italic text-ink">{lastWorkoutSummary || 'Noch keine abgeschlossene Historie'}</p>
              {lastWorkoutCommentText ? <p className="mt-1 text-xs italic text-muted">{lastWorkoutCommentText}</p> : null}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Maschine</p>
              <p className="mt-1 italic text-ink">{machineSettingsText || 'Keine Einstellung hinterlegt'}</p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full items-center justify-between gap-1"
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
              onClick={onMoveUp}
              disabled={!canMovePrevExercise}
              className={compactIconButtonClass}
              aria-label="Übung nach links verschieben"
              title="Übung nach links verschieben"
            >
              <MoveIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => setMachineModalOpen(true)}
              className={compactIconButtonClass}
              aria-label="Maschineneinstellungen bearbeiten"
              title="Maschineneinstellungen bearbeiten"
            >
              <MachineIcon />
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
              onClick={deleteExercise}
              className={`${compactIconButtonClass} border-ember/35 bg-ember/10 text-ember hover:border-ember hover:text-ember`}
              aria-label="Übung löschen"
              title="Übung löschen"
            >
              <TrashIcon />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveNextExercise}
              className={compactIconButtonClass}
              aria-label="Übung nach rechts verschieben"
              title="Übung nach rechts verschieben"
            >
              <MoveIcon direction="right" />
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Arbeitssätze</p>
              <p className="mt-1 text-xs text-muted">{exercise.sets.length} gespeichert</p>
            </div>
            <div className="flex gap-2">
              {exercise.sets.length ? (
                <button type="button" onClick={repeatLastSet} className="secondary-button">
                  Letzten wiederholen
                </button>
              ) : null}
              <button type="button" onClick={openNewSet} className="action-button">
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
                  <div className="min-w-0 text-xs text-muted">
                    {setItem.comment ? <p className="truncate">{setItem.comment}</p> : <p>Kein Kommentar</p>}
                    <p className="mt-0.5">
                      {setItem.seatHeight ? `Sitzhöhe ${setItem.seatHeight} · ` : ''}
                      {formatDateTime(setItem.savedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
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
        lastWorkoutSummary={lastWorkoutSummary}
        weightOptions={libraryEntry?.weightOptions ?? []}
        onClose={() => setSetModalOpen(false)}
        onSave={saveSet}
      />

      <MachineSettingsModal
        isOpen={machineModalOpen}
        exerciseName={exercise.name}
        initialSettings={exercise.machineSettings}
        onClose={() => setMachineModalOpen(false)}
        onSave={onSaveMachineSettings}
      />
    </>
  );
}
