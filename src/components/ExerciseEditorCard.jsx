import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SetEntryModal from './SetEntryModal';
import { formatDateTime } from '../utils/date';

export default function ExerciseEditorCard({
  exercise,
  libraryEntry,
  lastWeight,
  onRenameExercise,
  onMoveUp,
  onMoveDown,
  onToggleSkipped,
  onDeleteExercise,
  onSaveSet,
  onDeleteSet,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState('');
  const [draftName, setDraftName] = useState(exercise.name);

  useEffect(() => {
    setDraftName(exercise.name);
  }, [exercise.name]);

  function handleOpenNewSet() {
    setEditingSet(null);
    setModalOpen(true);
  }

  function handleEditSet(setItem) {
    setEditingSet(setItem);
    setModalOpen(true);
  }

  function handleSaveSet(payload) {
    const savedSetId = onSaveSet(payload);
    setRecentlySaved(savedSetId ?? payload.id ?? 'new');
    window.setTimeout(() => setRecentlySaved(''), 1200);
  }

  return (
    <>
      <article className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="field max-w-xs bg-paper/80 text-lg font-semibold"
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
                placeholder="Übungsname"
              />
              <button
                type="button"
                onClick={onToggleSkipped}
                className={exercise.skipped ? 'action-button' : 'secondary-button'}
              >
                {exercise.skipped ? 'Besetzt markiert' : 'Besetzt'}
              </button>
            </div>
            <p className="mt-2 text-sm italic text-ink/60">
              Letztes Gewicht: {lastWeight ? `${lastWeight} kg` : 'Noch kein geloggter Satz'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/exercises/${exercise.exerciseId}/chart`} className="secondary-button">
              Diagramm
            </Link>
            <button type="button" onClick={onMoveUp} className="secondary-button">
              Hoch
            </button>
            <button type="button" onClick={onMoveDown} className="secondary-button">
              Runter
            </button>
            <button type="button" onClick={onDeleteExercise} className="secondary-button">
              Entfernen
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {exercise.sets.length ? (
            exercise.sets.map((setItem, index) => (
              <div
                key={setItem.id}
                className={`rounded-3xl border border-ink/10 bg-paper/80 p-4 transition ${
                  recentlySaved && recentlySaved === setItem.id ? 'animate-flash border-pine/30 bg-mist' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Satz {index + 1}</p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {setItem.weight} kg x {setItem.reps}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">Gespeichert: {formatDateTime(setItem.savedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleEditSet(setItem)} className="secondary-button">
                      Bearbeiten
                    </button>
                    <button type="button" onClick={() => onDeleteSet(setItem.id)} className="secondary-button">
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-ink/15 px-4 py-5 text-sm text-ink/65">
              Noch keine Sätze gespeichert.
            </div>
          )}
        </div>

        <div className="mt-5">
          <button type="button" onClick={handleOpenNewSet} className="action-button">
            Satz hinzufügen
          </button>
        </div>
      </article>

      <SetEntryModal
        isOpen={modalOpen}
        initialSet={editingSet}
        lastWeight={lastWeight}
        weightOptions={[...new Set([lastWeight, ...(libraryEntry?.weightOptions ?? [])].filter(Boolean))]}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveSet}
      />
    </>
  );
}
