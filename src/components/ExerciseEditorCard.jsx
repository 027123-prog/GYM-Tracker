import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../utils/date';
import MachineSettingsModal from './MachineSettingsModal';
import SetEntryModal from './SetEntryModal';

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
  onToggleSkipped,
}) {
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
      <article className={`panel overflow-hidden ${exercise.skipped ? 'border-ember/35' : ''}`}>
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevExercise}
              disabled={!canMovePrevExercise}
              className="icon-button"
              aria-label="Vorherige Übung"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
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
            <button
              type="button"
              onClick={onNextExercise}
              disabled={!canMoveNextExercise}
              className="icon-button"
              aria-label="Nächste Übung"
            >
              →
            </button>
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
            {exercise.skipped ? (
              <span className="rounded-sm border border-ember/40 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
                Ausgelassen
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded-sm border border-line bg-paper/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Letztes Workout</p>
              <p className="mt-1 font-semibold text-ink">{lastWorkoutSummary || 'Noch keine abgeschlossene Historie'}</p>
              {lastWorkoutCommentText ? <p className="mt-1 text-xs text-muted">{lastWorkoutCommentText}</p> : null}
            </div>
            <div className="rounded-sm border border-line bg-paper/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Maschine</p>
              <p className="mt-1 font-semibold text-ink">{machineSettingsText || 'Keine Einstellung hinterlegt'}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMachineModalOpen(true)} className="secondary-button">
              Maschine
            </button>
            <Link to={`/exercises/${exercise.exerciseId}/chart`} className="secondary-button">
              Verlauf
            </Link>
            <button type="button" onClick={onMoveUp} disabled={!canMovePrevExercise} className="secondary-button">
              ← Position
            </button>
            <button type="button" onClick={onMoveDown} disabled={!canMoveNextExercise} className="secondary-button">
              Position →
            </button>
            <button type="button" onClick={onToggleSkipped} className="secondary-button">
              {exercise.skipped ? 'Aktivieren' : 'Auslassen'}
            </button>
            <button type="button" onClick={deleteExercise} className="danger-button sm:ml-auto">
              Entfernen
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
              <button type="button" onClick={openNewSet} className="action-button" disabled={exercise.skipped}>
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
                      className="danger-button"
                      aria-label={`Satz ${index + 1} löschen`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-line px-4 py-7 text-center text-sm text-muted">
              {exercise.skipped ? 'Übung ist ausgelassen.' : 'Noch keine Sätze. Starte mit Gewicht und Wiederholungen.'}
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
