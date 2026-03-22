import { useEffect, useState } from 'react';
import WeightSuggestionGrid from './WeightSuggestionGrid';

export default function SetEntryModal({ isOpen, initialSet, lastWeight, weightOptions, onClose, onSave }) {
  const [weight, setWeight] = useState(initialSet?.weight ?? '');
  const [reps, setReps] = useState(initialSet?.reps ?? '');
  const [showWeights, setShowWeights] = useState(false);

  useEffect(() => {
    setWeight(initialSet?.weight ?? '');
    setReps(initialSet?.reps ?? '');
    setShowWeights(false);
  }, [initialSet, isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!weight || !reps) {
      return;
    }

    onSave({
      id: initialSet?.id,
      weight: Number(weight),
      reps: Number(reps),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6">
      <div className="panel w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine/70">Satz</p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
              {initialSet ? 'Satz bearbeiten' : 'Satz speichern'}
            </h3>
            <p className="mt-2 text-sm italic text-ink/60">
              Letztes Gewicht: {lastWeight ? `${lastWeight} kg` : 'Noch keine Historie'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button">
            Schließen
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="weight-input" className="mb-2 block text-sm font-semibold text-ink">
              Gewicht
            </label>
            <input
              id="weight-input"
              className="field"
              inputMode="decimal"
              value={weight}
              onFocus={() => setShowWeights(true)}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="z. B. 62.5"
            />
            {showWeights ? <WeightSuggestionGrid options={weightOptions} onSelect={setWeight} /> : null}
          </div>
          <div>
            <label htmlFor="reps-input" className="mb-2 block text-sm font-semibold text-ink">
              Wiederholungen
            </label>
            <input
              id="reps-input"
              className="field"
              inputMode="numeric"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              placeholder="z. B. 8"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className="secondary-button">
              Abbrechen
            </button>
            <button type="submit" className="action-button">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
