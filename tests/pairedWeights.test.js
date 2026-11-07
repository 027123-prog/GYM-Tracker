import assert from 'node:assert/strict';
import test from 'node:test';
import { editExerciseRecord } from '../src/utils/exerciseEditing.js';
import { formatSetSummary, formatSetWeight, getSetRepVolume, isPairedSet, prepareSetValues } from '../src/utils/setMeasurements.js';
import { createBackupPayload, normalizeAppState, parseBackupPayload } from '../src/utils/storage.js';
import { buildExerciseChartData, calculateWorkoutStats } from '../src/utils/workout.js';

function paired(individualWeight, extra = {}) {
  return prepareSetValues({ weightMode: 'paired', individualWeight, reps: 10, ...extra });
}

function fixture() {
  return {
    exercises: [{ id: 'press', name: 'Kurzhanteldrücken', weightOptions: [20, 40], settings: { loadType: 'paired', bodyweightPercent: 100, setupNotes: 'Bank 3' } }],
    templates: [{ id: 'plan', name: 'Plan', exerciseTemplates: [{ exerciseId: 'press', name: 'Kurzhanteldrücken', repScheme: '2 × 10' }] }],
    workouts: [{ id: 'workout', name: 'Test', date: '2026-11-07T12:00:00Z', completedAt: '2026-11-07T13:00:00Z', exercises: [{ id: 'entry', name: 'Kurzhanteldrücken', exerciseId: 'press', sets: [
      { id: 'old-single', weight: 20, reps: 10, comment: 'Alte Gesamtlast erhalten' },
      { id: 'old-expression', weight: 40, weightInput: '2x20', reps: 10 },
      { id: 'new-paired', ...paired('20').values, comment: 'Paar', savedAt: '2026-11-07T12:05:00Z' },
    ] }] }],
    maxStrengthRecords: [{ id: 'strength', exerciseName: 'Kurzhanteldrücken', value: 100, date: '2026-11-01' }],
  };
}

test('paired entry stores the total once and survives save, repetition and edits', () => {
  const original = paired('20');
  assert.equal(original.error, null);
  assert.deepEqual(original.values, { weight: 40, weightMode: 'paired', weightInput: '2x20', reps: 10 });
  assert.equal(isPairedSet(original.values), true);
  assert.equal(formatSetWeight(original.values), '2 × 20 kg');
  assert.equal(formatSetSummary(original.values), '2 × 20 kg × 10');
  assert.equal(getSetRepVolume(original.values), 400);
  assert.equal('individualWeight' in original.values, false);
  const secondValidation = prepareSetValues(original.values);
  assert.deepEqual(secondValidation, original);
  assert.deepEqual(prepareSetValues(secondValidation.values), original);
  const editedReps = prepareSetValues({ ...original.values, reps: 12 });
  assert.equal(editedReps.values.weight, 40);
  assert.equal(getSetRepVolume(editedReps.values), 480);
  const editedWeight = prepareSetValues({ ...original.values, individualWeight: '22,5' });
  assert.deepEqual(editedWeight.values, { weight: 45, weightMode: 'paired', weightInput: '2x22,5', reps: 10 });
});

test('paired inputs support zero and decimals but reject expressions and invalid per-hand loads', () => {
  for (const [input, total] of [[0, 0], ['12,5', 25], ['12.5', 25], ['.5', 1], [' 20 ', 40], ['1000', 2000], ['20,125', 40.25]]) {
    const result = paired(input);
    assert.equal(result.error, null, String(input));
    assert.equal(result.values.weight, total);
    assert.deepEqual(prepareSetValues(result.values), result);
  }
  for (const input of ['', ' ', '2x20', '2 × 20', '1x20', '-1', '1000,1', '2000', 'Infinity', 'NaN', '1e2', null, undefined]) {
    assert.match(paired(input).error, /Gewicht einer Hantel/, String(input));
  }
  for (const total of [-1, 2001, '2x20', '', null, undefined]) {
    assert.ok(prepareSetValues({ weightMode: 'paired', weight: total, reps: 10 }).error);
  }
});

test('canonical paired loads ignore stale expressions and keep numeric totals authoritative', () => {
  const result = prepareSetValues({ weightMode: 'paired', weight: 40, weightInput: '2x40', reps: 10 });
  assert.deepEqual(result.values, paired(20).values);
  assert.equal(formatSetWeight({ weightMode: 'paired', weight: 40, weightInput: '2x40' }), '2 × 20 kg');
});

