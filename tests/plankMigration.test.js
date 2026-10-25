import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeConfirmedPlankRecords } from '../src/utils/plankMigration.js';
import { loadAppState, normalizeAppState, PRE_PLANK_MERGE_BACKUP_KEY, saveAppState, STORAGE_KEY } from '../src/utils/storage.js';

const sourceId = 'exercise-coaching-20261012-plank';
const targetId = 'exercise-13ea6217-00e7-4221-8f15-ad653b68883f';
const date = '2026-10-25T10:00:00.000Z';
const entry = (id, exerciseId, name, sets) => ({ id, exerciseId, name, sets, machineSettings: [{ id: `setting-${id}`, label: 'Position', value: id }], targetRepScheme: '2 × 30 s', skipped: false });

function fixture() {
  return {
    exercises: [
      { id: sourceId, name: 'Plank', weightOptions: [5], settings: { loadType: 'none', measurementType: 'duration', bodyweightPercent: 100, setupNotes: 'Bauch und Gesäß fest.' } },
      { id: targetId, name: 'Plank weit', weightOptions: [10], settings: { loadType: 'none', measurementType: 'duration', bodyweightPercent: 100, setupNotes: 'Hände weit vor.' } },
      { id: 'side-plank', name: 'Side Plank', weightOptions: [], settings: { loadType: 'none', measurementType: 'duration', setupNotes: 'Seitlich stützen.' } },
      { id: 'independent-plank', name: 'Plank', weightOptions: [], settings: {} },
    ],
    templates: [{ id: 'template-a', name: 'Ganzkörper A', exerciseTemplates: [{ exerciseId: sourceId, name: 'Plank', repScheme: '2 × 30 s' }, { exerciseId: 'side-plank', name: 'Side Plank', repScheme: '2 × 20 s' }] }],
    workouts: [
      { id: 'complete', name: 'Fertig', date, completedAt: date, exercises: [
        entry('source-entry', sourceId, 'Plank', [{ id: 'timed', weight: 0, weightMode: 'none', reps: 0, measurementType: 'duration', durationSeconds: 53, comment: 'Mit Reserve', savedAt: date, seatHeight: '' }]),
        entry('target-entry', targetId, 'Plank weit', [{ id: 'legacy', weight: 93, reps: 1, comment: 'Historisch ohne Zeit', savedAt: date, seatHeight: '' }]),
      ] },
      { id: 'active', name: 'Läuft', date, completedAt: null, draftStartedAt: date, exercises: [entry('active-entry', sourceId, 'Plank', [{ id: 'recent', weight: 0, weightMode: 'none', reps: 0, measurementType: 'duration', durationSeconds: 56, comment: 'Gerade gespeichert', savedAt: date, seatHeight: '' }])] },
    ],
    maxStrengthRecords: [{ id: 'max-unrelated', exerciseName: 'Beinpresse', date, value: 100 }],
    meta: { storageVersion: 2 },
  };
}

