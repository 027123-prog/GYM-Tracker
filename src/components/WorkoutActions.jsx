import { useEffect, useRef, useState } from 'react';
import { useAppData } from './AppProvider';
import ModalShell from './ModalShell';

export default function WorkoutActions({ workout }) {
  const { saveWorkoutAsTemplate, deleteWorkout } = useAppData();
  const [panel, setPanel] = useState(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [error, setError] = useState(null);
  const cancelRef = useRef(null);
  const titleId = `workout-actions-title-${workout.id}`;

  useEffect(() => {
    if (panel === 'delete') cancelRef.current?.focus();
  }, [panel]);

  function saveTemplate() {
    if (templateSaved) return;
    if (saveWorkoutAsTemplate(workout.id)) {
      setTemplateSaved(true);
      setError(null);
    } else {
      setError('Keine aktiven Übungen zum Speichern.');
    }
  }

  return (
    <>
      <button
        type="button"
        className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
        aria-label={`Aktionen für ${workout.name}`}
        title="Workout verwalten"
        aria-haspopup="dialog"
        aria-expanded={Boolean(panel)}
        onClick={() => setPanel('actions')}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      <ModalShell isOpen={Boolean(panel)} onClose={() => setPanel(null)} labelledBy={titleId} maxWidth="max-w-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-bold text-ink">
            {panel === 'delete' ? 'Workout löschen?' : workout.name}
          </h2>
          <button type="button" className="icon-button shrink-0" aria-label="Schließen" onClick={() => setPanel(null)}>×</button>
        </div>
        {panel === 'delete' ? (
          <>
            <p className="break-words text-sm text-muted">„{workout.name}“ und alle Sätze dieser Einheit werden gelöscht.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button ref={cancelRef} type="button" className="secondary-button" data-autofocus onClick={() => setPanel(null)}>Abbrechen</button>
              <button type="button" className="danger-button" onClick={() => deleteWorkout(workout.id)}>Löschen</button>
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <button type="button" className="secondary-button w-full" onClick={saveTemplate} disabled={templateSaved}>
              {templateSaved ? 'Gespeichert' : 'Als Vorlage speichern'}
            </button>
            {error ? <p role="alert" className="text-sm text-ember">{error}</p> : null}
            <button type="button" className="danger-button w-full" onClick={() => setPanel('delete')}>Workout löschen</button>
          </div>
        )}
      </ModalShell>
    </>
  );
}
