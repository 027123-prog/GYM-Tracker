import { formatSetSummary, getSetRepVolume, isDurationSet, isWeightlessSet } from './setMeasurements';

export function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function calculateWorkoutStats(workout) {
  const activeExercises = (workout.exercises || []).filter((exercise) => !exercise.skipped);
  const sets = activeExercises.flatMap((exercise) => exercise.sets || []);
  const totalVolume = sets.reduce((sum, setItem) => sum + getSetRepVolume(setItem), 0);
  const totalDurationSeconds = sets.reduce((sum, setItem) => sum + (isDurationSet(setItem) ? Number(setItem.durationSeconds || 0) : 0), 0);
  const totalReps = sets.reduce((sum, setItem) => sum + (isWeightlessSet(setItem) && !isDurationSet(setItem) ? Number(setItem.reps || 0) : 0), 0);

  return {
    exerciseCount: activeExercises.length,
    setCount: sets.length,
    totalVolume,
    ...(totalDurationSeconds ? { totalDurationSeconds } : {}),
    ...(totalReps ? { totalReps } : {}),
  };
}

function parseDateTimestamp(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getWorkoutDateTimestamp(workout) {
  return (
    parseDateTimestamp(workout?.date) ??
    parseDateTimestamp(workout?.completedAt) ??
    parseDateTimestamp(workout?.updatedAt)
  );
}

export function sortWorkoutsByDate(workouts = []) {
  if (!Array.isArray(workouts)) {
    return [];
  }

  return workouts
    .map((workout, index) => ({
      workout,
      index,
      timestamp: getWorkoutDateTimestamp(workout),
    }))
    .sort((a, b) => {
      if (a.timestamp === b.timestamp) {
        return a.index - b.index;
      }

      if (a.timestamp === null) {
        return 1;
      }

      if (b.timestamp === null) {
        return -1;
      }

      return b.timestamp - a.timestamp;
    })
    .map((item) => item.workout);
}

function normalizeExerciseName(value = '') {
  return value.trim().toLocaleLowerCase('de-DE');
}

function matchesExercise(exercise, exerciseId, exerciseName = '') {
  return (
    exercise.exerciseId === exerciseId ||
    (exerciseName && normalizeExerciseName(exercise.name) === normalizeExerciseName(exerciseName))
  );
}

export function getLastExerciseSnapshot(workouts, exerciseId, excludeWorkoutId = null, exerciseName = '') {
  const sorted = sortWorkoutsByDate(
    workouts.filter((workout) => workout.id !== excludeWorkoutId && workout.completedAt),
  );

  for (const workout of sorted) {
    const matchingExercises = workout.exercises.filter(
      (exercise) =>
        matchesExercise(exercise, exerciseId, exerciseName) &&
        !exercise.skipped &&
        exercise.sets?.length,
    );

    if (!matchingExercises.length) {
      continue;
    }

    const workoutTimestamp = getWorkoutDateTimestamp(workout);

    return {
      workoutId: workout.id,
      workoutName: workout.name,
      workoutDate: workoutTimestamp === null ? null : new Date(workoutTimestamp).toISOString(),
      skipped: false,
      sets: matchingExercises.flatMap((exercise) => exercise.sets),
    };
  }

  return null;
}

export function getLastExerciseWeight(workouts, exerciseId, excludeWorkoutId = null, exerciseName = '') {
  const snapshot = getLastExerciseSnapshot(workouts, exerciseId, excludeWorkoutId, exerciseName);
  const lastSet = snapshot?.sets?.[snapshot.sets.length - 1];

  return isWeightlessSet(lastSet) ? null : lastSet?.weight ?? null;
}

export function getLastExerciseSummaryText(workouts, exerciseId, excludeWorkoutId = null, exerciseName = '') {
  const snapshot = getLastExerciseSnapshot(workouts, exerciseId, excludeWorkoutId, exerciseName);

  if (!snapshot) {
    return '';
  }

  return snapshot.sets.map(formatSetSummary).join(' · ');
}

export function getLastExerciseComments(workouts, exerciseId, excludeWorkoutId = null, exerciseName = '') {
  const snapshot = getLastExerciseSnapshot(workouts, exerciseId, excludeWorkoutId, exerciseName);

  if (!snapshot) {
    return [];
  }

  return snapshot.sets
    .map((setItem, index) => ({
      id: setItem.id,
      label: `Satz ${index + 1}`,
      comment: setItem.comment?.trim() ?? '',
    }))
    .filter((item) => item.comment);
}

export function getLastExerciseCommentText(workouts, exerciseId, excludeWorkoutId = null, exerciseName = '') {
  const comments = getLastExerciseComments(workouts, exerciseId, excludeWorkoutId, exerciseName);

  if (!comments.length) {
    return '';
  }

  return comments.map((item) => `${item.label}: ${item.comment}`).join(' • ');
}

export function getExerciseWorkoutCount(workouts, exerciseId, exerciseName = '') {
  return workouts.reduce((count, workout) => {
    if (!workout.completedAt) {
      return count;
    }

    const hasCompletedSets = workout.exercises.some(
      (exercise) =>
        matchesExercise(exercise, exerciseId, exerciseName) &&
        !exercise.skipped &&
        exercise.sets?.length,
    );

    if (!hasCompletedSets) {
      return count;
    }

    return count + 1;
  }, 0);
}

export function buildExerciseChartData(workouts, exerciseId, exerciseName = '') {
  return workouts
    .filter((workout) => workout.completedAt)
    .map((workout) => {
      const matchingExercises = workout.exercises.filter(
        (exercise) =>
          matchesExercise(exercise, exerciseId, exerciseName) &&
          !exercise.skipped &&
          exercise.sets?.length,
      );

      if (!matchingExercises.length) {
        return null;
      }

      const sets = matchingExercises.flatMap((exercise) => exercise.sets);
      const repSets = sets.filter((setItem) => !isDurationSet(setItem) && !isWeightlessSet(setItem));
      const weightlessRepSets = sets.filter((setItem) => !isDurationSet(setItem) && isWeightlessSet(setItem));
      const durationSets = sets.filter(isDurationSet);
      const loadedDurationSets = durationSets.filter((setItem) => !isWeightlessSet(setItem));
      const maxWeight = repSets.length ? Math.max(...repSets.map((setItem) => Number(setItem.weight || 0))) : null;
      const maxSet = repSets.find((setItem) => Number(setItem.weight || 0) === maxWeight);
      const maxDurationSeconds = durationSets.length ? Math.max(...durationSets.map((setItem) => Number(setItem.durationSeconds))) : null;
      const longestSet = durationSets.find((setItem) => Number(setItem.durationSeconds) === maxDurationSeconds);
      const maxDurationWeight = loadedDurationSets.length ? Math.max(...loadedDurationSets.map((setItem) => Number(setItem.weight || 0))) : null;
      const heaviestDurationSet = loadedDurationSets.find((setItem) => Number(setItem.weight || 0) === maxDurationWeight);

      return {
        date: workout.date,
        shortDate: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(workout.date)),
        volume: repSets.length ? repSets.reduce((sum, setItem) => sum + getSetRepVolume(setItem), 0) : null,
        maxWeight,
        maxWeightReps: maxSet?.reps ?? null,
        maxReps: weightlessRepSets.length ? Math.max(...weightlessRepSets.map((setItem) => Number(setItem.reps || 0))) : null,
        totalReps: weightlessRepSets.length ? weightlessRepSets.reduce((sum, setItem) => sum + Number(setItem.reps || 0), 0) : null,
        totalDurationSeconds: durationSets.length ? durationSets.reduce((sum, setItem) => sum + Number(setItem.durationSeconds), 0) : null,
        maxDurationSeconds,
        longestSetWeight: isWeightlessSet(longestSet) ? null : longestSet?.weight ?? null,
        maxDurationWeight,
        maxDurationWeightSeconds: heaviestDurationSet?.durationSeconds ?? null,
        sets,
        workoutName: workout.name,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function normalizeWeightOptions(values) {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => a - b,
  );
}
