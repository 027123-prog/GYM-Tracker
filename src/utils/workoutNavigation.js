const EXERCISE_POSITION_PREFIX = 'gym-tracker-workout-position:';
const LAST_WORKOUT_VIEW_KEY = 'gym-tracker-last-workout-view';

function getNavigationStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readWorkoutExerciseIndex(workout, storage = getNavigationStorage()) {
  if (!workout?.id || !workout.exercises?.length) {
    return 0;
  }

  try {
    const savedEntryId = storage?.getItem(`${EXERCISE_POSITION_PREFIX}${workout.id}`);
    return Math.max(0, workout.exercises.findIndex((entry) => entry.id === savedEntryId));
  } catch {
    return 0;
  }
}

export function saveWorkoutExercisePosition(workoutId, entryId, storage = getNavigationStorage()) {
  if (!workoutId || !entryId) {
    return;
  }

  try {
    // Store the entry ID, so reordering a workout does not select another exercise.
    storage?.setItem(`${EXERCISE_POSITION_PREFIX}${workoutId}`, entryId);
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

export function readWorkoutResumePath(workouts, storage = getNavigationStorage()) {
  try {
    const workoutId = storage?.getItem(LAST_WORKOUT_VIEW_KEY);
    const workout = workouts.find((item) => item.id === workoutId && !item.completedAt);
    return workout ? `/workouts/${encodeURIComponent(workout.id)}/edit` : null;
  } catch {
    return null;
  }
}

export function rememberWorkoutView(pathname, workouts, storage = getNavigationStorage()) {
  try {
    const match = pathname.match(/^\/workouts\/([^/]+)\/edit$/);
    const workoutId = match ? decodeURIComponent(match[1]) : null;
    const workout = workouts.find((item) => item.id === workoutId && !item.completedAt);

    if (workout) {
      storage?.setItem(LAST_WORKOUT_VIEW_KEY, workout.id);
    } else {
      // Deliberately leaving a workout must also stay respected after an app restart.
      storage?.removeItem(LAST_WORKOUT_VIEW_KEY);
    }
  } catch {
    // A blocked store or invalid URL must not prevent regular routing.
  }
}
