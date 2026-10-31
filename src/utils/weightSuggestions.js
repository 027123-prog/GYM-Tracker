import { parseWeightInput } from './setMeasurements';

function validTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readNotation(setItem) {
  if (setItem.weightMode === 'bodyweight' || setItem.weightMode === 'none') return null;
  const total = parseWeightInput(setItem.weight);
  // An unloaded warm-up must not switch a dumbbell exercise back to total-load notation.
  if (!total || total.weight <= 0) return null;
  const expression = setItem.weightInput == null || setItem.weightInput === ''
    ? total
    : parseWeightInput(setItem.weightInput);
  if (!expression || expression.weight !== total.weight) return null;
  return expression.weightInput ? Number(expression.weightInput.split('x')[0]) : 1;
}

function getRecentNotation(workouts, exerciseId) {
  const records = [];
  workouts.forEach((workout, workoutIndex) => {
    const workoutTime = validTimestamp(workout.date) ?? validTimestamp(workout.completedAt) ?? validTimestamp(workout.updatedAt);
    (workout.exercises ?? []).forEach((exercise, entryIndex) => {
      if (exercise.exerciseId !== exerciseId) return;
      (exercise.sets ?? []).forEach((setItem, setIndex) => {
        const count = readNotation(setItem);
        if (count == null) return;
        records.push({ count, time: validTimestamp(setItem.savedAt) ?? workoutTime, workoutIndex, entryIndex, setIndex });
      });
    });
  });
  const dated = records.filter(record => record.time != null).sort((a, b) =>
    b.time - a.time || a.workoutIndex - b.workoutIndex || b.entryIndex - a.entryIndex || b.setIndex - a.setIndex);
  if (dated.length) return dated[0].count;
  // Imported legacy sets can lack dates. Infer only an unambiguous shared convention.
  const counts = new Set(records.map(record => record.count));
  return counts.size === 1 ? records[0].count : null;
}

function formatLoadSplit(weight, count) {
  const single = Number((weight / count).toFixed(10));
  const expression = `${count}x${String(single).replace('.', ',')}`;
  return parseWeightInput(expression)?.weight === weight ? expression : weight;
}

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
        if (setItem.weightMode === 'bodyweight' || setItem.weightMode === 'none') continue;
        add(setItem.weight);
        add(setItem.weightInput, setItem.weight);
      }
    }
  }

  const recentCount = getRecentNotation(workouts, exerciseId);
  return [...options.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([weight, expressions]) => recentCount != null
      ? [recentCount === 1 ? weight : formatLoadSplit(weight, recentCount)]
      : expressions.size ? [...expressions].sort() : [weight]);
}
