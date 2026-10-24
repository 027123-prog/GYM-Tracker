import { parseLocalizedNumber } from './bodyweight';

function nameKey(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export function editExerciseRecord(state, exerciseId, changes = {}) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    return { state, error: 'Die Übung wurde nicht gefunden.' };
  }

  const name = changes.name === undefined ? exercise.name : String(changes.name).trim();

  if (!name) {
    return { state, error: 'Bitte einen Übungsnamen eingeben.' };
  }

  // A rename must not silently merge two exercises or split their histories.
  if (
    nameKey(name) !== nameKey(exercise.name) &&
    state.exercises.some((item) => item.id !== exerciseId && nameKey(item.name) === nameKey(name))
  ) {
    return { state, error: 'Eine andere Übung heißt bereits so. Bitte einen eindeutigen Namen wählen.' };
  }

  let settings = exercise.settings;

  if (changes.settings) {
    const merged = { ...exercise.settings, ...changes.settings };
    const loadType = ['bodyweight', 'bodyweight-added'].includes(merged.loadType) ? merged.loadType : 'normal';
    const percent = parseLocalizedNumber(merged.bodyweightPercent ?? 100);

    if (loadType !== 'normal' && (!Number.isFinite(percent) || percent < 1 || percent > 300)) {
      return { state, error: 'Der Körpergewichtsanteil muss zwischen 1 und 300 Prozent liegen.' };
    }

    settings = {
      ...merged,
      loadType,
      ...(merged.measurementType ? { measurementType: merged.measurementType === 'duration' ? 'duration' : 'reps' } : {}),
      bodyweightPercent: loadType === 'normal' ? 100 : percent,
      setupNotes: merged.setupNotes?.trim() ?? '',
    };
  }

  const renamed = name !== exercise.name;
  const renameEntry = (entry) => entry.exerciseId === exerciseId ? { ...entry, name } : entry;

  return {
    error: null,
    state: {
      ...state,
      exercises: state.exercises.map((item) => item.id === exerciseId ? { ...item, name, settings } : item),
      // Only the label changes. IDs, sets, machine settings and timestamps stay intact.
      workouts: renamed
        ? state.workouts.map((workout) => ({ ...workout, exercises: workout.exercises.map(renameEntry) }))
        : state.workouts,
      templates: renamed
        ? state.templates.map((template) => ({ ...template, exerciseTemplates: template.exerciseTemplates.map(renameEntry) }))
        : state.templates,
    },
  };
}
