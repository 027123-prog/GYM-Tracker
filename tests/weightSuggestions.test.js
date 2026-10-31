import test from 'node:test';
import assert from 'node:assert/strict';
import { getExerciseWeightSuggestions, getWeightSuggestionKey } from '../src/utils/weightSuggestions.js';
import { createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';

test('quick weights apply a consistent paired convention to every total, sorted by load', () => {
  const workouts = [{ exercises: [
    { exerciseId: 'db', sets: [{ weight: 60, weightInput: '2x30' }, { weight: 25, weightInput: '2×12.50' }] },
    { exerciseId: 'other', sets: [{ weight: 40, weightInput: '2x20' }] },
  ] }, { exercises: [{ exerciseId: 'db', sets: [{ weight: 60, weightInput: '2x30.0' }] }] }];
  assert.deepEqual(getExerciseWeightSuggestions([40, 25, 60, 20], workouts, 'db'), ['2x10', '2x12,5', '2x20', '2x30']);
  assert.equal(getWeightSuggestionKey('2x12.5'), getWeightSuggestionKey('2x12,50'));
  assert.notEqual(getWeightSuggestionKey('60'), getWeightSuggestionKey('2x30'));
});

test('different explicit load splits remain available, inconsistent and bodyweight expressions are ignored', () => {
  const workouts = [{ exercises: [{ exerciseId: 'db', sets: [
    { weight: 60, weightInput: '2x30' },
    { weight: 60, weightInput: '3x20' },
    { weight: 40, weightInput: '2x30' },
    { weight: 70, weightInput: '2x35', weightMode: 'bodyweight' },
    { weight: 0, measurementType: 'duration', durationSeconds: 30 },
  ] }] }];
  assert.deepEqual(getExerciseWeightSuggestions([60, 'bad', -1], workouts, 'db'), [0, 40, '2x30', '3x20']);
  assert.deepEqual(getExerciseWeightSuggestions([20, 30], [], 'db'), [20, 30]);
});

test('paired quick selections survive backup roundtrip without changing legacy numeric options', () => {
  const backup = { exercises: [{ id: 'db', name: 'DB', weightOptions: [60] }], templates: [], maxStrengthRecords: [],
    workouts: [{ id: 'w', name: 'Workout', date: '2026-10-24T12:00:00Z', completedAt: '2026-10-24T13:00:00Z',
      exercises: [{ id: 'e', exerciseId: 'db', name: 'DB', sets: [{ id: 's', weight: 60, weightInput: '2x30', reps: 8 }] }] }] };
  const state = parseBackupPayload(JSON.stringify(createBackupPayload(backup)));
  assert.deepEqual(state.exercises[0].weightOptions, [60]);
  assert.deepEqual(getExerciseWeightSuggestions(state.exercises[0].weightOptions, state.workouts, 'db'), ['2x30']);
});

test('no-weight sets do not add zero or stale weights to suggestions', () => {
  const workouts = [{ exercises: [{ exerciseId: 'raise', sets: [
    { weightMode: 'none', weight: 0, reps: 12 },
    { weightMode: 'none', weight: 60, weightInput: '2x30', reps: 12 },
    { weight: 20, reps: 10 },
  ] }] }];
  assert.deepEqual(getExerciseWeightSuggestions([], workouts, 'raise'), [20]);
});

test('the most recent same-exercise notation formats all proposals without changing historical totals', () => {
  const workouts = [
    { date: '2026-10-31', exercises: [{ exerciseId: 'db', sets: [{ weight: 24, weightInput: '2x12', reps: 10 }] }] },
    { date: '2026-10-30', exercises: [{ exerciseId: 'db', sets: [{ weight: 30, reps: 8 }] }] },
    { date: '2026-11-01', exercises: [{ exerciseId: 'other', sets: [{ weight: 60, reps: 8 }] }] },
  ];
  const snapshot = structuredClone(workouts);
  const options = [24, 28, 32, 40];
  assert.deepEqual(getExerciseWeightSuggestions(options, workouts, 'db'), ['2x12', '2x14', '2x15', '2x16', '2x20']);
  assert.deepEqual(workouts, snapshot);
  assert.deepEqual(options, [24, 28, 32, 40]);
  assert.deepEqual(getExerciseWeightSuggestions([], workouts, 'other'), [60]);
});

test('a recent numeric entry switches the exercise back to total-load proposals', () => {
  const workouts = [
    { date: '2026-10-31', exercises: [{ exerciseId: 'db', sets: [{ weight: 28, reps: 8 }] }] },
    { date: '2026-10-29', exercises: [{ exerciseId: 'db', sets: [{ weight: 24, weightInput: '2x12', reps: 8 }] }] },
  ];
  assert.deepEqual(getExerciseWeightSuggestions([32], workouts, 'db'), [24, 28, 32]);
});

test('saved timestamps determine the latest notation, with final set order as deterministic fallback', () => {
  const workouts = [{ date: '2026-10-31', exercises: [{ exerciseId: 'db', sets: [
    { weight: 24, weightInput: '2x12', savedAt: '2026-10-31T12:05:00Z' },
    { weight: 28, savedAt: '2026-10-31T12:00:00Z' },
  ] }] }];
  assert.deepEqual(getExerciseWeightSuggestions([32], workouts, 'db'), ['2x12', '2x14', '2x16']);
  workouts[0].exercises[0].sets.forEach(set => delete set.savedAt);
  assert.deepEqual(getExerciseWeightSuggestions([32], workouts, 'db'), [24, 28, 32]);
});

test('invalid splits, unloaded warm-ups and bodyweight entries cannot override the learned convention', () => {
  const workouts = [
    { date: '2026-11-01', exercises: [{ exerciseId: 'db', sets: [
      { weight: 0, reps: 5 },
      { weight: 28, weightInput: '2x30', reps: 8 },
      { weight: 70, weightInput: '2x35', weightMode: 'bodyweight' },
      { weight: 50, weightMode: 'none' },
    ] }] },
    { date: '2026-10-31', exercises: [{ exerciseId: 'db', sets: [{ weight: 24, weightInput: '2x12' }] }] },
  ];
  assert.deepEqual(getExerciseWeightSuggestions([32], workouts, 'db'), ['2x0', '2x12', '2x14', '2x16']);
});
