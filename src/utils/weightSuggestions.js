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
  // Explicit paired sets describe their own mode. Once the exercise is changed
  // back to total-load input they must not silently reactivate paired notation.
  if (setItem.weightMode === 'paired') return 1;
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

export function getExerciseWeightSuggestions(weightOptions = [], workouts = [], exerciseId, settings = {}) {
  const options = new Map();
  // Keep the last six recorded sessions within 90 days of the latest session.
  // A break from an exercise should not empty its useful starting suggestions.
  const sessions = workouts.filter(workout => (workout.exercises ?? []).some(entry =>
    entry.exerciseId === exerciseId && !entry.skipped && entry.sets?.length))
    .map(workout => ({ workout, time: validTimestamp(workout.date) ?? validTimestamp(workout.completedAt) }))
    .sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));
  const latest = sessions.find(session => session.time != null)?.time;
  const recent = new Set(sessions.filter((session, index) => session.time == null ||
    (index < 6 && latest - session.time <= 90 * 86400000)).map(session => session.workout));
  const recorded = new Set();
  const current = new Set();
  for (const { workout } of sessions) {
    for (const entry of workout.exercises ?? []) {
      if (entry.exerciseId !== exerciseId || entry.skipped) continue;
      for (const item of entry.sets ?? []) {
        if (item.weightMode === 'bodyweight' || item.weightMode === 'none') continue;
        const parsed = parseWeightInput(item.weight);
        if (!parsed) continue;
        recorded.add(parsed.weight);
        if (recent.has(workout)) current.add(parsed.weight);
      }
    }
  }

  function add(value, expectedWeight) {
    const parsed = parseWeightInput(value);
    if (!parsed || (expectedWeight !== undefined && parsed.weight !== Number(expectedWeight))) return;
    if (!options.has(parsed.weight)) options.set(parsed.weight, new Set());
    if (parsed.weightInput) options.get(parsed.weight).add(getWeightSuggestionKey(value));
  }

  weightOptions.forEach(value => {
    const parsed = parseWeightInput(value);
    // Preserve manually configured, never-used options; hide known obsolete loads.
    if (parsed && (!recorded.has(parsed.weight) || current.has(parsed.weight))) add(value);
  });
  const recentWorkouts = workouts.filter(workout => recent.has(workout));
  for (const workout of recentWorkouts) {
    for (const exercise of workout.exercises ?? []) {
      if (exercise.exerciseId !== exerciseId || exercise.skipped) continue;
      for (const setItem of exercise.sets ?? []) {
        if (setItem.weightMode === 'bodyweight' || setItem.weightMode === 'none') continue;
        add(setItem.weight);
        add(setItem.weightInput, setItem.weight);
      }
    }
  }

  // Stored options and historical sets always contain total loads. An explicit
  // paired setting takes precedence over any notation learned from old sets.
  if (settings?.loadType === 'paired') {
    return [...options.keys()].sort((left, right) => left - right).map(weight => weight / 2);
  }

  const recentCount = getRecentNotation(recentWorkouts, exerciseId);
  return [...options.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([weight, expressions]) => recentCount != null
      ? [recentCount === 1 ? weight : formatLoadSplit(weight, recentCount)]
      : expressions.size ? [...expressions].sort() : [weight]);
}