test('confirmed Plank merge preserves both same-workout entries, active workout, sets and settings', () => {
  const original = fixture();
  const before = structuredClone(original);
  const result = mergeConfirmedPlankRecords(original);
  assert.deepEqual(original, before);
  assert.equal(result.exercises.length, original.exercises.length - 1);
  assert(!result.exercises.some((exercise) => exercise.id === sourceId));
  const target = result.exercises.find((exercise) => exercise.id === targetId);
  assert.equal(target.name, 'Plank weit');
  assert.equal(target.settings.setupNotes, 'Hände weit vor.\nBauch und Gesäß fest.');
  assert.equal(target.settings.loadType, original.exercises[1].settings.loadType);
  assert.equal(target.settings.measurementType, original.exercises[1].settings.measurementType);
  assert.deepEqual(target.weightOptions, [5, 10]);
  assert.deepEqual(result.maxStrengthRecords, original.maxStrengthRecords);
  assert.equal(result.templates[0].exerciseTemplates[0].exerciseId, targetId);
  assert.equal(result.templates[0].exerciseTemplates[0].name, 'Plank weit');
  assert.deepEqual(result.templates[0].exerciseTemplates[1], original.templates[0].exerciseTemplates[1]);
  result.workouts.forEach((workout, workoutIndex) => {
    assert.deepEqual({ ...workout, exercises: undefined }, { ...original.workouts[workoutIndex], exercises: undefined });
    assert.equal(workout.exercises.length, original.workouts[workoutIndex].exercises.length);
    workout.exercises.forEach((item, entryIndex) => {
      const old = original.workouts[workoutIndex].exercises[entryIndex];
      assert.deepEqual(item, { ...old, exerciseId: targetId, name: 'Plank weit' });
    });
  });
  assert.equal(result.workouts[0].exercises[1].sets[0].durationSeconds, undefined);
  assert.deepEqual(result.exercises.filter((exercise) => ![sourceId, targetId].includes(exercise.id)), original.exercises.filter((exercise) => ![sourceId, targetId].includes(exercise.id)));
});

test('merge is idempotent and never resets a later rename or target settings', () => {
  const first = mergeConfirmedPlankRecords(fixture());
  assert.equal(mergeConfirmedPlankRecords(first), first);
  const renamed = structuredClone(first);
  const target = renamed.exercises.find((exercise) => exercise.id === targetId);
  target.name = 'Langer Unterarmstütz';
  target.settings.setupNotes = 'Aktualisierte eigene Hinweise';
  assert.equal(mergeConfirmedPlankRecords(renamed), renamed);
  const normalized = normalizeAppState(first);
  assert.deepEqual(normalizeAppState(normalized), normalized);
});

test('matching names without the confirmed IDs remain independent', () => {
  const data = fixture();
  data.exercises = data.exercises.map((exercise) => ({ ...exercise, id: `independent-${exercise.id}` }));
  data.templates = [];
  data.workouts = [];
  assert.equal(mergeConfirmedPlankRecords(data), data);
});

test('a missing target is recreated from the confirmed source without losing its notes', () => {
  const data = fixture();
  data.exercises = data.exercises.filter((exercise) => exercise.id !== targetId);
  const result = mergeConfirmedPlankRecords(data);
  const target = result.exercises.find((exercise) => exercise.id === targetId);
  assert.equal(target.name, 'Plank weit');
  assert.deepEqual(target.settings, data.exercises.find((exercise) => exercise.id === sourceId).settings);
  assert.equal(result.workouts[1].exercises[0].exerciseId, targetId);
});

test('orphaned confirmed references use the surviving target without overwriting a later name', () => {
  const data = fixture();
  data.exercises = data.exercises.filter((exercise) => exercise.id !== sourceId);
  data.exercises.find((exercise) => exercise.id === targetId).name = 'Langer Unterarmstütz';
  const result = mergeConfirmedPlankRecords(data);
  assert.equal(result.workouts[1].exercises[0].name, 'Langer Unterarmstütz');
  assert.equal(result.workouts[1].exercises[0].exerciseId, targetId);
  assert.equal(mergeConfirmedPlankRecords(result), result);
});

test('loading existing browser data backs up the original and preserves current drafts', () => {
  const raw = JSON.stringify(fixture());
  const values = new Map([[STORAGE_KEY, raw]]);
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage };
  try {
    const state = loadAppState();
    assert.equal(localStorage.getItem(PRE_PLANK_MERGE_BACKUP_KEY), raw);
    assert.equal(state.workouts.find((workout) => workout.id === 'active').completedAt, null);
    assert.equal(state.workouts.find((workout) => workout.id === 'active').exercises[0].sets[0].id, 'recent');
    saveAppState(state);
    assert.deepEqual(loadAppState(), state);
    assert.equal(localStorage.getItem(PRE_PLANK_MERGE_BACKUP_KEY), raw);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
