import { useLayoutEffect, useState } from 'react';
import ModalShell from './ModalShell';

export default function MoveExerciseModal({ isOpen, exercise, exercises, onClose, onMove }) {
  const currentIndex = exercises.findIndex((entry) => entry.id === exercise?.id);
  const otherExercises = exercises.filter((entry) => entry.id !== exercise?.id);
  const [targetIndex, setTargetIndex] = useState(currentIndex);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    setTargetIndex(currentIndex);
    setError('');
  }, [isOpen, exercise?.id, currentIndex]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="move-exercise-title">
      <div className="flex items-start justify-between gap-4">
        <h2 id="move-exercise-title" className="font-display text-2xl font-bold text-ink">Übung verschieben</h2>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>
      <p className="mt-3 font-bold text-ink">{exercise?.name}</p>
      <p className="mt-1 text-sm text-muted">Alle Sätze bleiben bei dieser Übung.</p>

      <form className="mt-5 space-y-4" onSubmit={(event) => {
        event.preventDefault();
        const moveError = onMove(targetIndex);
        if (moveError) {
          setError(moveError);
          return;
        }
        onClose();
      }}>
        <div>
          <label htmlFor="move-exercise-position" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Neue Position</label>
          <select id="move-exercise-position" className="field" value={targetIndex} data-autofocus onChange={(event) => {
            setTargetIndex(Number(event.target.value));
            setError('');
          }}>
            {exercises.map((entry, index) => (
              <option key={index} value={index}>
                {index + 1} · {index === 0 ? 'An den Anfang' : `Nach ${otherExercises[index - 1]?.name}`}{index === currentIndex ? ' (aktuell)' : ''}
              </option>
            ))}
          </select>
        </div>
        {error ? <p role="alert" className="text-sm text-ember">{error}</p> : null}
        <div className="flex gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="secondary-button flex-1">Abbrechen</button>
          <button type="submit" disabled={targetIndex === currentIndex || currentIndex < 0} className="action-button flex-1">Verschieben</button>
        </div>
      </form>
    </ModalShell>
  );
}
