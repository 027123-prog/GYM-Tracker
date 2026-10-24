import { useEffect, useState } from 'react';
import { calculateBodyweightLoad, parseLocalizedNumber } from '../utils/bodyweight';
import { isDurationSet, parseWeightInput, prepareSetValues } from '../utils/setMeasurements';
import ModalShell from './ModalShell';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = [5, 6, 8, 10, 12, 15];
const durationPresets = [15, 20, 30, 40, 45, 60];
const BODY_WEIGHT_KEY = 'hardgainwaf-body-weight-kg';

function readBodyWeight() {
  try {
    return window.localStorage.getItem(BODY_WEIGHT_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberBodyWeight(value) {
  try {
    window.localStorage.setItem(BODY_WEIGHT_KEY, String(value));
  } catch {
    // Die Satzerfassung bleibt auch ohne verfügbaren Browserspeicher funktionsfähig.
  }
}

export default function SetEntryModal({
  isOpen,
  initialSet,
  exerciseName,
  exerciseSettings,
  lastWorkoutSummary,
  weightOptions,
  onClose,
  onSave,
}) {
  const configuredLoadType = exerciseSettings?.loadType ?? 'normal';
  const loadType = initialSet
    ? initialSet.weightMode === 'bodyweight'
      ? (Number(initialSet.addedWeight) || configuredLoadType === 'bodyweight-added' ? 'bodyweight-added' : 'bodyweight')
      : 'normal'
    : configuredLoadType;
  const bodyweightPercent = initialSet?.weightMode === 'bodyweight'
    ? Number(initialSet?.bodyweightFactor || 1) * 100
    : Number(exerciseSettings?.bodyweightPercent || 100);
  const bodyweightFactor = bodyweightPercent / 100;
  const usesBodyweight = loadType !== 'normal';
  const allowsAddedWeight = loadType === 'bodyweight-added';
  const measurementType = initialSet
    ? (isDurationSet(initialSet) ? 'duration' : 'reps')
    : (exerciseSettings?.measurementType ?? 'reps');
  const duration = measurementType === 'duration';

  const [weight, setWeight] = useState(initialSet?.weightInput ?? initialSet?.weight ?? (duration ? 0 : ''));
  const [reps, setReps] = useState((duration ? initialSet?.durationSeconds : initialSet?.reps) ?? '');
  const [comment, setComment] = useState(initialSet?.comment ?? '');
  const [bodyWeight, setBodyWeight] = useState(initialSet?.bodyWeight ?? '');
  const [addedWeight, setAddedWeight] = useState(initialSet?.addedWeightInput ?? initialSet?.addedWeight ?? 0);
  const [error, setError] = useState('');
  const parsedAddedWeight = parseWeightInput(addedWeight, { allowNegative: true });
  const parsedWeight = parseWeightInput(weight);
  const effectiveBodyweight = parsedAddedWeight ? calculateBodyweightLoad(
    bodyWeight,
    bodyweightFactor,
    allowsAddedWeight ? parsedAddedWeight.weight : 0,
  ) : null;

  useEffect(() => {
    setWeight(initialSet?.weightInput ?? initialSet?.weight ?? (duration ? 0 : ''));
    setReps((duration ? initialSet?.durationSeconds : initialSet?.reps) ?? '');
    setComment(initialSet?.comment ?? '');
    setBodyWeight(initialSet?.bodyWeight ?? readBodyWeight());
    setAddedWeight(initialSet?.addedWeightInput ?? initialSet?.addedWeight ?? 0);
    setError('');
  }, [exerciseName, initialSet, isOpen, duration]);

  function handleSubmit(event) {
    event.preventDefault();
    const result = prepareSetValues({
      measurementType,
      weight,
      reps,
      durationSeconds: reps,
      ...(usesBodyweight ? {
        weightMode: 'bodyweight',
        bodyWeight,
        bodyweightFactor,
        addedWeight: allowsAddedWeight ? addedWeight : 0,
      } : {}),
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    const parsedBodyWeight = parseLocalizedNumber(bodyWeight);
    if (usesBodyweight) {
      rememberBodyWeight(parsedBodyWeight);
    }

    onSave({
      id: initialSet?.id,
      ...result.values,
      comment,
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
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {usesBodyweight ? (
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Dein Gewicht</span>
              <input
                className="field text-lg font-bold tabular-nums"
                inputMode="decimal"
                value={bodyWeight}
                onChange={(event) => {
                  setBodyWeight(event.target.value);
                  setError('');
                }}
                placeholder="z. B. 90"
                autoFocus
              />
            </label>
          ) : (
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Gewicht kg</span>
              <input
                className="field text-lg font-bold tabular-nums"
                inputMode="text"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                  setError('');
                }}
                placeholder="30 oder 2x30"
                autoFocus
              />
              {parsedWeight?.weightInput ? <span className="mt-1.5 block text-xs text-muted">Gesamtlast: {parsedWeight.weight} kg</span> : null}
              {duration ? <span className="mt-1.5 block text-xs text-muted">Ohne Zusatzlast: 0 kg</span> : null}
            </label>
          )}
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">{duration ? 'Dauer (Sekunden)' : 'Wiederholungen'}</span>
            <input
              className="field text-lg font-bold tabular-nums"
              inputMode="numeric"
              value={reps}
              onChange={(event) => {
                setReps(event.target.value);
                setError('');
              }}
              placeholder={duration ? '30' : '8'}
            />
          </label>
        </div>

        {usesBodyweight ? (
          <div className="rounded-sm bg-surface-raised p-3">
            {allowsAddedWeight ? (
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Zusatzgewicht / Unterstützung
                </span>
                <input
                  className="field py-2.5"
                  inputMode="text"
                  value={addedWeight}
                  onChange={(event) => {
                    setAddedWeight(event.target.value);
                    setError('');
                  }}
                  placeholder="+10 oder -20"
                />
              </label>
            ) : null}
            <div className={`${allowsAddedWeight ? 'mt-3' : ''} flex items-center justify-between gap-3`}>
              <p className="text-xs text-muted">Körpergewichtsanteil: <strong className="text-ink">{bodyweightPercent} %</strong></p>
              <p className="text-xs text-muted">
                Effektive Last:{' '}
                <strong className="font-display text-base tabular-nums text-ink">
                  {effectiveBodyweight === null ? '–' : `${effectiveBodyweight} kg`}
                </strong>
              </p>
            </div>
          </div>
        ) : (
          <WeightSuggestionGrid options={weightOptions} selectedValue={weight} onSelect={setWeight} />
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{duration ? 'Schnellauswahl Sekunden' : 'Schnellauswahl Reps'}</p>
          <div className="grid grid-cols-3 gap-1.5 min-[350px]:grid-cols-6">
            {(duration ? durationPresets : repPresets).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReps(preset)}
                className={`min-h-11 rounded-sm border text-sm font-bold transition ${
                  Number(reps) === preset
                    ? 'border-amber bg-amber-soft text-amber-deep'
                    : 'border-line bg-paper text-muted hover:border-amber/55 hover:text-ink'
                }`}
                aria-pressed={Number(reps) === preset}
              >
                {preset}{duration ? ' s' : ''}
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
