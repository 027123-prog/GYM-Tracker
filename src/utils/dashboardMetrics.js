import { getSetRepVolume, isDurationSet, isWeightlessSet } from './setMeasurements';
import { getWorkoutDateTimestamp } from './workout';

const DAY_MS = 86_400_000;
export const PROGRESS_WINDOW_DAYS = 28;
const metrics = ['volume', 'reps', 'duration'];

function localDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function workoutDay(workout) {
  const timestamp = getWorkoutDateTimestamp(workout);
  if (timestamp === null) return null;
  // A date-only record already represents a calendar day regardless of the device time zone.
  return /^\d{4}-\d{2}-\d{2}$/.test(workout.date?.trim?.()) ? timestamp / DAY_MS : localDay(timestamp);
}

function collectBestSets(best, exercises) {
  for (const exercise of exercises) {
    if (exercise.skipped || !exercise.sets?.length) continue;
    const key = exercise.exerciseId;
    const scores = best.get(key) ?? { volume: 0, reps: 0, duration: 0 };
    for (const set of exercise.sets) {
      const metric = isDurationSet(set) ? 'duration' : isWeightlessSet(set) || !Number(set.weight) ? 'reps' : 'volume';
      const value = metric === 'duration' ? Number(set.durationSeconds) : metric === 'reps' ? Number(set.reps) : getSetRepVolume(set);
      if (Number.isFinite(value) && value > scores[metric]) scores[metric] = value;
    }
    best.set(key, scores);
  }
}

export function getDashboardMetrics(workouts, now = new Date()) {
  const today = localDay(now);
  const recent = new Map();
  const previous = new Map();
  let daysSinceLastWorkout = null;

  for (const workout of workouts) {
    if (!workout.completedAt) continue;
    const day = workoutDay(workout);
    if (day === null || day > today) continue;
    const age = today - day;
    daysSinceLastWorkout = Math.min(daysSinceLastWorkout ?? age, age);
    if (age < PROGRESS_WINDOW_DAYS * 2) {
      collectBestSets(age < PROGRESS_WINDOW_DAYS ? recent : previous, workout.exercises);
    }
  }

  const changes = [];
  for (const [exerciseId, current] of recent) {
    const baseline = previous.get(exerciseId);
    if (!baseline) continue;
    const metric = metrics.find((key) => current[key] > 0 && baseline[key] > 0);
    if (metric) changes.push(current[metric] / baseline[metric] - 1);
  }

  changes.sort((a, b) => a - b);
  const middle = Math.floor(changes.length / 2);
  const progress = changes.length === 0
    ? null
    : changes.length % 2 ? changes[middle] : (changes[middle - 1] + changes[middle]) / 2;
  return { daysSinceLastWorkout, progress };
}
