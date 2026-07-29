import { useMemo, useState } from 'react';
import ModalShell from './ModalShell';

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function getSearchTokens(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function isSubsequence(query, target) {
  let index = 0;

  for (const character of target) {
    if (character === query[index]) {
      index += 1;
    }

    if (index >= query.length) {
      return true;
    }
  }

  return false;
}

function getLevenshteinDistance(source, target) {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  const current = new Array(target.length + 1);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    current[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;

      current[targetIndex] = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + substitutionCost,
      );
    }

    for (let targetIndex = 0; targetIndex <= target.length; targetIndex += 1) {
      previous[targetIndex] = current[targetIndex];
    }
  }

  return previous[target.length];
}

function getExerciseMatch(exercise, query, queryTokens) {
  const normalizedName = normalizeText(exercise.name);
  const nameTokens = getSearchTokens(exercise.name);

  if (normalizedName.startsWith(query)) {
    return { exercise, score: 0, distance: 0 };
  }

  if (nameTokens.some((token) => token.startsWith(query))) {
    return { exercise, score: 1, distance: 0 };
  }

  if (queryTokens.length && queryTokens.every((token) => nameTokens.some((nameToken) => nameToken.startsWith(token)))) {
    return { exercise, score: 2, distance: 0 };
  }

  if (normalizedName.includes(query)) {
    return { exercise, score: 3, distance: 0 };
  }

  if (query.length >= 2 && (isSubsequence(query, normalizedName) || nameTokens.some((token) => isSubsequence(query, token)))) {
    return { exercise, score: 4, distance: 0 };
  }

  if (query.length >= 3) {
    const distances = nameTokens.map((token) =>
      getLevenshteinDistance(query, token.slice(0, Math.max(query.length, token.length))),
    );
    const bestDistance = Math.min(
      getLevenshteinDistance(query, normalizedName.slice(0, Math.max(query.length, normalizedName.length))),
      ...distances,
    );

    if (bestDistance <= 2) {
      return { exercise, score: 5, distance: bestDistance };
    }
  }

  return null;
}

export default function AddExerciseModal({ isOpen, exercises, onClose, onAdd }) {
  const [value, setValue] = useState('');
  const [selectedExerciseName, setSelectedExerciseName] = useState('');
  const trimmedValue = value.trim();

  const filteredExercises = useMemo(() => {
    const query = normalizeText(value);
    const queryTokens = getSearchTokens(value);

    if (!query) {
      return [];
    }

    return [...exercises]
      .map((exercise) => getExerciseMatch(exercise, query, queryTokens))
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || a.distance - b.distance || a.exercise.name.localeCompare(b.exercise.name, 'de'))
      .map((item) => item.exercise)
      .slice(0, 8);
  }, [exercises, value]);

  const hasExactExercise = useMemo(
    () => exercises.some((exercise) => normalizeText(exercise.name) === normalizeText(trimmedValue)),
    [exercises, trimmedValue],
  );

  if (!isOpen) {
    return null;
  }

  function submitWithPlacement(placement) {
    const trimmedValue = (selectedExerciseName || value).trim();

    if (!trimmedValue) {
      return;
    }

    const exactMatch = exercises.find((exercise) => normalizeText(exercise.name) === normalizeText(trimmedValue));
    onAdd(exactMatch?.name ?? trimmedValue, placement);
    setValue('');
    setSelectedExerciseName('');
    onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="add-exercise-title" maxWidth="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Workout erweitern</p>
            <h2 id="add-exercise-title" className="mt-2 font-display text-2xl font-bold text-ink">
              Übung einfügen
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">
            ×
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="relative">
            <label htmlFor="modal-exercise-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Übung suchen oder neu anlegen
            </label>
            <input
              id="modal-exercise-search"
              className="field"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setSelectedExerciseName('');
              }}
              placeholder="z. B. Bankdrücken"
              autoComplete="off"
            />
            {(filteredExercises.length || (trimmedValue && !hasExactExercise)) && !selectedExerciseName ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-sm border border-line bg-surface-raised p-2 shadow-panel">
                {trimmedValue && !hasExactExercise ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setValue(trimmedValue);
                      setSelectedExerciseName(trimmedValue);
                    }}
                    className="mb-1 flex min-h-11 w-full items-center justify-between rounded-sm border border-amber/60 bg-amber-soft px-3 py-2 text-left text-sm font-semibold text-ink transition"
                  >
                    <span>Neue Übung: {trimmedValue}</span>
                    <span className="text-xs text-muted">neu</span>
                  </button>
                ) : null}
                {filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setValue(exercise.name);
                      setSelectedExerciseName(exercise.name);
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-ink transition hover:bg-amber-soft"
                  >
                    <span>{exercise.name}</span>
                    <span className="text-xs text-muted">{exercise.weightOptions?.length ?? 0} Gewichte</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => submitWithPlacement('before')} className="secondary-button">
              Davor
            </button>
            <button type="button" onClick={() => submitWithPlacement('after')} className="secondary-button">
              Danach
            </button>
            <button type="button" onClick={() => submitWithPlacement('end')} className="action-button col-span-2">
              Ans Ende
            </button>
          </div>
        </div>
    </ModalShell>
  );
}
