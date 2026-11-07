import assert from 'node:assert/strict';
import test from 'node:test';
import { getTimerLoad } from '../src/utils/timerLoad.js';

test('timer load copies only compatible load and never duplicates a previous set', () => {
  const last = { id: 'old', weight: 40, weightMode: 'paired', weightInput: '2x20', durationSeconds: 90, measurementType: 'duration', comment: 'old', savedAt: 'old' };
  assert.deepEqual(getTimerLoad({ loadType: 'paired' }, last), { weight: 40, weightMode: 'paired', weightInput: '2x20', measurementType: 'duration', durationSeconds: 1, reps: 0 });
  assert.deepEqual(getTimerLoad({ loadType: 'normal' }, last), { weight: 40, measurementType: 'duration', durationSeconds: 1, reps: 0 });
  assert.deepEqual(getTimerLoad({ loadType: 'none' }, last), { weight: 0, weightMode: 'none', measurementType: 'duration', durationSeconds: 1, reps: 0 });
  assert.equal(getTimerLoad({ loadType: 'paired' }, { weightMode: 'bodyweight', weight: 80 }).weight, 0);
  assert.equal(last.durationSeconds, 90);
});

test('timers use unloaded defaults or require valid bodyweight configuration', () => {
  assert.equal(getTimerLoad({ loadType: 'normal' }).weight, 0);
  assert.equal(getTimerLoad({ loadType: 'paired' }).weight, 0);
  assert.equal(getTimerLoad({ loadType: 'bodyweight' }), null);
  const load = getTimerLoad({ loadType: 'bodyweight', bodyweightPercent: 50 }, { weightMode: 'bodyweight', bodyWeight: 80, addedWeight: 10, bodyweightFactor: 1 });
  assert.equal(load.weight, 40);
  assert.equal(load.bodyweightFactor, 0.5);
  assert.equal(load.addedWeight, 0);
  assert.equal(getTimerLoad({ loadType: 'bodyweight-added', bodyweightPercent: 50 }, { weightMode: 'bodyweight', bodyWeight: 80, addedWeight: 10 }).weight, 50);
});
