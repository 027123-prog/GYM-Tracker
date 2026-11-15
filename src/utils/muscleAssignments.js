import { EXERCISE_MUSCLE_RULES, MUSCLE_GROUPS } from '../data/exerciseMuscles';
import { CHEST_REGION_LABELS, resolveChestProfile } from '../data/chestRegions';

const nameKey = (name = '') => name.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
const rules = new Map(EXERCISE_MUSCLE_RULES.flatMap(rule => rule.names.map(name => [nameKey(name), rule])));
const statuses = ['draft_assigned', 'confirmed', 'tentative_variant', 'unassigned'];

export function getExerciseMuscleAssignment(exercise) {
  const stored = exercise.muscleAssignment;
  const rule = stored && typeof stored === 'object' ? stored : rules.get(nameKey(exercise.name));
  if (!rule) return null;
  const result = { version: 1, status: statuses.includes(rule.status) ? rule.status : 'unassigned' };
  const seen = new Set();
  for (const role of ['primary', 'secondary', 'stabilizers']) {
    result[role] = (Array.isArray(rule[role]) ? rule[role] : []).filter(id => {
      if (!Object.hasOwn(MUSCLE_GROUPS, id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if (rule.analysis) result.analysis = { ...rule.analysis };
  if (rule.variantDetails) result.variantDetails = { ...rule.variantDetails };
  if (['primary', 'secondary', 'stabilizers'].some(role => result[role].some(id => id === 'chest' || Object.hasOwn(CHEST_REGION_LABELS, id)))) {
    result.chestProfile = resolveChestProfile(rule, exercise.name);
  }
  return result;
}

export function createAppMuscleMapping(exercises = [], workouts = []) {
  const records = new Map(exercises.map(exercise => [exercise.id, exercise]));
  // Removed catalogue entries can still have identifiable historical names.
  for (const workout of workouts) {
    for (const entry of workout.exercises || []) {
      if (!records.has(entry.exerciseId)) records.set(entry.exerciseId, { id: entry.exerciseId, name: entry.name });
    }
  }
  const entries = [];
  for (const exercise of records.values()) {
    const assignment = getExerciseMuscleAssignment(exercise);
    if (assignment) entries.push({ exerciseId: exercise.id, ...assignment });
  }
  return { groups: MUSCLE_GROUPS, entries };
}

export function getNewExerciseVariant(exercise) {
  return getExerciseMuscleAssignment(exercise)?.variantDetails?.variantKey || null;
}
