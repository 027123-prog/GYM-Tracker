import { isDurationSet } from './setMeasurements';

const defaultReps = [5, 6, 7, 8, 9, 10, 11, 12];

function validTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getExerciseRepSuggestions(workouts = [], exerciseId) {
  const recentSessions = workouts.map((workout, index) => {
    const sets = (workout.exercises ?? [])
      .filter(exercise => exercise.exerciseId === exerciseId)
      .flatMap(exercise => exercise.sets ?? [])
      .filter(setItem => !isDurationSet(setItem) && Number.isInteger(Number(setItem.reps)) && Number(setItem.reps) >= 1 && Number(setItem.reps) <= 1000);
    const setTimes = sets.map(setItem => validTimestamp(setItem.savedAt)).filter(time => time != null);
    return {
      index,
      time: setTimes.length ? Math.max(...setTimes) : validTimestamp(workout.date) ?? validTimestamp(workout.completedAt) ?? validTimestamp(workout.updatedAt),
      reps: sets.map(setItem => Number(setItem.reps)),
    };
  }).filter(session => session.reps.length)
    .sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index)
    .slice(0, 3);
  const values = recentSessions.flatMap(session => session.reps).sort((a, b) => a - b);
  if (!values.length) return [...defaultReps];

  // Use an observed median rather than inventing a midpoint between distant values.
  const median = values[Math.floor(values.length / 2)];
  let start = median >= 5 && median <= 12 ? 5 : Math.max(1, Math.round(median) - 3);
  let end = start + 7;
  const minimum = values[0];
  const maximum = values[values.length - 1];
  // Include the observed range when it stays compact; a lone extreme value must not
  // stretch the quick choices into dozens of buttons or displace the typical range.
  if (maximum - minimum < 12) {
    start = Math.min(start, minimum);
    end = Math.max(end, maximum);
    if (end - start >= 12) {
      start = minimum;
      end = Math.max(maximum, start + 7);
    }
  }
  if (end > 1000) {
    end = 1000;
    start = Math.max(1, Math.min(start, end - 7));
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
