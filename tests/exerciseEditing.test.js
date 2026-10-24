import assert from 'node:assert/strict';
import test from 'node:test';
import { editExerciseRecord } from '../src/utils/exerciseEditing.js';
import { createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';
import { buildExerciseChartData, getExerciseWorkoutCount } from '../src/utils/workout.js';

function fixture() {
  return {
    exercises: [
      { id: 'row', name: 'Rudern', weightOptions: [30, 40], settings: { loadType: 'bodyweight-added', bodyweightPercent: 50, setupNotes: 'Sitz 4 · Griff 2' } },
      { id: 'lat', name: 'Latzug', weightOptions: [50], settings: { loadType: 'normal', bodyweightPercent: 100, setupNotes: 'Polster 3' } },
    ],
    templates: [{ id: 'a', name: 'A', exerciseTemplates: [{ exerciseId: 'row', name: 'Rudern', repScheme: '2 × 8–12' }] }],
    workouts: [{
      id: 'session', name: 'A', mode: 'template', templateId: 'a', date: '2026-10-24T12:00:00.000Z',
      completedAt: '2026-10-24T13:30:00.000Z', updatedAt: '2026-10-24T13:30:00.000Z',
      exercises: [{
        id: 'entry', exerciseId: 'row', name: 'Rudern', skipped: false, targetRepScheme: '2 × 8–12',
        machineSettings: [{ id: 'seat', label: 'Sitz', value: '4' }],
        sets: [{ id: 'set', weight: 40, reps: 10, comment: '2 in Reserve', seatHeight: '4', savedAt: '2026-10-24T12:15:00.000Z' }],
      }],
    }],
    maxStrengthRecords: [{ id: 'measurement', exerciseName: 'Rudern', value: 90, date: '2026-10-01' }],
  };
}

test('renaming keeps the exercise identity, settings and training data linked across templates and history', () => {
  const before = fixture();
  const snapshot = structuredClone(before);
  const { state, error } = editExerciseRecord(before, 'row', { name: '  Rudern am Kabel  ' });

  assert.equal(error, null);
  assert.deepEqual(before, snapshot, 'Input state must not be mutated');
  assert.equal(state.exercises.length, before.exercises.length);
  assert.deepEqual(state.exercises[0], { ...before.exercises[0], name: 'Rudern am Kabel' });
  assert.deepEqual(state.workouts[0], {
    ...before.workouts[0],
    exercises: [{ ...before.workouts[0].exercises[0], name: 'Rudern am Kabel' }],
  });
  assert.deepEqual(state.templates[0].exerciseTemplates[0], { ...before.templates[0].exerciseTemplates[0], name: 'Rudern am Kabel' });
  assert.deepEqual(state.maxStrengthRecords, before.maxStrengthRecords, 'Independent name-only strength measurements have no exercise-ID link');
  assert.equal(getExerciseWorkoutCount(state.workouts, 'row', 'Rudern am Kabel'), 1);
  assert.deepEqual(buildExerciseChartData(state.workouts, 'row', 'Rudern am Kabel'), buildExerciseChartData(before.workouts, 'row', 'Rudern'));

  const restored = parseBackupPayload(JSON.stringify(createBackupPayload(state)));
  assert.equal(restored.exercises.find((exercise) => exercise.id === 'row').name, 'Rudern am Kabel');
  assert.deepEqual(restored.workouts[0].exercises[0].sets, before.workouts[0].exercises[0].sets);
  assert.deepEqual(restored.workouts[0].exercises[0].machineSettings, before.workouts[0].exercises[0].machineSettings);
});

test('name and setup save together, while omitted settings remain intact', () => {
  const before = fixture();
  const { state, error } = editExerciseRecord(before, 'row', { name: 'Kabelrudern', settings: { setupNotes: 'Sitz 4 · Griff 2 · Ellbogen zurück' } });

  assert.equal(error, null);
  assert.deepEqual(state.exercises[0].settings, { ...before.exercises[0].settings, setupNotes: 'Sitz 4 · Griff 2 · Ellbogen zurück' });
  assert.deepEqual(state.exercises[0].weightOptions, [30, 40]);
});

test('empty or duplicate names reject the entire edit without a merge or lost settings', () => {
  const before = fixture();

  for (const name of ['', '   ', ' latzug ']) {
    const result = editExerciseRecord(before, 'row', { name, settings: { setupNotes: 'changed' } });
    assert.ok(result.error);
    assert.equal(result.state, before);
  }

  const missing = editExerciseRecord(before, 'missing', { name: 'Test' });
  assert.ok(missing.error);
  assert.equal(missing.state, before);
});

test('unchanged names in an existing duplicate catalog still allow editing machine notes', () => {
  const before = fixture();
  before.exercises.push({ id: 'duplicate', name: 'Rudern' });
  const result = editExerciseRecord(before, 'row', { name: 'Rudern', settings: { setupNotes: 'Sitz 5' } });

  assert.equal(result.error, null);
  assert.equal(result.state.exercises.length, 3);
  assert.equal(result.state.exercises[0].settings.setupNotes, 'Sitz 5');
  assert.equal(result.state.exercises[2].name, 'Rudern');
});

test('invalid load settings cannot partially rename an exercise', () => {
  const before = fixture();
  const result = editExerciseRecord(before, 'row', { name: 'Kabelrudern', settings: { bodyweightPercent: '0,5' } });

  assert.ok(result.error);
  assert.equal(result.state, before);
});
