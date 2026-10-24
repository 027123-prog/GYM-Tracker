import assert from 'node:assert/strict';
import test from 'node:test';
import { editExerciseRecord, ensureExerciseRecord, getExerciseRemovalImpact, removeExerciseRecord, restoreExerciseRecord } from '../src/utils/exerciseEditing.js';
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

test('switching to no-weight reps or seconds changes only the exercise settings, never historical sets', () => {
  for (const measurementType of ['reps', 'duration']) {
    const before = fixture();
    const snapshot = structuredClone(before);
    const { state, error } = editExerciseRecord(before, 'row', {
      settings: { loadType: 'none', measurementType, bodyweightPercent: 'invalid stale value' },
    });
    assert.equal(error, null);
    assert.equal(state.exercises[0].settings.loadType, 'none');
    assert.equal(state.exercises[0].settings.measurementType, measurementType);
    assert.equal(state.exercises[0].settings.bodyweightPercent, 100);
    assert.equal(state.exercises[0].settings.setupNotes, before.exercises[0].settings.setupNotes);
    assert.strictEqual(state.workouts, before.workouts);
    assert.strictEqual(state.templates, before.templates);
    assert.deepEqual(before, snapshot);
    const restored = parseBackupPayload(JSON.stringify(createBackupPayload(state)));
    assert.equal(restored.exercises[0].settings.loadType, 'none');
    assert.deepEqual(restored.workouts[0].exercises[0].sets, before.workouts[0].exercises[0].sets);
  }
});

test('removing a used exercise archives it, removes template references and leaves every workout byte unchanged', () => {
  const before = fixture();
  before.templates[0].exerciseTemplates.push({ exerciseId: 'lat', name: 'Latzug', repScheme: '2 × 10' });
  before.workouts.push({ id: 'open', completedAt: null, exercises: [{ id: 'open-entry', exerciseId: 'row', name: 'Rudern', sets: [] }] });
  const snapshot = structuredClone(before);
  const archivedAt = '2026-10-24T15:00:00.000Z';
  const result = removeExerciseRecord(before, 'row', archivedAt);

  assert.equal(result.error, null);
  assert.equal(result.archived, true);
  assert.equal(result.deleted, false);
  assert.deepEqual(getExerciseRemovalImpact(before, 'row'), { archive: true, templateCount: 1 });
  assert.deepEqual(result.state.exercises[0], { ...before.exercises[0], archivedAt });
  assert.deepEqual(result.state.templates[0].exerciseTemplates, [before.templates[0].exerciseTemplates[1]]);
  assert.strictEqual(result.state.workouts, before.workouts);
  assert.strictEqual(result.state.maxStrengthRecords, before.maxStrengthRecords);
  assert.deepEqual(before, snapshot);

  const restoredBackup = parseBackupPayload(JSON.stringify(createBackupPayload(result.state)));
  assert.equal(restoredBackup.exercises.find((exercise) => exercise.id === 'row').archivedAt, archivedAt);
  assert.deepEqual(restoredBackup.workouts[0].exercises[0].sets, before.workouts[0].exercises[0].sets);
  assert.deepEqual(restoredBackup.workouts[0].exercises[0].machineSettings, before.workouts[0].exercises[0].machineSettings);
  assert.equal(removeExerciseRecord(result.state, 'row', '2026-10-25T15:00:00.000Z').state.exercises[0].archivedAt, archivedAt);
});

test('an exercise used only in a template is really deleted without disturbing other exercises', () => {
  const before = fixture();
  before.templates[0].exerciseTemplates.push({ exerciseId: 'lat', name: 'Latzug', repScheme: '2 × 10' });
  assert.deepEqual(getExerciseRemovalImpact(before, 'lat'), { archive: false, templateCount: 1 });
  const result = removeExerciseRecord(before, 'lat');
  assert.equal(result.archived, false);
  assert.equal(result.deleted, true);
  assert.deepEqual(result.state.exercises, [before.exercises[0]]);
  assert.deepEqual(result.state.templates[0].exerciseTemplates, [before.templates[0].exerciseTemplates[0]]);
  assert.strictEqual(result.state.workouts, before.workouts);
});

test('open empty entries and independent named strength history both prevent hard deletion', () => {
  const active = fixture();
  active.workouts = [{ id: 'open', completedAt: null, exercises: [{ exerciseId: 'lat', name: 'Latzug', sets: [] }] }];
  assert.equal(removeExerciseRecord(active, 'lat').archived, true);

  const strengthOnly = fixture();
  strengthOnly.workouts = [];
  const result = removeExerciseRecord(strengthOnly, 'row');
  assert.equal(result.archived, true);
  assert.strictEqual(result.state.maxStrengthRecords, strengthOnly.maxStrengthRecords);
});

test('restoring keeps the original ID, notes and history without silently rebuilding old templates', () => {
  const before = fixture();
  const archived = removeExerciseRecord(before, 'row').state;
  const result = restoreExerciseRecord(archived, 'row');
  assert.equal(result.error, null);
  assert.deepEqual(result.state.exercises[0], before.exercises[0]);
  assert.strictEqual(result.state.workouts, before.workouts);
  assert.strictEqual(result.state.templates, archived.templates);
  assert.deepEqual(result.state.templates[0].exerciseTemplates, []);
  assert.strictEqual(restoreExerciseRecord(before, 'row').state, before);
});

test('explicit reuse reactivates the original archived exercise instead of making another ID', () => {
  const before = fixture();
  const archived = removeExerciseRecord(before, 'row').state;
  const reused = ensureExerciseRecord(archived.exercises, ' RUDERN ');
  assert.deepEqual(reused.exercise, before.exercises[0]);
  assert.equal(reused.exercises.length, before.exercises.length);
  assert.equal(reused.exercise.archivedAt, undefined);
  assert.ok(archived.exercises[0].archivedAt, 'Input remains archived');

  const withActiveDuplicate = [...archived.exercises, { id: 'active-row', name: 'Rudern', weightOptions: [70] }];
  assert.equal(ensureExerciseRecord(withActiveDuplicate, 'Rudern').exercise.id, 'active-row');
});

test('restore conflicts and unknown removals never merge or mutate records', () => {
  const before = fixture();
  const archived = removeExerciseRecord(before, 'row').state;
  archived.exercises.push({ id: 'another-row', name: 'Rudern', settings: { setupNotes: 'other machine' } });
  const collision = restoreExerciseRecord(archived, 'row');
  assert.ok(collision.error);
  assert.strictEqual(collision.state, archived);
  const renamed = editExerciseRecord(archived, 'row', { name: 'Rudern altes Gerät' }).state;
  assert.equal(restoreExerciseRecord(renamed, 'row').error, null);
  const missing = removeExerciseRecord(before, 'missing');
  assert.ok(missing.error);
  assert.equal(missing.deleted, false);
  assert.strictEqual(missing.state, before);
});

test('unresolved legacy references are preserved by archiving and removed from templates', () => {
  const before = fixture();
  before.maxStrengthRecords = [];
  before.workouts[0].exercises[0].exerciseId = 'legacy-unresolved';
  before.templates[0].exerciseTemplates[0].exerciseId = 'legacy-unresolved';
  const result = removeExerciseRecord(before, 'row');
  assert.equal(result.archived, true);
  assert.deepEqual(result.state.templates[0].exerciseTemplates, []);
  assert.strictEqual(result.state.workouts, before.workouts);
});
