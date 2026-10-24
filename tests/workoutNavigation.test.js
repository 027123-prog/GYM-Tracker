import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readWorkoutExerciseIndex,
  saveWorkoutExercisePosition,
  readWorkoutResumePath,
  rememberWorkoutView,
} from '../src/utils/workoutNavigation.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const workout = { id: 'workout-a', exercises: [{ id: 'entry-squat' }, { id: 'entry-row' }, { id: 'entry-press' }] };

test('Workout selection survives remount and follows the entry after reordering', () => {
  const storage = memoryStorage();
  saveWorkoutExercisePosition(workout.id, 'entry-row', storage);
  assert.equal(readWorkoutExerciseIndex(workout, storage), 1);
  assert.equal(readWorkoutExerciseIndex({ ...workout, exercises: [workout.exercises[1], workout.exercises[0]] }, storage), 0);
  assert.equal(readWorkoutExerciseIndex({ ...workout, id: 'workout-b' }, storage), 0);
});

test('Removed, unknown or empty exercise selections safely fall back to the first entry', () => {
  const storage = memoryStorage();
  saveWorkoutExercisePosition(workout.id, 'entry-deleted', storage);
  assert.equal(readWorkoutExerciseIndex(workout, storage), 0);
  assert.equal(readWorkoutExerciseIndex({ ...workout, exercises: [] }, storage), 0);
  assert.equal(readWorkoutExerciseIndex(undefined, storage), 0);
});

test('Unavailable browser storage does not prevent workout navigation', () => {
  const unavailable = { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } };
  assert.equal(readWorkoutExerciseIndex(workout, unavailable), 0);
  assert.doesNotThrow(() => saveWorkoutExercisePosition(workout.id, 'entry-row', unavailable));
  assert.doesNotThrow(() => saveWorkoutExercisePosition(workout.id, 'entry-row', null));
  assert.equal(readWorkoutResumePath([workout], unavailable), null);
  assert.doesNotThrow(() => rememberWorkoutView('/workouts/workout-a/edit', [workout], unavailable));
});

test('Cold root launch can resume only the last viewed unfinished workout', () => {
  const storage = memoryStorage();
  rememberWorkoutView('/workouts/workout-a/edit', [workout], storage);
  assert.equal(readWorkoutResumePath([workout], storage), '/workouts/workout-a/edit');
  assert.equal(readWorkoutResumePath([{ ...workout, completedAt: '2026-10-24T12:00:00Z' }], storage), null);
  assert.equal(readWorkoutResumePath([], storage), null);
});

test('Intentional navigation out of the workout and completion clear root-launch recovery', () => {
  const storage = memoryStorage();
  for (const destination of ['/', '/exercises', '/workouts/workout-a', '/workouts/missing/edit']) {
    rememberWorkoutView('/workouts/workout-a/edit', [workout], storage);
    rememberWorkoutView(destination, [workout], storage);
    assert.equal(readWorkoutResumePath([workout], storage), null, destination);
  }
  rememberWorkoutView('/workouts/workout-a/edit', [workout], storage);
  rememberWorkoutView('/workouts/workout-a/edit', [{ ...workout, completedAt: '2026-10-24T12:00:00Z' }], storage);
  assert.equal(readWorkoutResumePath([workout], storage), null);
});
