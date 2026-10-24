import { parseWeightInput } from './setMeasurements';

export function getWeightSuggestionKey(value) {
  const parsed = parseWeightInput(value);
  if (!parsed) return null;
  if (!parsed.weightInput) return String(parsed.weight);

  const [count, single] = parsed.weightInput.split('x');
  return `${Number(count)}x${Number(single.replace(',', '.')).toString().replace('.', ',')}`;
}

export function getExerciseWeightSuggestions(weightOptions = [], workouts = [], exerciseId) {
  const options = new Map();

  function add(value, expectedWeight) {
    const parsed = parseWeightInput(value);
    if (!parsed || (expectedWeight !== undefined && parsed.weight !== Number(expectedWeight))) return;
    if (!options.has(parsed.weight)) options.set(parsed.weight, new Set());
    if (parsed.weightInput) options.get(parsed.weight).add(getWeightSuggestionKey(value));
  }

  weightOptions.forEach(value => add(value));
  for (const workout of workouts) {
    for (const exercise of workout.exercises ?? []) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const setItem of exercise.sets ?? []) {
        if (setItem.weightMode === 'bodyweight') continue;
        add(setItem.weight);
        add(setItem.weightInput, setItem.weight);
      }
    }
  }

  return [...options.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([weight, expressions]) => expressions.size ? [...expressions].sort() : [weight]);
}
