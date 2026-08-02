const germanNameCollator = new Intl.Collator('de-DE', {
  sensitivity: 'base',
});

function compareNames(left, right) {
  return germanNameCollator.compare(
    String(left.exercise?.name ?? '').trim(),
    String(right.exercise?.name ?? '').trim(),
  );
}

function parseTimestamp(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compareOptionalDatesDescending(leftTimestamp, rightTimestamp) {
  if (leftTimestamp === rightTimestamp) {
    return 0;
  }

  if (leftTimestamp === null) {
    return 1;
  }

  if (rightTimestamp === null) {
    return -1;
  }

  return rightTimestamp - leftTimestamp;
}

function compareDecoratedExercises(left, right, sortMode) {
  if (sortMode === 'name-desc') {
    return -compareNames(left, right) || left.inputIndex - right.inputIndex;
  }

  if (sortMode === 'count-desc') {
    const countDifference =
      parseNumber(right.exercise?.workoutCount) - parseNumber(left.exercise?.workoutCount);

    return countDifference || compareNames(left, right) || left.inputIndex - right.inputIndex;
  }

  if (sortMode === 'newest') {
    const dateDifference = compareOptionalDatesDescending(left.createdAt, right.createdAt);

    if (dateDifference) {
      return dateDifference;
    }

    if (left.createdAt === null && right.createdAt === null) {
      const sourceIndexDifference = right.sourceIndex - left.sourceIndex;

      if (sourceIndexDifference) {
        return sourceIndexDifference;
      }
    }

    return compareNames(left, right) || left.inputIndex - right.inputIndex;
  }

  if (sortMode === 'last-trained') {
    return (
      compareOptionalDatesDescending(left.lastTrainedAt, right.lastTrainedAt) ||
      compareNames(left, right) ||
      left.inputIndex - right.inputIndex
    );
  }

  return compareNames(left, right) || left.inputIndex - right.inputIndex;
}

export function sortExerciseCards(exercises, sortMode = 'name-asc') {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises
    .map((exercise, inputIndex) => ({
      exercise,
      inputIndex,
      createdAt: parseTimestamp(exercise?.createdAt),
      lastTrainedAt: parseTimestamp(exercise?.lastTrainedAt),
      sourceIndex: parseNumber(exercise?.sourceIndex, inputIndex),
    }))
    .sort((left, right) => compareDecoratedExercises(left, right, sortMode))
    .map(({ exercise }) => exercise);
}

export function normalizeExerciseSortMode(value) {
  return ['name-asc', 'name-desc', 'count-desc', 'newest', 'last-trained'].includes(value)
    ? value
    : 'name-asc';
}

export function resolveExerciseNavigationOrder(exercises, requestedOrder) {
  const alphabeticalFallback = sortExerciseCards(exercises, 'name-asc');

  if (!Array.isArray(requestedOrder) || !requestedOrder.length) {
    return alphabeticalFallback;
  }

  const exercisesById = new Map(alphabeticalFallback.map((exercise) => [exercise.id, exercise]));
  const seen = new Set();
  const orderedExercises = [];

  requestedOrder.slice(0, alphabeticalFallback.length).forEach((exerciseId) => {
    if (typeof exerciseId !== 'string' || seen.has(exerciseId) || !exercisesById.has(exerciseId)) {
      return;
    }

    seen.add(exerciseId);
    orderedExercises.push(exercisesById.get(exerciseId));
  });

  return orderedExercises.length ? orderedExercises : alphabeticalFallback;
}
