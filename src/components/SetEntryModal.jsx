import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = [5, 6, 8, 10, 12, 15];

function parseLocalizedNumber(value) {
  return Number(String(value).trim().replace(',', '.'));
}

export default function SetEntryModal({
  isOpen,
  initialSet,
  exerciseName,
  lastWorkoutSummary,
  weightOptions,
  onClose,
  onSave,
}) {
  const [weight, setWeight] = useState(initialSet?.weight ?? '');
  const [reps, setReps] = useState(initialSet?.reps ?? '');
  const [comment, setComment] = useState(initialSet?.comment ?? '');
  const [seatHeight, setSeatHeight] = useState(initialSet?.seatHeight ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setWeight(initialSet?.weight ?? '');
    setReps(initialSet?.reps ?? '');
    setComment(initialSet?.comment ?? '');
    setSeatHeight(initialSet?.seatHeight ?? '');
    setError('');
  }, [initialSet, isOpen]);

  function handleSubmit(event) {
    event.preventDefault();
    const parsedWeight = parseLocalizedNumber(weight);
    const parsedReps = parseLocalizedNumber(reps);

    if (String(weight).trim() === '' || !Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 2000) {
      setError('Gewicht muss eine Zahl zwischen 0 und 2.000 kg sein.');
      return;
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setError('Wiederholungen müssen eine ganze Zahl zwischen 1 und 1.000 sein.');
      return;
    }

    onSave({
      id: initialSet?.id,
      weight: parsedWeight,
      reps: parsedReps,
      comment,
      seatHeight,
    });
    onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="set-entry-title" maxWidth="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{exerciseName || 'Übung'}</p>
          <h2 id="set-entry-title" className="mt-2 font-display text-2xl font-bold text-ink">
            {initialSet ? 'Satz ändern' : 'Satz erfassen'}
          </h2>
          <p className="mt-1 text-sm text-muted">{lastWorkoutSummary || 'Noch keine abgeschlossene Historie'}</p>
        </div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Gewicht kg</span>
            <input
              className="field text-lg font-bold tabular-nums"
              inputMode="decimal"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                setError('');
              }}
              placeholder="62,5"
              autoFocus
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Wiederholungen</span>
            <input
              className="field text-lg font-bold tabular-nums"
              inputMode="numeric"
              value={reps}
              onChange={(event) => {
                setReps(event.target.value);
                setError('');
              }}
              placeholder="8"
            />
          </label>
        </div>

        <WeightSuggestionGrid options={weightOptions} onSelect={setWeight} />

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Schnellauswahl Reps</p>
          <div className="grid grid-cols-6 gap-1.5">
            {repPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReps(preset)}
                className={`min-h-11 rounded-sm border text-sm font-bold transition ${
                  Number(reps) === preset
                    ? 'border-amber bg-amber-soft text-amber-deep'
                    : 'border-line bg-paper text-muted hover:border-amber/55 hover:text-ink'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Kommentar</span>
          <textarea
            className="field min-h-[88px] resize-y"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Form, Tempo, Gefühl …"
          />
        </label>

        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Sitzhöhe / Setup</span>
          <input
            className="field"
            value={seatHeight}
            onChange={(event) => setSeatHeight(event.target.value)}
            placeholder="z. B. Stufe 6"
          />
        </label>

        {error ? (
          <p className="rounded-sm border border-ember/35 bg-ember/10 px-3 py-2 text-sm font-semibold text-ember" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pb-1 pt-4 sm:-mx-6 sm:px-6">
          <button type="button" onClick={onClose} className="secondary-button flex-1">
            Abbrechen
          </button>
          <button type="submit" className="action-button flex-1">
            Speichern
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
