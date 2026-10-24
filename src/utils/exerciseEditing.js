import { parseLocalizedNumber } from './bodyweight';
import { createId } from './workout';

function nameKey(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export function findExerciseByName(exercises, name) {
  const matches = exercises.filter((exercise) => nameKey(exercise.name) === nameKey(name));
  return matches.find((exercise) => !exercise.archivedAt) ?? matches[0];
}

export function ensureExerciseRecord(exercises, name) {
  const trimmedName = name.trim();
  const existing = findExerciseByName(exercises, trimmedName);

  if (existing) {
    if (!existing.archivedAt) return { exercises, exercise: existing };
    const { archivedAt, ...restored } = existing;
    return {
      exercises: exercises.map((exercise) => exercise.id === existing.id ? restored : exercise),
      exercise: restored,
    };
  }

  const exercise = {
    id: createId('exercise'),
    name: trimmedName,
    weightOptions: [],
    settings: { loadType: 'normal', bodyweightPercent: 100, setupNotes: '' },
    createdAt: new Date().toISOString(),
  };
  return { exercises: [...exercises, exercise], exercise };
}

export function referencesExercise(entry, exercise, knownIds) {
  return entry.exerciseId === exercise.id || (
    !knownIds.has(entry.exerciseId) && nameKey(entry.name ?? '') === nameKey(exercise.name)
  );
}

export function getExerciseRemovalImpact(state, exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return { archive: false, templateCount: 0 };
  const knownIds = new Set(state.exercises.map((item) => item.id));
  const isReference = (entry) => referencesExercise(entry, exercise, knownIds);
  const hasWorkoutReference = state.workouts.some((workout) => workout.exercises.some(isReference));
  const hasNamedStrengthHistory = (state.maxStrengthRecords ?? []).some((record) => nameKey(record.exerciseName ?? '') === nameKey(exercise.name));

  return {
    archive: hasWorkoutReference || hasNamedStrengthHistory,
    templateCount: state.templates.filter((template) => template.exerciseTemplates.some(isReference)).length,
  };
}

export function removeExerciseRecord(state, exerciseId, archivedAt = new Date().toISOString()) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return { state, error: 'Die Übung wurde nicht gefunden.', archived: false, deleted: false };
  const { archive } = getExerciseRemovalImpact(state, exerciseId);
  const knownIds = new Set(state.exercises.map((item) => item.id));

  return {
    error: null,
    archived: archive,
    deleted: !archive,
    state: {
      ...state,
      exercises: archive
        ? state.exercises.map((item) => item.id === exerciseId ? { ...item, archivedAt: item.archivedAt || archivedAt } : item)
        : state.exercises.filter((item) => item.id !== exerciseId),
      templates: state.templates.map((template) => ({
        ...template,
        exerciseTemplates: template.exerciseTemplates.filter((entry) => !referencesExercise(entry, exercise, knownIds)),
      })),
      // Every workout remains intact, including open workouts and empty entries.
    },
  };
}

export function restoreExerciseRecord(state, exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return { state, error: 'Die Übung wurde nicht gefunden.' };
  if (!exercise.archivedAt) return { state, error: null };
  if (state.exercises.some((item) => item.id !== exerciseId && !item.archivedAt && nameKey(item.name) === nameKey(exercise.name))) {
    return { state, error: 'Eine aktive Übung heißt bereits so. Bitte die archivierte Übung zuerst umbenennen.' };
  }
  const { archivedAt, ...restored } = exercise;
  return {
    error: null,
    state: { ...state, exercises: state.exercises.map((item) => item.id === exerciseId ? restored : item) },
  };
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
