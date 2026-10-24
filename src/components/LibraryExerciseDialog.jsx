import { useState } from 'react';
import ModalShell from './ModalShell';

export default function LibraryExerciseDialog({ action, exercise, impact, onRename, onRemove, onClose, onSuccess }) {
  const [name, setName] = useState(exercise.name);
  const [error, setError] = useState('');
  const renaming = action === 'rename';

  function handleSubmit(event) {
    event.preventDefault();
    if (renaming) {
      const saveError = onRename(exercise.id, name);
      if (saveError) {
        setError(saveError);
        return;
      }
      onSuccess(`„${name.trim()}“ wurde umbenannt.`);
    } else {
      const result = onRemove(exercise.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess(result.archived
        ? `„${exercise.name}“ liegt jetzt im Archiv.`
        : `„${exercise.name}“ wurde gelöscht.`);
    }
    onClose();
  }

  return (
    <ModalShell isOpen onClose={onClose} labelledBy="library-exercise-dialog-title" maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Bibliothek</p>
          <h2 id="library-exercise-dialog-title" className="mt-2 font-display text-2xl font-bold text-ink">
            {renaming ? 'Übung umbenennen' : 'Übung entfernen?'}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {renaming ? (
          <>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Übungsname</span>
              <input
                className="field"
                value={name}
                onChange={(event) => { setName(event.target.value); setError(''); }}
                data-autofocus
                autoComplete="off"
              />
            </label>
            <p className="text-sm text-muted">Der Name wird in der Bibliothek, in Vorlagen und im Trainingsverlauf aktualisiert. Sätze und Einstellungen bleiben erhalten.</p>
          </>
        ) : (
          <>
            <p className="break-words font-bold text-ink">{exercise.name}</p>
            <p className="text-sm leading-relaxed text-muted">
              {impact.archive
                ? 'Die Übung wird ins Archiv verschoben und aus der Übungsauswahl entfernt. Gespeicherte Trainings, Sätze und Einstellungen bleiben erhalten.'
                : 'Diese Übung hat keinen Trainingsverlauf. Sie wird mit ihren Einstellungen endgültig aus der Bibliothek gelöscht.'}
            </p>
            {impact.templateCount > 0 ? (
              <div className="rounded-sm border border-amber/35 bg-amber-soft p-3 text-sm text-ink">
                <p className="font-bold">Wird aus {impact.templateCount} {impact.templateCount === 1 ? 'Vorlage' : 'Vorlagen'} entfernt:</p>
                <p className="mt-1 break-words">{exercise.templateNames.join(' · ')}</p>
              </div>
            ) : null}
          </>
        )}
        {error ? <p role="alert" className="rounded-sm border border-ember/35 bg-ember/10 p-3 text-sm text-ember">{error}</p> : null}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="secondary-button flex-1">Abbrechen</button>
          <button type="submit" className={`${renaming ? 'action-button' : 'danger-button'} flex-1`}>
            {renaming ? 'Namen speichern' : impact.archive ? 'Ins Archiv verschieben' : 'Endgültig löschen'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
