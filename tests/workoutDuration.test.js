import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWorkoutDuration, getWorkoutDuration } from '../src/utils/workoutDuration.js';

const set = (dateTime) => ({ savedAt: dateTime });
const workout = (...exercises) => ({ exercises: exercises.map((times) => ({ sets: times.map(set) })) });

test('elapsed workout time uses the earliest and latest set across reordered exercises', () => {
  const entry = workout(
    ['2026-11-22T12:07:00+01:00', '2026-11-22'],
    ['2026-11-22T11:12:00+01:00', '2026-11-22T11:18:00+01:00', '2026-11-22T11:38:00+01:00'],
  );
  assert.equal(getWorkoutDuration(entry), 60 * 60_000);
  assert.equal(formatWorkoutDuration(entry), '1 h 0 min');
});

test('isolated timestamps at either end do not inflate the duration of the recorded block', () => {
  const entry = workout(
    ['2026-11-22T06:00:00Z', '2026-11-22T09:00:00Z', '2026-11-22T09:24:00Z'],
    ['2026-11-22T09:53:00Z', '2026-11-22T14:00:00Z', '2026-11-22T19:00:00Z'],
  );
  assert.equal(formatWorkoutDuration(entry), '58 min');
});

test('long rests between two documented blocks still count', () => {
  const entry = workout(
    ['2026-11-22T09:00:00Z', '2026-11-22T09:07:00Z'],
    ['2026-11-22T10:20:00Z', '2026-11-22T10:30:00Z'],
  );
  assert.equal(formatWorkoutDuration(entry), '1 h 35 min');
});

test('duration needs two timed sets and keeps the measured gap when no block is identifiable', () => {
  assert.equal(formatWorkoutDuration(workout(['invalid', '2026-11-22', '2026-11-22T09:00:00Z'])), '–');
  assert.equal(formatWorkoutDuration(workout(['2026-11-22T09:00:00Z', '2026-11-22T10:00:00Z'])), '1 h 5 min');
  assert.equal(formatWorkoutDuration(workout(['2026-11-22T09:00:00Z', '2026-11-22T09:00:49Z'])), '5 min');
});
