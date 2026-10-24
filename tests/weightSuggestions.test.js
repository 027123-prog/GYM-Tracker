import test from 'node:test';
import assert from 'node:assert/strict';
import { getExerciseWeightSuggestions, getWeightSuggestionKey } from '../src/utils/weightSuggestions.js';
import { createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';

test('quick weights retain paired expressions from past and current sets, sorted by total load', () => {
  const workouts = [{ exercises: [
    { exerciseId: 'db', sets: [{ weight: 60, weightInput: '2x30' }, { weight: 25, weightInput: '2×12.50' }] },
    { exerciseId: 'other', sets: [{ weight: 40, weightInput: '2x20' }] },
  ] }, { exercises: [{ exerciseId: 'db', sets: [{ weight: 60, weightInput: '2x30.0' }] }] }];
  assert.deepEqual(getExerciseWeightSuggestions([40, 25, 60, 20], workouts, 'db'), [20, '2x12,5', 40, '2x30']);
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
