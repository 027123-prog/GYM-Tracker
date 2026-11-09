export function moveWorkoutExerciseRecord(state, workoutId, entryId, targetIndex, updatedAt = new Date().toISOString()) {
  const workout = state.workouts.find((item) => item.id === workoutId);
  const sourceIndex = workout?.exercises.findIndex((entry) => entry.id === entryId) ?? -1;

  if (!workout || sourceIndex < 0) {
    return { state, error: 'Die Übung wurde nicht gefunden.' };
  }

  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= workout.exercises.length) {
    return { state, error: 'Bitte eine gültige Position wählen.' };
  }

  if (sourceIndex === targetIndex) return { state, error: null };

  const exercises = [...workout.exercises];
  const [entry] = exercises.splice(sourceIndex, 1);
  exercises.splice(targetIndex, 0, entry);

  return {
    error: null,
    state: {
      ...state,
      workouts: state.workouts.map((item) => item.id === workoutId ? {
        ...item,
        exercises,
        updatedAt,
        ...(!item.completedAt ? { draftStartedAt: item.draftStartedAt || updatedAt } : {}),
      } : item),
    },
  };
}