test('paired timed sets use total load while duration stays out of repetition volume', () => {
  const result = paired('12,5', { measurementType: 'duration', durationSeconds: 45 });
  assert.equal(result.error, null);
  assert.deepEqual(result.values, { weight: 25, weightMode: 'paired', weightInput: '2x12,5', measurementType: 'duration', durationSeconds: 45, reps: 0 });
  assert.deepEqual(prepareSetValues(result.values), result);
  assert.equal(formatSetSummary(result.values), '45 s · 2 × 12,5 kg');
  assert.equal(getSetRepVolume(result.values), 0);
  assert.ok(paired(20, { measurementType: 'duration', durationSeconds: 0 }).error);
  assert.ok(paired(20, { reps: 0 }).error);
});

test('paired settings and sets survive backups and preserve old history and stored total suggestions', () => {
  const source = fixture();
  const snapshot = structuredClone(source);
  const before = normalizeAppState(source);
  const after = parseBackupPayload(JSON.stringify(createBackupPayload(before)));
  assert.deepEqual(source, snapshot);
  assert.deepEqual(after, before);
  assert.equal(after.exercises[0].settings.loadType, 'paired');
  assert.deepEqual(after.exercises[0].weightOptions, [20, 40]);
  const sets = after.workouts[0].exercises[0].sets;
  assert.equal(sets[0].weight, 20);
  assert.equal(sets[0].weightMode, undefined);
  assert.equal(sets[1].weight, 40);
  assert.equal(sets[1].weightInput, '2x20');
  assert.equal(sets[1].weightMode, undefined);
  assert.equal(sets[2].weight, 40);
  assert.equal(sets[2].weightMode, 'paired');
  assert.equal(sets[2].weightInput, '2x20');
  assert.equal(sets[2].comment, 'Paar');
  assert.equal(sets[2].savedAt, '2026-11-07T12:05:00Z');
  assert.deepEqual(after.maxStrengthRecords, before.maxStrengthRecords);
});

test('import repairs conflicting paired notation without multiplying historical totals', () => {
  const source = fixture();
  source.workouts[0].exercises[0].sets[2].weightInput = '2x40';
  source.workouts[0].exercises[0].sets[2].individualWeight = 99;
  const state = normalizeAppState(source);
  const set = state.workouts[0].exercises[0].sets[2];
  assert.equal(set.weight, 40);
  assert.equal(set.weightInput, '2x20');
  assert.equal(set.weightMode, 'paired');
  assert.equal('individualWeight' in set, false);
  assert.deepEqual(normalizeAppState(state), state);
});

test('switching paired settings changes future entry only and leaves old sets and templates intact', () => {
  const before = fixture();
  before.exercises[0].settings.loadType = 'normal';
  const snapshot = structuredClone(before);
  const enabled = editExerciseRecord(before, 'press', { settings: { loadType: 'paired', bodyweightPercent: 'invalid stale value' } });
  assert.equal(enabled.error, null);
  assert.equal(enabled.state.exercises[0].settings.loadType, 'paired');
  assert.equal(enabled.state.exercises[0].settings.bodyweightPercent, 100);
  assert.equal(enabled.state.exercises[0].settings.setupNotes, 'Bank 3');
  assert.strictEqual(enabled.state.workouts, before.workouts);
  assert.strictEqual(enabled.state.templates, before.templates);
  assert.deepEqual(before, snapshot);
  const disabled = editExerciseRecord(enabled.state, 'press', { settings: { loadType: 'normal' } });
  assert.equal(disabled.state.exercises[0].settings.loadType, 'normal');
  assert.strictEqual(disabled.state.workouts, before.workouts);
  assert.equal(formatSetWeight(disabled.state.workouts[0].exercises[0].sets[2]), '2 × 20 kg');
});

test('mixed old and paired history computes total volume and chart maxima once', () => {
  const source = fixture();
  source.workouts[0].exercises[0].sets.push({ id: 'timed', ...paired(30, { measurementType: 'duration', durationSeconds: 45 }).values });
  const { workouts } = normalizeAppState(source);
  const stats = calculateWorkoutStats(workouts[0]);
  assert.equal(stats.totalVolume, 1000);
  assert.equal(stats.totalDurationSeconds, 45);
  const [chart] = buildExerciseChartData(workouts, 'press');
  assert.equal(chart.volume, 1000);
  assert.equal(chart.maxWeight, 40);
  assert.equal(chart.maxDurationWeight, 60);
  assert.equal(chart.maxDurationWeightSeconds, 45);
});

test('other load modes discard stale paired input and metadata', () => {
  const stale = { ...paired(20).values, individualWeight: 999, bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: 0 };
  assert.deepEqual(prepareSetValues({ ...stale, weightMode: 'none' }).values, { weight: 0, weightMode: 'none', reps: 10 });
  const bodyweight = prepareSetValues({ ...stale, weightMode: 'bodyweight' }).values;
  assert.deepEqual(bodyweight, { weight: 40, weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: 0, reps: 10 });
  assert.equal(isPairedSet(bodyweight), false);
});
