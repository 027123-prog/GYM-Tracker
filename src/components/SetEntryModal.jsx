import { useEffect, useState } from 'react';
import {
  BODYWEIGHT_FACTOR_PRESETS,
  calculateBodyweightLoad,
  parseLocalizedNumber,
} from '../utils/bodyweight';
import ModalShell from './ModalShell';
import WeightSuggestionGrid from './WeightSuggestionGrid';

const repPresets = [5, 6, 8, 10, 12, 15];
const BODY_WEIGHT_KEY = 'hardgainwaf-body-weight-kg';

function getBodyweightFactorKey(exerciseName) {
  const normalizedName = String(exerciseName || 'allgemein')
    .trim()
    .toLocaleLowerCase('de-DE');
  return `hardgainwaf-body-weight-factor:${normalizedName}`;
}

function readLocalPreference(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalPreference(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Die Berechnung funktioniert auch, wenn der Browser Einstellungen nicht dauerhaft speichern darf.
  }
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
  const [bodyweightPanelOpen, setBodyweightPanelOpen] = useState(false);
  const [weightMode, setWeightMode] = useState(initialSet?.weightMode ?? '');
  const [bodyWeight, setBodyWeight] = useState(initialSet?.bodyWeight ?? '');
  const [bodyweightFactor, setBodyweightFactor] = useState(initialSet?.bodyweightFactor ?? 1);
  const [addedWeight, setAddedWeight] = useState(initialSet?.addedWeight ?? 0);
  const [error, setError] = useState('');
  const effectiveBodyweight = calculateBodyweightLoad(bodyWeight, bodyweightFactor, addedWeight);

  useEffect(() => {
    setWeight(initialSet?.weight ?? '');
    setReps(initialSet?.reps ?? '');
    setComment(initialSet?.comment ?? '');
    setSeatHeight(initialSet?.seatHeight ?? '');
    setWeightMode(initialSet?.weightMode ?? '');
    setBodyweightPanelOpen(initialSet?.weightMode === 'bodyweight');
    setBodyWeight(initialSet?.bodyWeight ?? readLocalPreference(BODY_WEIGHT_KEY));
    setBodyweightFactor(
      initialSet?.bodyweightFactor ??
        readLocalPreference(getBodyweightFactorKey(exerciseName), 1),
    );
    setAddedWeight(initialSet?.addedWeight ?? 0);
    setError('');
  }, [exerciseName, initialSet, isOpen]);

  function applyBodyweight() {
    const effectiveWeight = calculateBodyweightLoad(bodyWeight, bodyweightFactor, addedWeight);

    if (effectiveWeight === null) {
      setError('Körpergewicht, Faktor und Zusatzgewicht ergeben keine gültige Last.');
      return;
    }

    setWeight(effectiveWeight);
    setWeightMode('bodyweight');
    setError('');
    writeLocalPreference(BODY_WEIGHT_KEY, parseLocalizedNumber(bodyWeight));
    writeLocalPreference(
      getBodyweightFactorKey(exerciseName),
      parseLocalizedNumber(bodyweightFactor),
    );
  }

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
      ...(weightMode === 'bodyweight'
        ? {
            weightMode,
            bodyWeight: parseLocalizedNumber(bodyWeight),
            bodyweightFactor: parseLocalizedNumber(bodyweightFactor),
            addedWeight: parseLocalizedNumber(addedWeight || 0),
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
                setWeightMode('');
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

        <button
          type="button"
          onClick={() => setBodyweightPanelOpen((current) => !current)}
          className={`secondary-button w-full ${
            weightMode === 'bodyweight' ? 'border-amber bg-amber-soft text-amber-deep' : ''
          }`}
          aria-expanded={bodyweightPanelOpen}
          aria-controls="bodyweight-calculator"
        >
          Körpergewicht
        </button>

        {bodyweightPanelOpen ? (
          <div id="bodyweight-calculator" className="rounded-sm bg-surface-raised p-3">
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Dein Gewicht
                </span>
                <input
                  className="field py-2.5"
                  inputMode="decimal"
                  value={bodyWeight}
                  onChange={(event) => {
                    setBodyWeight(event.target.value);
                    setWeightMode('');
                  }}
                  placeholder="z. B. 90"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Zusatz / Hilfe
                </span>
                <input
                  className="field py-2.5"
                  inputMode="decimal"
                  value={addedWeight}
                  onChange={(event) => {
                    setAddedWeight(event.target.value);
                    setWeightMode('');
                  }}
                  placeholder="+10 / -20"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(72px,1.1fr)] gap-1.5">
              {BODYWEIGHT_FACTOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setBodyweightFactor(
                      preset.label === '⅔'
                        ? '⅔'
                        : String(preset.value).replace('.', ','),
                    );
                    setWeightMode('');
                  }}
                  className={`min-h-10 rounded-sm border text-xs font-bold transition ${
                    Math.abs(parseLocalizedNumber(bodyweightFactor) - preset.value) < 0.001
                      ? 'border-amber bg-amber-soft text-amber-deep'
                      : 'border-line bg-paper text-muted hover:border-amber/55 hover:text-ink'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <label>
                <span className="sr-only">Eigener Körpergewichtsfaktor</span>
                <input
                  className="field h-10 px-2 py-1 text-center text-xs font-bold"
                  inputMode="decimal"
                  value={bodyweightFactor}
                  onChange={(event) => {
                    setBodyweightFactor(event.target.value);
                    setWeightMode('');
                  }}
                  aria-label="Eigener Körpergewichtsfaktor"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Effektive Last:{' '}
                <strong className="font-display text-base tabular-nums text-ink">
                  {effectiveBodyweight === null ? '–' : `${effectiveBodyweight} kg`}
                </strong>
              </p>
              <button type="button" onClick={applyBodyweight} className="secondary-button shrink-0 px-3">
                Übernehmen
              </button>
            </div>
          </div>
        ) : null}

        <WeightSuggestionGrid
          options={weightOptions}
          onSelect={(value) => {
            setWeight(value);
            setWeightMode('');
          }}
        />

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

        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
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
