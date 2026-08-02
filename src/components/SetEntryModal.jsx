import { useEffect, useState } from 'react';
import { calculateBodyweightLoad, parseLocalizedNumber } from '../utils/bodyweight';
import ModalShell from './ModalShell';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = [5, 6, 8, 10, 12, 15];
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
  const legacyLoadType = initialSet?.weightMode === 'bodyweight' && configuredLoadType === 'normal'
    ? (Number(initialSet.addedWeight) ? 'bodyweight-added' : 'bodyweight')
    : null;
  const loadType = configuredLoadType !== 'normal' ? configuredLoadType : (legacyLoadType ?? 'normal');
  const bodyweightPercent = legacyLoadType
    ? Number(initialSet?.bodyweightFactor || 1) * 100
    : Number(exerciseSettings?.bodyweightPercent || 100);
  const bodyweightFactor = bodyweightPercent / 100;
  const usesBodyweight = loadType !== 'normal';
  const allowsAddedWeight = loadType === 'bodyweight-added';

  const [weight, setWeight] = useState(initialSet?.weight ?? '');
  const [reps, setReps] = useState(initialSet?.reps ?? '');
  const [comment, setComment] = useState(initialSet?.comment ?? '');
  const [bodyWeight, setBodyWeight] = useState(initialSet?.bodyWeight ?? '');
  const [addedWeight, setAddedWeight] = useState(initialSet?.addedWeight ?? 0);
  const [error, setError] = useState('');
  const effectiveBodyweight = calculateBodyweightLoad(
    bodyWeight,
    bodyweightFactor,
    allowsAddedWeight ? addedWeight : 0,
  );

  useEffect(() => {
    setWeight(initialSet?.weight ?? '');
    setReps(initialSet?.reps ?? '');
    setComment(initialSet?.comment ?? '');
    setBodyWeight(initialSet?.bodyWeight ?? readBodyWeight());
    setAddedWeight(initialSet?.addedWeight ?? 0);
    setError('');
  }, [exerciseName, initialSet, isOpen]);

  function handleSubmit(event) {
    event.preventDefault();
    const parsedWeight = usesBodyweight ? effectiveBodyweight : parseLocalizedNumber(weight);
    const parsedReps = parseLocalizedNumber(reps);

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 2000) {
      setError(
        usesBodyweight
          ? 'Bitte trage ein gültiges Körpergewicht ein.'
          : 'Gewicht muss eine Zahl zwischen 0 und 2.000 kg sein.',
      );
      return;
    }

    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setError('Wiederholungen müssen eine ganze Zahl zwischen 1 und 1.000 sein.');
      return;
    }

    const parsedBodyWeight = parseLocalizedNumber(bodyWeight);
    if (usesBodyweight) {
      rememberBodyWeight(parsedBodyWeight);
    }

    onSave({
      id: initialSet?.id,
      weight: parsedWeight,
      reps: parsedReps,
      comment,
      ...(usesBodyweight
        ? {
            weightMode: 'bodyweight',
            bodyWeight: parsedBodyWeight,
            bodyweightFactor,
            addedWeight: allowsAddedWeight ? parseLocalizedNumber(addedWeight || 0) : 0,
          }
        : {}),
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
          )}
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

        {usesBodyweight ? (
          <div className="rounded-sm bg-surface-raised p-3">
            {allowsAddedWeight ? (
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Zusatzgewicht / Unterstützung
                </span>
                <input
                  className="field py-2.5"
                  inputMode="decimal"
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
          <WeightSuggestionGrid options={weightOptions} onSelect={setWeight} />
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Schnellauswahl Reps</p>
          <div className="grid grid-cols-3 gap-1.5 min-[350px]:grid-cols-6">
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
