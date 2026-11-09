import assert from 'node:assert/strict';
import test from 'node:test';
import { moveWorkoutExerciseRecord } from '../src/utils/workoutEditing.js';
import { readWorkoutExerciseIndex, saveWorkoutExercisePosition } from '../src/utils/workoutNavigation.js';
import { calculateWorkoutStats } from '../src/utils/workout.js';
import { createBackupPayload, normalizeAppState, parseBackupPayload } from '../src/utils/storage.js';

function fixture() {
  return {
    exercises: [{ id: 'row', name: 'Rudern', settings: { loadType: 'paired' } }],
    templates: [{ id: 'template', name: 'Plan', exerciseTemplates: [{ exerciseId: 'row', name: 'Rudern' }] }],
    workouts: [{
      id: 'workout', name: 'Training', mode: 'free',
      date: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:30:00.000Z',
      completedAt: null, draftStartedAt: '2026-11-09T10:00:00.000Z',
      exercises: [
        { id: 'first', exerciseId: 'row', name: 'Rudern', skipped: false, sets: [{ id: 'a', weight: 40, reps: 10, savedAt: '2026-11-09T10:05:00.000Z' }] },
        { id: 'second', exerciseId: 'row', name: 'Rudern', targetRepScheme: '2 × 12', skipped: false,
          machineSettings: [{ label: 'Sitz', value: '3' }], custom: 'Behalten',
          sets: [{ id: 'b', weight: 50, weightInput: '2x25', weightMode: 'paired', individualWeight: 25, reps: 12, comment: 'Sauber', savedAt: '2026-11-09T10:10:00.000Z' },
            { id: 'c', measurementType: 'duration', durationSeconds: 30, weight: 50, savedAt: '2026-11-09T10:15:00.000Z' }],
        },
        { id: 'third', exerciseId: 'unknown', name: 'Dritte Übung', skipped: true, sets: [] },
        { id: 'fourth', exerciseId: 'row', name: 'Rudern', sets: [] },
      ],
    }, { id: 'other', name: 'Vorheriges Training', completedAt: '2026-11-08T12:00:00.000Z', exercises: [] }],
    maxStrengthRecords: [], meta: { retained: true },
  };
}

test('moving an exercise with recorded sets preserves all entry data and changes only this workout order', () => {
  const before = fixture();
  const snapshot = structuredClone(before);
  const updatedAt = '2026-11-09T10:40:00.000Z';
  const result = moveWorkoutExerciseRecord(before, 'workout', 'second', 3, updatedAt);
  assert.equal(result.error, null);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(result.state.workouts[0].exercises.map((entry) => entry.id), ['first', 'third', 'fourth', 'second']);
  for (const entry of before.workouts[0].exercises) {
    assert.strictEqual(result.state.workouts[0].exercises.find((item) => item.id === entry.id), entry);
  }
  assert.deepEqual(result.state.workouts[0], {
    ...before.workouts[0], updatedAt,
    exercises: [before.workouts[0].exercises[0], before.workouts[0].exercises[2], before.workouts[0].exercises[3], before.workouts[0].exercises[1]],
  });
  assert.deepEqual(calculateWorkoutStats(result.state.workouts[0]), calculateWorkoutStats(before.workouts[0]));
  for (const key of ['exercises', 'templates', 'maxStrengthRecords', 'meta']) assert.strictEqual(result.state[key], before[key]);
  assert.strictEqual(result.state.workouts[1], before.workouts[1]);
});

test('target positions are the final index in either direction, including first and last positions', () => {
  const before = fixture();
  for (const [entryId, targetIndex, expected] of [
    ['second', 0, ['second', 'first', 'third', 'fourth']],
    ['second', 2, ['first', 'third', 'second', 'fourth']],
    ['fourth', 1, ['first', 'fourth', 'second', 'third']],
    ['first', 3, ['second', 'third', 'fourth', 'first']],
  ]) {
    const result = moveWorkoutExerciseRecord(before, 'workout', entryId, targetIndex);
    assert.equal(result.error, null);
    assert.deepEqual(result.state.workouts[0].exercises.map((entry) => entry.id), expected);
  }
});

test('reordering addresses a workout entry by ID even when the same library exercise appears repeatedly', () => {
  const before = fixture();
  const result = moveWorkoutExerciseRecord(before, 'workout', 'second', 0);
  assert.strictEqual(result.state.workouts[0].exercises[0], before.workouts[0].exercises[1]);
  assert.strictEqual(result.state.workouts[0].exercises[1], before.workouts[0].exercises[0]);
  assert.strictEqual(result.state.workouts[0].exercises[3], before.workouts[0].exercises[3]);
});

test('same position and invalid requests leave the entire state untouched', () => {
  const before = fixture();
  const unchanged = moveWorkoutExerciseRecord(before, 'workout', 'second', 1);
  assert.equal(unchanged.error, null);
  assert.strictEqual(unchanged.state, before);
  for (const [workoutId, entryId, targetIndex] of [
    ['missing', 'second', 0], ['workout', 'missing', 0],
    ['workout', 'second', -1], ['workout', 'second', 4], ['workout', 'second', 1.5],
    ['workout', 'second', '0'], ['workout', 'second', NaN], ['workout', 'second', undefined],
  ]) {
    const result = moveWorkoutExerciseRecord(before, workoutId, entryId, targetIndex);
    assert.ok(result.error);
    assert.strictEqual(result.state, before);
  }
});

test('reordering keeps workout dates and completion state and starts an untouched draft only once', () => {
  const before = fixture();
  before.workouts[0].completedAt = '2026-11-09T10:35:00.000Z';
  const completed = moveWorkoutExerciseRecord(before, 'workout', 'second', 0);
  assert.equal(completed.state.workouts[0].completedAt, before.workouts[0].completedAt);
  assert.equal(completed.state.workouts[0].date, before.workouts[0].date);
  assert.equal(completed.state.workouts[0].draftStartedAt, before.workouts[0].draftStartedAt);
  before.workouts[0].completedAt = null;
  before.workouts[0].draftStartedAt = null;
  const startedAt = '2026-11-09T10:40:00.000Z';
  const started = moveWorkoutExerciseRecord(before, 'workout', 'second', 0, startedAt);
  const movedAgain = moveWorkoutExerciseRecord(started.state, 'workout', 'second', 3, '2026-11-09T10:45:00.000Z');
  assert.equal(movedAgain.state.workouts[0].draftStartedAt, startedAt);
  assert.equal(movedAgain.state.workouts[0].completedAt, null);
});

test('the selected exercise remains selected after reordering and after a backup round trip', () => {
  const before = normalizeAppState(fixture());
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveWorkoutExercisePosition('workout', 'second', storage);
  assert.equal(readWorkoutExerciseIndex(before.workouts[0], storage), 1);
  const result = moveWorkoutExerciseRecord(before, 'workout', 'second', 3);
  const restored = parseBackupPayload(JSON.stringify(createBackupPayload(result.state)));
  assert.equal(readWorkoutExerciseIndex(result.state.workouts[0], storage), 3);
  assert.equal(readWorkoutExerciseIndex(restored.workouts[0], storage), 3);
  assert.deepEqual(restored, result.state);
});
