import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSetValues } from '../src/utils/setMeasurements.js';
import { createStopwatchSetPayload, formatStopwatchTime, getStopwatchElapsedSeconds, MAX_STOPWATCH_SECONDS } from '../src/utils/stopwatch.js';

test('elapsed time uses timestamps and floors whole seconds even after a background pause', () => {
  const startedAt = 100000;
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt), 0);
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt + 999), 0);
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt + 1500), 1);
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt + 185987), 185);
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt - 10000), 0);
  assert.equal(getStopwatchElapsedSeconds(startedAt, startedAt + 90000000), MAX_STOPWATCH_SECONDS);
  assert.equal(getStopwatchElapsedSeconds(null, startedAt), 0);
  assert.equal(getStopwatchElapsedSeconds(startedAt, Number.NaN), 0);
});

test('stopwatch display changes from minutes to hours without wrapping after one hour', () => {
  for (const [seconds, expected] of [[0, '00:00'], [9, '00:09'], [60, '01:00'], [3599, '59:59'], [3600, '01:00:00'], [3661, '01:01:01'], [86400, '24:00:00'], [90000, '24:00:00'], [-1, '00:00'], [1.9, '00:01'], [Number.NaN, '00:00']]) {
    assert.equal(formatStopwatchTime(seconds), expected);
  }
});

test('a plank stopwatch creates a new duration set and strips stale identity, repetitions and comments', () => {
  const payload = createStopwatchSetPayload({ id: 'previous', weightMode: 'none', weight: 80, reps: 12, comment: 'old', measurementType: 'duration', durationSeconds: 1 }, 45.9);
  assert.deepEqual(payload, { weight: 0, weightMode: 'none', reps: 0, measurementType: 'duration', durationSeconds: 45, comment: '' });
  assert.equal(prepareSetValues(payload).error, null);
});

test('stopwatch saves at least one second, caps at 24 hours and rejects unknown elapsed times', () => {
  const load = { weightMode: 'none' };
  assert.equal(createStopwatchSetPayload(load, 0).durationSeconds, 1);
  assert.equal(createStopwatchSetPayload(load, 0.9).durationSeconds, 1);
  assert.equal(createStopwatchSetPayload(load, 86410).durationSeconds, 86400);
  assert.equal(createStopwatchSetPayload(load, Number.NaN), null);
  assert.equal(createStopwatchSetPayload(load, Infinity), null);
  assert.equal(createStopwatchSetPayload(null, 10), null);
});

test('stopwatch preserves canonical paired, normal and bodyweight loads without multiplying twice', () => {
  const loads = [
    prepareSetValues({ weightMode: 'paired', individualWeight: '12,5', reps: 10 }).values,
    prepareSetValues({ weight: '2x20', reps: 10 }).values,
    prepareSetValues({ weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: 5, reps: 10 }).values,
  ];
  for (const load of loads) {
    const snapshot = structuredClone(load);
    const payload = createStopwatchSetPayload(load, 42);
    assert.equal(payload.weight, load.weight);
    assert.equal(payload.weightMode, load.weightMode);
    assert.equal(payload.weightInput, load.weightInput);
    assert.equal(payload.durationSeconds, 42);
    assert.equal(payload.reps, 0);
    assert.equal(payload.bodyweightFactor, load.bodyweightFactor);
    assert.equal(payload.addedWeight, load.addedWeight);
    const { comment, ...canonicalValues } = payload;
    assert.deepEqual(prepareSetValues(payload).values, canonicalValues);
    assert.deepEqual(load, snapshot);
  }
  assert.equal(createStopwatchSetPayload({ weight: 'invalid' }, 42), null);
});
