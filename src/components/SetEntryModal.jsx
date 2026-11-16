import { useLayoutEffect, useState } from 'react';
import { calculateBodyweightLoad, parseLocalizedNumber } from '../utils/bodyweight';
import { isDurationSet, parseWeightInput, prepareSetValues } from '../utils/setMeasurements';
import { getSetEntryLoadType, getSetEntryWeight, getSetEntryWeightSuggestions } from '../utils/setEntry';
import ModalShell from './ModalShell';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = [5, 6, 7, 8, 9, 10, 11, 12];
const durationPresets = [15, 20, 30, 40, 45, 60];
const BODY_WEIGHT_KEY = 'hardgainwaf-body-weight-kg';

function EntryValue({ label, manual, value, onChange, inputMode = 'decimal', focus = false, suffix = '' }) {
  return <div>
    {manual ? <label>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
      <input className="field text-lg font-bold tabular-nums" inputMode={inputMode}
        value={value} onChange={event => onChange(event.target.value)} autoFocus={focus} />
    </label> : <div className="rounded-sm border border-line bg-surface-raised p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink">{value === '' ? '–' : `${value}${suffix}`}</p>
    </div>}
  </div>;
}

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
  timerSetup = false,
  exerciseName,
  exerciseSettings,
  weightOptions,
  repSuggestions = repPresets,
  onClose,
  onSave,
}) {
  const configuredLoadType = exerciseSettings?.loadType ?? 'normal';
  const loadType = getSetEntryLoadType(initialSet, exerciseSettings);
  const paired = loadType === 'paired';
  const bodyweightPercent = initialSet?.weightMode === 'bodyweight'
    ? Number(initialSet?.bodyweightFactor || 1) * 100
    : Number(exerciseSettings?.bodyweightPercent || 100);
  const bodyweightFactor = bodyweightPercent / 100;
  const usesBodyweight = loadType === 'bodyweight' || loadType === 'bodyweight-added';
  const withoutWeight = loadType === 'none';
  const allowsAddedWeight = loadType === 'bodyweight-added';
  const measurementType = initialSet
    ? (isDurationSet(initialSet) ? 'duration' : 'reps')
    : (exerciseSettings?.measurementType ?? 'reps');
  const duration = measurementType === 'duration';

  const [weight, setWeight] = useState(getSetEntryWeight(initialSet, loadType, duration));
  const [reps, setReps] = useState((duration ? initialSet?.durationSeconds : initialSet?.reps) ?? '');
  const [comment, setComment] = useState(initialSet?.comment ?? '');
  const [bodyWeight, setBodyWeight] = useState(initialSet?.bodyWeight ?? '');
  const [addedWeight, setAddedWeight] = useState(initialSet?.addedWeightInput ?? initialSet?.addedWeight ?? 0);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const parsedAddedWeight = parseWeightInput(addedWeight, { allowNegative: true });
  const parsedWeight = parseWeightInput(weight);
  const displayedWeightOptions = getSetEntryWeightSuggestions(weightOptions, configuredLoadType, loadType);
  const effectiveBodyweight = parsedAddedWeight ? calculateBodyweightLoad(
    bodyWeight,
    bodyweightFactor,
    allowsAddedWeight ? parsedAddedWeight.weight : 0,
  ) : null;

  useLayoutEffect(() => {
    setWeight(getSetEntryWeight(initialSet, loadType, duration));
    setReps((duration ? initialSet?.durationSeconds : initialSet?.reps) ?? '');
    setComment(initialSet?.comment ?? '');
    setBodyWeight(initialSet?.bodyWeight ?? readBodyWeight());
    setAddedWeight(initialSet?.addedWeightInput ?? initialSet?.addedWeight ?? 0);
    setError('');
    setManual(false);
  }, [exerciseName, initialSet, isOpen, duration, loadType]);

  function handleSubmit(event) {
    event.preventDefault();
    const result = prepareSetValues({
      measurementType,
      weight,
      reps,
      durationSeconds: timerSetup ? 1 : reps,
      ...(paired ? { weightMode: 'paired', individualWeight: weight } : {}),
      ...(withoutWeight ? { weightMode: 'none' } : {}),
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
            {timerSetup ? 'Gewicht für Stoppuhr' : initialSet ? 'Satz ändern' : 'Neuer Satz'}
          </h2>
        </div>
        <button type="button" className="icon-button" aria-label={manual ? 'Manuelle Eingabe schließen' : 'Manuelle Eingabe öffnen'}
          aria-pressed={manual} onClick={() => setManual(value => !value)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" />
          </svg>
        </button>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className={`grid gap-3 ${withoutWeight || timerSetup ? '' : 'grid-cols-2'}`}>
          {usesBodyweight ? (
            <EntryValue label="Dein Gewicht" manual={manual} value={bodyWeight} onChange={setBodyWeight} focus suffix=" kg" />
          ) : !withoutWeight ? (
            <div>
              <EntryValue label={paired ? 'Gewicht je Hantel' : 'Gewicht'} manual={manual} value={weight}
                onChange={setWeight} inputMode={paired ? 'decimal' : 'text'} focus suffix=" kg" />
              {paired ? (
                <span className="mt-1.5 block text-xs text-muted">2x</span>
              ) : parsedWeight?.weightInput ? <span className="mt-1.5 block text-xs text-muted">Gesamtlast: {parsedWeight.weight} kg</span> : null}
            </div>
          ) : null}
          {!timerSetup ? <EntryValue label={duration ? 'Sekunden' : 'Wiederholungen'} manual={manual}
            value={reps} onChange={setReps} inputMode="numeric" focus={withoutWeight} /> : null}
        </div>

        {usesBodyweight ? (
          <div className="rounded-sm bg-surface-raised p-3">
            {allowsAddedWeight ? (
              <div className="space-y-2">
                <EntryValue label="Zusatzgewicht / Unterstützung" manual={manual} value={addedWeight}
                  onChange={setAddedWeight} inputMode="text" suffix=" kg" />
                <WeightSuggestionGrid options={[-20, -10, -5, 0, 5, 10, 15, 20]} selectedValue={addedWeight}
                  onSelect={setAddedWeight} label="Zusatzgewicht / Unterstützung" />
              </div>
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
        ) : !withoutWeight ? (
          <WeightSuggestionGrid options={displayedWeightOptions} selectedValue={weight} onSelect={setWeight} perWeight={paired} />
        ) : null}

        {!timerSetup ? <div>
          <div className="flex flex-wrap gap-1">
            {(duration ? durationPresets : repSuggestions).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReps(preset)}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm border px-2 text-xs font-semibold tabular-nums transition ${
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
        </div> : null}

        {!timerSetup && manual ? <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Kommentar</span>
          <textarea
            className="field min-h-[88px] resize-y"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Form, Tempo, Gefühl …"
          />
        </label> : null}
        {!timerSetup && !manual && comment ? <p className="text-sm italic text-muted">{comment}</p> : null}

        {error ? (
          <p className="rounded-sm border border-ember/35 bg-ember/10 px-3 py-2 text-sm font-semibold text-ember" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
          <button type="button" onClick={onClose} className="secondary-button flex-1">Abbrechen</button>
          <button type="submit" className="action-button flex-1">{timerSetup ? 'Übernehmen' : 'Speichern'}</button>
        </div>
      </form>
    </ModalShell>
  );
}
