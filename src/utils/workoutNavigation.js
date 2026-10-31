const EXERCISE_POSITION_PREFIX = 'gym-tracker-workout-position:';
const LAST_WORKOUT_VIEW_KEY = 'gym-tracker-last-workout-view';
const ACTIVE_WORKOUT_KEY = 'gym-tracker-active-workout';
const LEGACY_FREE_DRAFT_KEY = 'gym-tracker-active-free-draft';

function getNavigationStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeRead(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

export function readStoredActiveWorkoutId(workouts, session = getSessionStorage(), storage = getNavigationStorage()) {
  const candidates = [safeRead(session, ACTIVE_WORKOUT_KEY), safeRead(session, LEGACY_FREE_DRAFT_KEY), safeRead(storage, ACTIVE_WORKOUT_KEY)];
  return candidates.find(id => id && workouts.some(workout => workout.id === id && !workout.completedAt)) ?? null;
}

export function storeActiveWorkoutId(workoutId, session = getSessionStorage(), storage = getNavigationStorage()) {
  if (!workoutId) return;
  for (const target of [session, storage]) {
    try {
      target?.setItem(ACTIVE_WORKOUT_KEY, workoutId);
      target?.removeItem(LEGACY_FREE_DRAFT_KEY);
    } catch {
      // Session and durable storage may be available independently.
    }
  }
}

export function clearStoredActiveWorkoutId(session = getSessionStorage(), storage = getNavigationStorage()) {
  for (const target of [session, storage]) {
    try {
      target?.removeItem(ACTIVE_WORKOUT_KEY);
      target?.removeItem(LEGACY_FREE_DRAFT_KEY);
    } catch {
      // Navigation remains usable if a browser store is unavailable.
    }
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
