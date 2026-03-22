import { defaultData } from '../data/defaultData';

const STORAGE_KEY = 'gym-tracker-state-v1';
const NAME_MIGRATIONS = new Map([
  ['Bankdruecken', 'Bankdrücken'],
  ['Schulterdruecken', 'Schulterdrücken'],
  ['BankdrÃ¼cken', 'Bankdrücken'],
  ['SchulterdrÃ¼cken', 'Schulterdrücken'],
]);

function migrateName(value) {
  return NAME_MIGRATIONS.get(value) ?? value;
}

function mergeById(defaultItems, parsedItems = []) {
  const parsedMap = new Map(parsedItems.map((item) => [item.id, item]));

  return defaultItems.map((item) => parsedMap.get(item.id) ?? item).concat(parsedItems.filter((item) => !defaultItems.some((base) => base.id === item.id)));
}

function migrateLoadedState(state) {
  return {
    ...state,
    exercises: state.exercises.map((exercise) => ({
      ...exercise,
      name: migrateName(exercise.name),
    })),
    templates: state.templates.map((template) => ({
      ...template,
      exerciseTemplates: template.exerciseTemplates.map((exercise) => ({
        ...exercise,
        name: migrateName(exercise.name),
      })),
    })),
    workouts: state.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => ({
        ...exercise,
        name: migrateName(exercise.name),
      })),
    })),
  };
}

export function loadAppState() {
  if (typeof window === 'undefined') {
    return defaultData;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return defaultData;
  }

  try {
    const parsed = JSON.parse(raw);

    return migrateLoadedState({
      ...defaultData,
      ...parsed,
      exercises: mergeById(defaultData.exercises, Array.isArray(parsed.exercises) ? parsed.exercises : []),
      templates: mergeById(defaultData.templates, Array.isArray(parsed.templates) ? parsed.templates : []),
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : defaultData.workouts,
      meta: { ...defaultData.meta, ...parsed.meta },
    });
  } catch {
    return defaultData;
  }
}

export function saveAppState(state) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
