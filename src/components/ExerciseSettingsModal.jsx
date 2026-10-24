import { useLayoutEffect, useState } from 'react';
import { parseLocalizedNumber } from '../utils/bodyweight';
import ModalShell from './ModalShell';

const loadTypes = [
  { value: 'none', label: 'Ohne Gewicht' },
  {
    value: 'normal',
    label: 'Gewicht',
  },
  {
    value: 'bodyweight',
    label: 'Körpergewicht',
  },
  {
    value: 'bodyweight-added',
    label: 'Körpergewicht ± Zusatz',
  },
];

export default function ExerciseSettingsModal({ isOpen, exerciseName, settings, onClose, onSave }) {
  const [name, setName] = useState(exerciseName ?? '');
  const [measurementType, setMeasurementType] = useState(settings?.measurementType ?? 'reps');
  const [loadType, setLoadType] = useState(settings?.loadType ?? 'normal');
  const [bodyweightPercent, setBodyweightPercent] = useState(settings?.bodyweightPercent ?? 100);
  const [setupNotes, setSetupNotes] = useState(settings?.setupNotes ?? '');
  const [error, setError] = useState('');
  const usesBodyweight = loadType === 'bodyweight' || loadType === 'bodyweight-added';

  useLayoutEffect(() => {
    setName(exerciseName ?? '');
    setMeasurementType(settings?.measurementType ?? 'reps');
    setLoadType(settings?.loadType ?? 'normal');
    setBodyweightPercent(settings?.bodyweightPercent ?? 100);
    setSetupNotes(settings?.setupNotes ?? '');
    setError('');
  }, [isOpen, exerciseName, settings]);

  function handleSubmit(event) {
    event.preventDefault();
    const percent = parseLocalizedNumber(bodyweightPercent);

    if (!name.trim()) {
      setError('Bitte einen Übungsnamen eingeben.');
      return;
    }

    if (usesBodyweight && (!Number.isFinite(percent) || percent < 1 || percent > 300)) {
      setError('Der Körpergewichtsanteil muss zwischen 1 und 300 Prozent liegen.');
      return;
    }

    const saveError = onSave({
      name: name.trim(),
      measurementType,
      loadType,
      bodyweightPercent: usesBodyweight ? percent : 100,
      setupNotes: setupNotes.trim(),
    });

    if (saveError) {
      setError(saveError);
      return;
    }

    onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="exercise-settings-title" maxWidth="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="exercise-settings-title" className="font-display text-2xl font-bold text-ink">
            Übung bearbeiten
          </h2>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Übungsname</span>
          <input
            className="field"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="Name der Übung"
          />
          <span className="mt-1.5 block text-xs text-muted">Name gilt überall.</span>
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Satzerfassung</legend>
          <div className="grid grid-cols-2 gap-2">
            {[{ value: 'reps', label: 'Wdh.', accessibleLabel: 'Wiederholungen' }, { value: 'duration', label: 'Sekunden' }].map((option) => (
              <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-sm border p-3 text-sm font-bold ${measurementType === option.value ? 'border-amber bg-amber-soft' : 'border-line bg-surface-raised'}`}>
                <input type="radio" name="measurement-type" value={option.value} aria-label={option.accessibleLabel} checked={measurementType === option.value} onChange={() => setMeasurementType(option.value)} className="accent-amber" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

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
                  <span className="block font-bold text-ink">{option.value === 'none'
                    ? (measurementType === 'duration' ? 'Sekunden ohne Gewicht' : 'Nur Wiederholungen')
                    : option.label}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">Gilt für neue Sätze. Verlauf bleibt erhalten.</p>
        </fieldset>

        {usesBodyweight ? (
          <label className="block">
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
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
            Setup
          </span>
          <textarea
            className="field min-h-[96px] resize-y"
            value={setupNotes}
            onChange={(event) => setSetupNotes(event.target.value)}
            placeholder="z. B. Sitz 4 · Lehne 2 · Griff neutral"
          />
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
