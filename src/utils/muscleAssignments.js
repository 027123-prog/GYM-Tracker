import { EXERCISE_MUSCLE_RULES, MUSCLE_GROUPS } from '../data/exerciseMuscles';
import { CHEST_REGION_LABELS, resolveChestProfile } from '../data/chestRegions';

const nameKey = (name = '') => name.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
const rules = new Map(EXERCISE_MUSCLE_RULES.flatMap(rule => rule.names.map(name => [nameKey(name), rule])));
const canonicalRules = new Map(EXERCISE_MUSCLE_RULES.map(rule => [rule.names[0], rule]));
const statuses = ['draft_assigned', 'confirmed', 'tentative_variant', 'unassigned'];
const rolesMatch = (a, b) => ['primary', 'secondary', 'stabilizers'].every(role =>
  JSON.stringify(a[role] || []) === JSON.stringify(b[role] || []));

export function getExerciseMuscleAssignment(exercise) {
  const stored = exercise.muscleAssignment && typeof exercise.muscleAssignment === 'object' ? exercise.muscleAssignment : null;
  const candidate = stored?.ruleSource === 'catalogue'
    ? canonicalRules.get(stored.ruleKey) : rules.get(nameKey(exercise.name));
  // Old automatic drafts had no provenance. Upgrade only an exact known draft
  // fingerprint; explicit confirmations, custom roles and exclusions stay intact.
  const legacyDraft = stored && !stored.ruleSource && stored.status === 'draft_assigned' && candidate
    && [candidate, ...(candidate.previousAssignments || [])].some(prior => rolesMatch(stored, prior));
  const catalogueRule = candidate && (!stored || legacyDraft || (stored.ruleSource === 'catalogue' && stored.status === 'draft_assigned'));
  const rule = catalogueRule ? { ...stored, ...candidate,
    ...(stored?.analysis ? { analysis: stored.analysis } : {}),
    ...(stored?.variantDetails ? { variantDetails: stored.variantDetails } : {}),
    ...(stored?.chestProfile ? { chestProfile: stored.chestProfile } : {}),
  } : stored;
  if (!rule) return null;
  const result = { version: 1, status: statuses.includes(rule.status) ? rule.status : 'unassigned' };
  if (catalogueRule) Object.assign(result, { ruleSource: 'catalogue', ruleKey: candidate.names[0], ruleRevision: 2 });
  else if (stored?.ruleSource) {
    result.ruleSource = stored.ruleSource;
    if (stored.ruleKey) result.ruleKey = stored.ruleKey;
    if (stored.ruleRevision) result.ruleRevision = stored.ruleRevision;
  }
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
