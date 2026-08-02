import { useEffect, useState } from 'react';
import { parseLocalizedNumber } from '../utils/bodyweight';
import ModalShell from './ModalShell';

const loadTypes = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Das eingetragene Gewicht ist die komplette Trainingslast.',
  },
  {
    value: 'bodyweight',
    label: 'Körpergewicht',
    description: 'Die Last wird aus deinem Körpergewicht und dem Anteil berechnet.',
  },
  {
    value: 'bodyweight-added',
    label: 'Körpergewicht + Zusatz',
    description: 'Körpergewichtsanteil plus zusätzliches oder unterstützendes Gewicht.',
  },
];

export default function ExerciseSettingsModal({ isOpen, exerciseName, settings, onClose, onSave }) {
  const [loadType, setLoadType] = useState(settings?.loadType ?? 'normal');
  const [bodyweightPercent, setBodyweightPercent] = useState(settings?.bodyweightPercent ?? 100);
  const [setupNotes, setSetupNotes] = useState(settings?.setupNotes ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadType(settings?.loadType ?? 'normal');
    setBodyweightPercent(settings?.bodyweightPercent ?? 100);
    setSetupNotes(settings?.setupNotes ?? '');
    setError('');
  }, [isOpen, settings]);

  function handleSubmit(event) {
    event.preventDefault();
    const percent = parseLocalizedNumber(bodyweightPercent);

    if (loadType !== 'normal' && (!Number.isFinite(percent) || percent <= 0 || percent > 300)) {
      setError('Der Körpergewichtsanteil muss zwischen 1 und 300 Prozent liegen.');
      return;
    }

    onSave({
      loadType,
      bodyweightPercent: loadType === 'normal' ? 100 : percent,
      setupNotes: setupNotes.trim(),
    });
    onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="exercise-settings-title" maxWidth="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{exerciseName}</p>
          <h2 id="exercise-settings-title" className="mt-2 font-display text-2xl font-bold text-ink">
            Übung einstellen
          </h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Belastungsart</legend>
          <div className="space-y-2">
            {loadTypes.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-sm border p-3 transition ${
                  loadType === option.value
                    ? 'border-amber bg-amber-soft'
                    : 'border-line bg-surface-raised hover:border-amber/55'
                }`}
              >
                <input
                  type="radio"
                  name="load-type"
                  value={option.value}
                  checked={loadType === option.value}
                  onChange={() => {
                    setLoadType(option.value);
                    setError('');
                  }}
                  className="mt-1 accent-amber"
                />
                <span>
                  <span className="block font-bold text-ink">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {loadType !== 'normal' ? (
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Anteil des Körpergewichts
            </span>
            <div className="relative">
              <input
                className="field pr-12 text-lg font-bold tabular-nums"
                inputMode="decimal"
                value={bodyweightPercent}
                onChange={(event) => {
                  setBodyweightPercent(event.target.value);
                  setError('');
                }}
                placeholder="100"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-bold text-muted">%</span>
            </div>
            <span className="mt-1.5 block text-xs text-muted">Zum Beispiel 67 % bei Übungen mit teilweisem Körpergewicht.</span>
          </label>
        ) : null}

        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
            Maschine / Sitz / Setup
          </span>
          <textarea
            className="field min-h-[96px] resize-y"
            value={setupNotes}
            onChange={(event) => setSetupNotes(event.target.value)}
            placeholder="z. B. Sitz 4 · Lehne 2 · Griff neutral"
          />
          <span className="mt-1.5 block text-xs text-muted">Wird bei dieser Übung in jedem Workout angezeigt.</span>
        </label>

        {error ? (
          <p className="rounded-sm border border-ember/35 bg-ember/10 px-3 py-2 text-sm font-semibold text-ember" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
          <button type="button" onClick={onClose} className="secondary-button flex-1">Abbrechen</button>
          <button type="submit" className="action-button flex-1">Speichern</button>
        </div>
      </form>
    </ModalShell>
  );
}
