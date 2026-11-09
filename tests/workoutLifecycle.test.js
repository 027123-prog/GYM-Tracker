import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeWorkoutRecord } from '../src/utils/workoutLifecycle.js';
import { calculateWorkoutStats } from '../src/utils/workout.js';
import { normalizeAppState } from '../src/utils/storage.js';
import {
  readStoredActiveWorkoutId,
  readWorkoutExerciseIndex,
  readWorkoutResumePath,
  rememberWorkoutView,
  saveWorkoutExercisePosition,
  storeActiveWorkoutId,
} from '../src/utils/workoutNavigation.js';

const startedAt = '2026-11-09T18:00:00.000Z';
const finishedAt = '2026-11-09T18:30:00.000Z';
const resumedAt = '2026-11-09T18:31:00.000Z';

function finishedWorkout() {
  return {
    id: 'workout-resume',
    name: 'Ganzkörper A',
    date: startedAt,
    draftStartedAt: startedAt,
    updatedAt: finishedAt,
    completedAt: finishedAt,
    mode: 'template',
    templateId: 'template-a',
    exercises: [
      { id: 'entry-first', exerciseId: 'row', name: 'Rudern', skipped: false, sets: [
        { id: 'set-a', weight: 40, reps: 10, comment: 'Sauber', savedAt: '2026-11-09T18:10:00.000Z' },
      ] },
      { id: 'entry-second', exerciseId: 'plank', name: 'Plank', skipped: false, sets: [
        { id: 'set-b', weight: 0, reps: 0, measurementType: 'duration', durationSeconds: 45, weightMode: 'none', savedAt: '2026-11-09T18:20:00.000Z' },
      ] },
    ],
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('Korrigieren opens the same workout and preserves its start, exercises and recorded sets', () => {
  const workout = finishedWorkout();
  const original = structuredClone(workout);
  const resumed = resumeWorkoutRecord(workout, resumedAt);

  assert.deepEqual(resumed, { ...original, completedAt: null, updatedAt: resumedAt });
  assert.deepEqual(workout, original);
  assert.equal(resumed.exercises, workout.exercises);
  assert.deepEqual(calculateWorkoutStats(resumed), calculateWorkoutStats(workout));
});

test('Resuming an imported workout supplies a draft marker and survives storage normalization', () => {
  for (const draftStartedAt of [null, undefined]) {
    const workout = { ...finishedWorkout(), draftStartedAt };
    const resumed = resumeWorkoutRecord(workout, resumedAt);
    const stored = normalizeAppState({ workouts: [resumed] }).workouts[0];
    assert.equal(stored.completedAt, null);
    assert.equal(stored.date, startedAt);
    assert.equal(stored.draftStartedAt, startedAt);
    assert.equal(stored.exercises[0].sets[0].savedAt, workout.exercises[0].sets[0].savedAt);
  }
});

test('A corrected workout can become active again and restores the same exercise after an app restart', () => {
  const storage = memoryStorage();
  const workout = finishedWorkout();
  saveWorkoutExercisePosition(workout.id, 'entry-second', storage);
  const resumed = resumeWorkoutRecord(workout, resumedAt);
  storeActiveWorkoutId(resumed.id, null, storage);
  rememberWorkoutView(`/workouts/${resumed.id}/edit`, [resumed], storage);

  assert.equal(readStoredActiveWorkoutId([resumed], null, storage), resumed.id);
  assert.equal(readWorkoutResumePath([resumed], storage), `/workouts/${resumed.id}/edit`);
  assert.equal(readWorkoutExerciseIndex(resumed, storage), 1);
});

test('Resuming an already running or missing workout does not rewrite its state', () => {
  const running = { ...finishedWorkout(), completedAt: null };
  assert.equal(resumeWorkoutRecord(running, resumedAt), running);
  assert.equal(resumeWorkoutRecord(undefined, resumedAt), undefined);
});
