import { getSetTimestamp } from './date';

const MINUTE_MS = 60_000;
const MAX_ADJACENT_GAP = 45 * MINUTE_MS;
const WARMUP_MS = 5 * MINUTE_MS;

export function getWorkoutDuration(workout) {
  const times = (workout.exercises ?? [])
    .flatMap((exercise) => exercise.sets ?? [])
    .map((set) => getSetTimestamp(set.savedAt))
    .filter((time) => time !== null)
    .sort((left, right) => left - right);

  if (times.length < 2) return null;

  // Use the outermost sets with a nearby neighbor. An isolated entry before
  // or after the workout drops out, while pauses between blocks still count.
  const first = times.findIndex((time, index) => times[index + 1] - time <= MAX_ADJACENT_GAP);
  const last = times.findLastIndex((time, index) => time - times[index - 1] <= MAX_ADJACENT_GAP);
  const recorded = first === -1 ? times.at(-1) - times[0] : times[last] - times[first];
  return WARMUP_MS + recorded;
}

export function formatWorkoutDuration(workout) {
  const elapsed = getWorkoutDuration(workout);
  if (elapsed === null) return '–';
  const totalMinutes = Math.floor(elapsed / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}
