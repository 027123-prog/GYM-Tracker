import assert from 'node:assert/strict';
import test from 'node:test';
import { getExerciseMuscleAssignment, createAppMuscleMapping, getNewExerciseVariant } from '../src/utils/muscleAssignments.js';
import { normalizeAppState, createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';
import { editExerciseRecord } from '../src/utils/exerciseEditing.js';
import { getAnatomyRegion, ANATOMY_REGIONS } from '../src/data/anatomyRegions.js';
import { MUSCLE_GROUPS } from '../src/data/exerciseMuscles.js';

test('known exact aliases match while unknown exercises are not guessed from fragments', () => {
  assert.deepEqual(getExerciseMuscleAssignment({ name: 'Kniebeuge – Langhantel' }).primary, ['quads', 'glutes']);
  assert.equal(getExerciseMuscleAssignment({ name: 'Something resembling a bench exercise' }), null);
  assert.equal(getExerciseMuscleAssignment({ name: 'Brachio Curls' }).status, 'tentative_variant');
});

test('renaming and export/import preserve the assignment identity and all historical sets', () => {
  const state = normalizeAppState({ exercises: [{ id: 'e', name: 'Bankdrücken' }], templates: [], workouts: [
    { id: 'w', date: '2026-10-01', completedAt: '2026-10-01', exercises: [{ id: 'entry', exerciseId: 'e', name: 'Bankdrücken', sets: [{ id: 's', weight: 40, reps: 8 }] }] },
  ], maxStrengthRecords: [] });
  const before = structuredClone(state.workouts[0].exercises[0].sets);
  const renamed = editExerciseRecord(state, 'e', { name: 'My custom press' }).state;
  const roundtrip = parseBackupPayload(JSON.stringify(createBackupPayload(renamed)));
  assert.deepEqual(roundtrip.exercises[0].muscleAssignment, state.exercises[0].muscleAssignment);
  assert.deepEqual(roundtrip.workouts[0].exercises[0].sets, before);
  assert.deepEqual(createAppMuscleMapping(roundtrip.exercises).entries[0].primary, ['chest']);
});

test('a new deadlift gets a new variant without relabeling old workout entries', () => {
  const old = { id: 'w', date: '2026-10-01', completedAt: '2026-10-01', exercises: [{ id: 'old', exerciseId: 'e', name: 'Kreuzheben', sets: [] }] };
  const state = normalizeAppState({ exercises: [{ id: 'e', name: 'Kreuzheben' }], workouts: [old], templates: [], maxStrengthRecords: [] });
  assert.equal(getNewExerciseVariant(state.exercises[0]), 'floor_reset');
  assert.equal(state.workouts[0].exercises[0].variantKey, undefined);
  state.workouts[0].exercises[0].variantKey = 'floor_reset';
  assert.equal(parseBackupPayload(JSON.stringify(createBackupPayload(state))).workouts[0].exercises[0].variantKey, 'floor_reset');
});

test('archived and orphaned historical exercises retain their muscle mappings', () => {
  const result = createAppMuscleMapping([{ id: 'a', name: 'Seitheben Kabel', archivedAt: '2026-01-01' }], [
    { exercises: [{ exerciseId: 'removed', name: 'Beinpresse' }] },
  ]);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.find(item => item.exerciseId === 'removed').primary, ['quads', 'glutes']);
});

test('stored roles are validated, de-duplicated and can explicitly leave an exercise unmapped', () => {
  const assignment = getExerciseMuscleAssignment({ name: 'Bankdrücken', muscleAssignment: { status: 'confirmed', primary: ['chest', 'unknown'], secondary: ['chest', 'triceps'] } });
  assert.deepEqual(assignment.primary, ['chest']);
  assert.deepEqual(assignment.secondary, ['triceps']);
  assert.equal(getExerciseMuscleAssignment({ name: 'Bankdrücken', muscleAssignment: { status: 'unassigned' } }).status, 'unassigned');
});

test('anatomy regions cover all training groups without assigning one structure twice', () => {
  assert.deepEqual(Object.keys(ANATOMY_REGIONS).sort(), Object.keys(MUSCLE_GROUPS).sort());
  const keys = Object.values(ANATOMY_REGIONS).flat();
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(getAnatomyRegion('trapezius_upper'), 'upper_traps');
  assert.equal(getAnatomyRegion('trapezius_lower'), 'upper_back');
  assert.equal(getAnatomyRegion('gluteus_maximus'), 'glutes');
  assert.equal(getAnatomyRegion('subscapularis'), null, 'not an external shoulder rotator');
});
