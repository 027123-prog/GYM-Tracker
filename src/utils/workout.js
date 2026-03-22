export function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function calculateWorkoutStats(workout) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const totalVolume = sets.reduce((sum, setItem) => sum + Number(setItem.weight || 0) * Number(setItem.reps || 0), 0);

  return {
    exerciseCount: workout.exercises.length,
    setCount: sets.length,
    totalVolume,
  };
}

export function getLastExerciseWeight(workouts, exerciseId) {
  const sorted = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const workout of sorted) {
    const matchingExercise = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    const setItem = matchingExercise?.sets?.[matchingExercise.sets.length - 1];

    if (setItem?.weight) {
      return setItem.weight;
    }
  }

  return null;
}

export function buildExerciseChartData(workouts, exerciseId) {
  return workouts
    .filter((workout) => workout.completedAt)
    .map((workout) => {
      const matchingExercise = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId);

      if (!matchingExercise || matchingExercise.skipped || !matchingExercise.sets.length) {
        return null;
      }

      const maxWeight = Math.max(...matchingExercise.sets.map((setItem) => Number(setItem.weight || 0)));
      const maxSet = matchingExercise.sets.find((setItem) => Number(setItem.weight || 0) === maxWeight);

      return {
        date: workout.date,
        shortDate: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(workout.date)),
        volume: matchingExercise.sets.reduce(
          (sum, setItem) => sum + Number(setItem.weight || 0) * Number(setItem.reps || 0),
          0,
        ),
        maxWeight,
        maxWeightReps: maxSet?.reps ?? 0,
        sets: matchingExercise.sets,
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
