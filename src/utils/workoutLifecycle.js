export function resumeWorkoutRecord(workout, timestamp = new Date().toISOString()) {
  if (!workout?.completedAt) {
    return workout;
  }

  return {
    ...workout,
    completedAt: null,
    updatedAt: timestamp,
    draftStartedAt: workout.draftStartedAt || workout.date || timestamp,
  };
}
