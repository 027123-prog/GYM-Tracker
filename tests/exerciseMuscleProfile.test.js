import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExerciseMuscleProfile, normalizeExerciseLibraryLayout } from '../src/utils/exerciseMuscleProfile.js';
import { muscleLoadColor } from '../src/utils/muscleLoadColor.js';

test('exercise profiles show primary work, assistance and visible light stabilization in descending order', () => {
  const profile = buildExerciseMuscleProfile({ name: 'Kniebeuge - Langhantel' });
  assert.equal(profile.status, 'assigned');
  assert.equal(profile.rows.find(row => row.id === 'quads').weight, 1);
  assert.equal(profile.rows.find(row => row.id === 'adductors').weight, 0.35);
  const stabilizer = profile.rows.find(row => row.id === 'spinal_erectors');
  assert.equal(stabilizer.roleLabel, 'Stabilisierung');
  assert.equal(stabilizer.strengthLabel, 'Leicht');
  assert.notEqual(stabilizer.color, muscleLoadColor(0));
  assert.ok(profile.rows.every((row, index) => !index || profile.rows[index - 1].weight >= row.weight));
  for (const row of profile.rows) assert.equal(profile.muscles[row.id].intensity, row.intensity);
});

test('incline and flat presses retain their distinct chest region emphasis without listing the aggregate twice', () => {
  const flat = buildExerciseMuscleProfile({ name: 'Bankdrücken - Hantel' });
  const incline = buildExerciseMuscleProfile({ name: 'schrägbankdrücken hantel' });
  assert.equal(incline.rows[0].id, 'chest_upper');
  assert.equal(flat.rows[0].id, 'chest_middle');
  assert.equal(incline.rows.find(row => row.id === 'chest_lower').weight, 0.5);
  assert.ok(!incline.rows.some(row => row.id === 'chest'));
  assert.ok(incline.rows.some(row => row.id === 'triceps'));
});

test('unresolved variants and unknown exercises remain explicitly unassigned instead of receiving invented colors', () => {
  for (const name of ['Brachio Curls', 'custom unknown movement']) {
    const profile = buildExerciseMuscleProfile({ name });
    assert.notEqual(profile.status, 'assigned');
    assert.deepEqual(profile.rows, []);
    assert.deepEqual(profile.muscles, {});
  }
  assert.equal(buildExerciseMuscleProfile({ name: 'Brachio Curls' }).status, 'tentative');
});

test('exercise profiles respect confirmed custom mappings and never alter exercises or historical values', () => {
  const exercise = { id: 'custom', name: 'Bankdrücken', settings: { loadType: 'paired' },
    weightOptions: [40], muscleAssignment: { status: 'confirmed', primary: ['lats'], secondary: ['elbow_flexors'], stabilizers: [] } };
  const snapshot = structuredClone(exercise);
  const profile = buildExerciseMuscleProfile(exercise);
  assert.deepEqual(profile.rows.map(row => row.id), ['lats', 'elbow_flexors']);
  assert.deepEqual(exercise, snapshot);
  assert.equal(buildExerciseMuscleProfile({ ...exercise, weightOptions: [100] }).rows[0].weight, 1);
});

test('an explicitly excluded mapping is not revived just because its name matches the catalogue', () => {
  const profile = buildExerciseMuscleProfile({ name: 'Kreuzheben', muscleAssignment: { status: 'unassigned', primary: [], secondary: [], stabilizers: [] } });
  assert.equal(profile.status, 'unassigned');
  assert.deepEqual(profile.muscles, {});
});

test('layout parsing preserves old graph/list URLs and supports the new body view', () => {
  assert.equal(normalizeExerciseLibraryLayout('body'), 'body');
  assert.equal(normalizeExerciseLibraryLayout('list'), 'list');
  for (const value of [null, undefined, '', 'graph', 'preview', 'unrecognized']) assert.equal(normalizeExerciseLibraryLayout(value), 'graph');
});
