import { useLayoutEffect, useState } from 'react';
import { calculateBodyweightLoad, parseLocalizedNumber } from '../utils/bodyweight';
import { isDurationSet, parseWeightInput, prepareSetValues } from '../utils/setMeasurements';
import { getSetEntryLoadType, getSetEntryWeight, getSetEntryWeightSuggestions } from '../utils/setEntry';
import InterfaceIcon from './InterfaceIcon';
import ModalShell from './ModalShell';
import QuickEntryTile from './QuickEntryTile';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = Array.from({ length: 13 }, (_, index) => index + 3);
const durationPresets = [15, 20, 30, 40, 45, 60];
const BODY_WEIGHT_KEY = 'hardgainwaf-body-weight-kg';

function ManualEntry({ label, value, onChange, inputMode = 'decimal' }) {
  return (
    <label className="mt-2 block">
      <span className="sr-only">{label}</span>
      <input className="field tabular-nums" inputMode={inputMode} value={value}
        onChange={(event) => onChange(event.target.value)} autoFocus />
    </label>
  );
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
  const [manualField, setManualField] = useState(null);
  const repsLabel = duration ? 'Sekunden' : 'Wiederholungen';
  const weightLabel = usesBodyweight ? 'Dein Gewicht' : paired ? 'Gewicht je Hantel' : 'Gewicht';
  const addedWeightLabel = 'Zusatzgewicht / Unterstützung';
  const parsedAddedWeight = parseWeightInput(addedWeight, { allowNegative: true });
  const displayedWeightOptions = getSetEntryWeightSuggestions(weightOptions, configuredLoadType, loadType);
  const quantityOptions = duration ? durationPresets : repPresets;
  const quantity = parseLocalizedNumber(reps);
  const displayedQuantities = Number.isInteger(quantity) && quantity > 0 && !quantityOptions.includes(quantity)
    ? [...quantityOptions, quantity].sort((a, b) => a - b)
    : quantityOptions;
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
    setManualField(null);
  }, [exerciseName, initialSet, isOpen, duration, loadType]);

  function editButton(field, label) {
    const active = manualField === field;
    return (
      <QuickEntryTile aria-label={`${label} manuell eingeben`} selected={active}
        onClick={() => setManualField(active ? null : field)}>
        <InterfaceIcon name="pencil" />
      </QuickEntryTile>
    );
  }

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
      <div className="flex items-center justify-between gap-3">
        <h2 id="set-entry-title" className="min-w-0 break-words font-display text-xl font-bold text-amber-deep [[data-theme=calendar]_&]:text-orange-800">
          {exerciseName || 'Übung'}
        </h2>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        {!withoutWeight ? (
          <div>
            <WeightSuggestionGrid options={usesBodyweight ? [] : displayedWeightOptions}
              selectedValue={usesBodyweight ? bodyWeight : weight} onSelect={usesBodyweight ? setBodyWeight : setWeight}
              label={usesBodyweight ? weightLabel : 'Gewicht'} editControl={editButton('weight', weightLabel)} />
            {manualField === 'weight' ? (
              <ManualEntry label={weightLabel} value={usesBodyweight ? bodyWeight : weight}
                onChange={usesBodyweight ? setBodyWeight : setWeight} inputMode={paired || usesBodyweight ? 'decimal' : 'text'} />
            ) : null}
          </div>
        ) : null}

        {allowsAddedWeight ? (
          <div>
            <WeightSuggestionGrid options={[-20, -10, -5, 0, 5, 10, 15, 20]} selectedValue={addedWeight}
              onSelect={setAddedWeight} label={addedWeightLabel} allowNegative editControl={editButton('added', addedWeightLabel)} />
            {manualField === 'added' ? <ManualEntry label={addedWeightLabel} value={addedWeight} onChange={setAddedWeight} inputMode="text" /> : null}
          </div>
        ) : null}

        {usesBodyweight ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">Körpergewichtsanteil: <strong className="text-ink">{bodyweightPercent} %</strong></p>
              <p className="text-xs text-muted">
                Effektive Last:{' '}
                <strong className="font-display text-base tabular-nums text-ink">
                  {effectiveBodyweight === null ? '–' : `${effectiveBodyweight} kg`}
                </strong>
              </p>
            </div>
        ) : null}

        {!timerSetup ? <div>
          <p className="mb-1.5 text-xs font-bold text-muted">{repsLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {editButton('reps', repsLabel)}
            {displayedQuantities.map((preset) => (
              <QuickEntryTile key={preset} selected={quantity === preset} onClick={() => setReps(preset)}>
                {preset}{duration ? ' s' : ''}
              </QuickEntryTile>
            ))}
          </div>
          {manualField === 'reps' ? <ManualEntry label={repsLabel} value={reps} onChange={setReps} inputMode="numeric" /> : null}
        </div> : null}

        {!timerSetup && manualField ? <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Kommentar</span>
          <textarea
            className="field min-h-[88px] resize-y"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Form, Tempo, Gefühl …"
          />
        </label> : null}
        {!timerSetup && !manualField && comment ? <p className="text-sm italic text-muted">{comment}</p> : null}

        {error ? (
          <p className="rounded-sm border border-ember/35 bg-ember/10 px-3 py-2 text-sm font-semibold text-ember" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:px-6">
          <button type="submit" className="action-button w-full">{timerSetup ? 'Übernehmen' : 'Speichern'}</button>
        </div>
      </form>
    </ModalShell>
  );
}
