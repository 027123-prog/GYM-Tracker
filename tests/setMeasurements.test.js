import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSetSummary, formatSetWeight, getSetRepVolume, parseWeightInput, prepareSetValues } from '../src/utils/setMeasurements.js';
import { createBackupPayload, normalizeAppState, parseBackupPayload } from '../src/utils/storage.js';
import { buildExerciseChartData, calculateWorkoutStats, getLastExerciseSummaryText } from '../src/utils/workout.js';

test('weight input accepts paired loads and German decimals while retaining the expression', () => {
  assert.deepEqual(parseWeightInput('2x30'), { weight: 60, weightInput: '2x30' });
  assert.deepEqual(parseWeightInput('2 x 12,5'), { weight: 25, weightInput: '2x12,5' });
  assert.deepEqual(parseWeightInput('2×12.5'), { weight: 25, weightInput: '2x12.5' });
  assert.deepEqual(parseWeightInput('30,5'), { weight: 30.5 });
  assert.deepEqual(parseWeightInput(30.12345), { weight: 30.12345 });
  assert.deepEqual(parseWeightInput(0), { weight: 0 });

  for (const value of ['', ' ', '2x', 'x30', '2xx30', '2x30kg', '0x30', '-2x30', '2x-30', '1.5x30', '-30', 'NaN', 'Infinity', '1e3', '2x1001', '2/3']) {
    assert.equal(parseWeightInput(value), null, value);
  }
  assert.deepEqual(parseWeightInput('-20', { allowNegative: true }), { weight: -20 });
});

test('duration is explicit, validated separately, and never multiplied into rep volume', () => {
  const result = prepareSetValues({ weight: '2x30', measurementType: 'duration', durationSeconds: 45, reps: 99 });
  assert.equal(result.error, null);
  assert.deepEqual(result.values, { weight: 60, weightInput: '2x30', measurementType: 'duration', durationSeconds: 45, reps: 0 });
  assert.equal(formatSetSummary(result.values), '45 s · 2x30 kg');
  assert.equal(getSetRepVolume(result.values), 0);
  assert.equal(getSetRepVolume({ ...result.values, reps: 45 }), 0, 'even malformed duration metadata must not inflate volume');
  assert.equal(formatSetSummary({ measurementType: 'duration', durationSeconds: 30, weight: 0 }), '30 s');

  for (const value of [0, -1, 1.5, 86401, 'invalid', '']) {
    assert.ok(prepareSetValues({ weight: 0, measurementType: 'duration', durationSeconds: value }).error);
  }
});

test('bodyweight modes retain effective weight and allow seconds independently of load type', () => {
  const regular = prepareSetValues({ weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: 0, reps: 10 });
  assert.equal(regular.error, null);
  assert.deepEqual(regular.values, { weight: 40, weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: 0, reps: 10 });

  const assisted = prepareSetValues({ weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 1, addedWeight: -20, reps: 8 });
  assert.equal(assisted.values.weight, 60);
  assert.equal(getSetRepVolume(assisted.values), 480);

  const timed = prepareSetValues({ weightMode: 'bodyweight', bodyWeight: '80,5', bodyweightFactor: 0.5, addedWeight: '2x10', measurementType: 'duration', durationSeconds: 30 });
  assert.equal(timed.values.weight, 60.3);
  assert.equal(timed.values.addedWeightInput, '2x10');
  assert.equal(timed.values.addedWeight, 20);
  assert.equal(getSetRepVolume(timed.values), 0);
  assert.ok(prepareSetValues({ weightMode: 'bodyweight', bodyWeight: '', bodyweightFactor: 1, reps: 10 }).error);
});

function sampleState() {
  return {
    exercises: [{ id: 'carry', name: 'Carry', weightOptions: [30, 60], settings: { measurementType: 'duration', loadType: 'normal', bodyweightPercent: 100, setupNotes: 'Aufrecht gehen' } }],
    templates: [{ id: 'plan', name: 'Plan', exerciseTemplates: [{ exerciseId: 'carry', name: 'Carry', repScheme: '2 × 30 s' }] }],
    workouts: [{ id: 'workout', name: 'Test', date: '2026-10-24T12:00:00Z', completedAt: '2026-10-24T13:00:00Z', exercises: [{ id: 'entry', name: 'Carry', exerciseId: 'carry', sets: [
      { id: 'old-reps', weight: 30, reps: 10, comment: 'Historisch nicht umdeuten' },
      { id: 'duration', ...prepareSetValues({ weight: '2x30', measurementType: 'duration', durationSeconds: 45 }).values, comment: 'rechts' },
      { id: 'duration-2', ...prepareSetValues({ weight: 50, measurementType: 'duration', durationSeconds: 60 }).values, comment: 'links' },
    ] }] }],
    maxStrengthRecords: [{ id: 'max', exerciseName: 'Andere Übung', value: 100, date: '2026-01-01' }],
  };
}

test('import/export preserves duration, expressions, bodyweight and old repetitions without reinterpreting them', () => {
  const input = sampleState();
  input.workouts[0].exercises[0].sets.push({ id: 'bw', ...prepareSetValues({ weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 0.5, addedWeight: '2x10', measurementType: 'duration', durationSeconds: 30 }).values });
  const before = normalizeAppState(input);
  const after = parseBackupPayload(JSON.stringify(createBackupPayload(before)));
  assert.deepEqual(after, before);
  assert.equal(after.exercises[0].settings.measurementType, 'duration');
  assert.equal(after.workouts[0].exercises[0].sets.length, 4);
  assert.equal(after.workouts[0].exercises[0].sets[0].reps, 10);
  assert.equal(after.workouts[0].exercises[0].sets[0].measurementType, undefined);
  assert.equal(after.workouts[0].exercises[0].sets[1].reps, 0);
  assert.equal(after.workouts[0].exercises[0].sets[1].weightInput, '2x30');
  assert.equal(after.workouts[0].exercises[0].sets[1].durationSeconds, 45);
  assert.deepEqual(after.maxStrengthRecords, before.maxStrengthRecords);
});

test('mixed history keeps repetition volume/maxima separate from duration and timed load', () => {
  const { workouts } = normalizeAppState(sampleState());
  const stats = calculateWorkoutStats(workouts[0]);
  assert.equal(stats.totalVolume, 300);
  assert.equal(stats.totalDurationSeconds, 105);
  assert.equal(stats.setCount, 3);

  const [point] = buildExerciseChartData(workouts, 'carry');
  assert.equal(point.volume, 300);
  assert.equal(point.maxWeight, 30);
  assert.equal(point.maxWeightReps, 10);
  assert.equal(point.maxDurationSeconds, 60);
  assert.equal(point.totalDurationSeconds, 105);
  assert.equal(point.longestSetWeight, 50);
  assert.equal(point.maxDurationWeight, 60);
  assert.equal(point.maxDurationWeightSeconds, 45);
  assert.match(getLastExerciseSummaryText(workouts, 'carry'), /45 s · 2x30 kg/);

  workouts[0].exercises[0].sets.shift();
  const [timedOnly] = buildExerciseChartData(workouts, 'carry');
  assert.equal(timedOnly.volume, null);
  assert.equal(timedOnly.maxWeight, null);
  assert.equal(timedOnly.maxWeightReps, null);
  assert.equal(calculateWorkoutStats(workouts[0]).totalVolume, 0);
});

test('numeric weight is authoritative on import if an expression conflicts', () => {
  const source = sampleState();
  source.workouts[0].exercises[0].sets[1].weight = 30;
  const [old, expressionSet] = normalizeAppState(source).workouts[0].exercises[0].sets;
  assert.equal(expressionSet.weight, 30);
  assert.equal(expressionSet.weightInput, undefined);
  assert.equal(old.reps, 10);
});

test('a normal expression is repeated and edited without losing its representation', () => {
  const original = prepareSetValues({ weight: '2x30', reps: 8 }).values;
  const repeated = prepareSetValues({ ...original }).values;
  const edited = prepareSetValues({ ...original, reps: 10 }).values;
  assert.deepEqual(repeated, original);
  assert.equal(formatSetSummary(edited), '2x30 kg × 10');
  assert.equal(getSetRepVolume(edited), 600);
});

test('no-weight sets validate only their quantity and strip stale load metadata', () => {
  const stale = {
    weightMode: 'none', weight: 93, weightInput: '2x46,5', bodyWeight: 93,
    bodyweightFactor: 1, addedWeight: 10, addedWeightInput: '2x5', reps: 12,
  };
  const result = prepareSetValues(stale);
  assert.equal(result.error, null);
  assert.deepEqual(result.values, { weight: 0, weightMode: 'none', reps: 12 });
  assert.equal(formatSetWeight(stale), '');
  assert.equal(formatSetSummary(stale), '12 Wdh.');
  assert.equal(getSetRepVolume(stale), 0);
  assert.equal(stale.weight, 93, 'Validation does not mutate the original set');

  const timed = prepareSetValues({ ...stale, weightInput: 'invalid', measurementType: 'duration', durationSeconds: 35 });
  assert.deepEqual(timed.values, { weight: 0, weightMode: 'none', measurementType: 'duration', durationSeconds: 35, reps: 0 });
  assert.equal(formatSetSummary({ ...stale, ...timed.values, weight: 93 }), '35 s');
  assert.deepEqual(prepareSetValues(timed.values).values, timed.values, 'Repeating keeps the explicit no-weight mode');

  for (const reps of [0, -1, 1.5, 1001, '', 'invalid']) {
    assert.ok(prepareSetValues({ weightMode: 'none', reps }).error);
  }
  for (const durationSeconds of [0, -1, 1.5, 86401, '', 'invalid']) {
    assert.ok(prepareSetValues({ weightMode: 'none', measurementType: 'duration', durationSeconds }).error);
  }
});

test('no-weight settings and explicit sets survive import/export without reinterpreting old sets', () => {
  const source = sampleState();
  source.exercises[0].settings = { ...source.exercises[0].settings, loadType: 'none' };
  const originalSets = structuredClone(source.workouts[0].exercises[0].sets);
  source.workouts[0].exercises[0].sets.push({
    id: 'none', weightMode: 'none', weight: 93, weightInput: '2x46,5', bodyWeight: 93,
    bodyweightFactor: 1, addedWeight: 10, addedWeightInput: '2x5', reps: 12,
    comment: 'Weiterhin erhalten', savedAt: '2026-10-24T12:30:00Z',
  }, {
    id: 'none-duration', weightMode: 'none', weight: 93, weightInput: '2x46,5', measurementType: 'duration', durationSeconds: 35, reps: 99,
  });

  const before = normalizeAppState(source);
  const after = parseBackupPayload(JSON.stringify(createBackupPayload(before)));
  assert.deepEqual(after, before);
  assert.equal(after.exercises[0].settings.loadType, 'none');
  const sets = after.workouts[0].exercises[0].sets;
  assert.deepEqual(sets.slice(0, 3), normalizeAppState(sampleState()).workouts[0].exercises[0].sets);
  assert.deepEqual(source.workouts[0].exercises[0].sets.slice(0, 3), originalSets);
  assert.equal(sets[3].weightMode, 'none');
  assert.equal(sets[3].weight, 0);
  assert.equal(sets[3].reps, 12);
  assert.equal(sets[3].savedAt, '2026-10-24T12:30:00Z');
  assert.equal(sets[3].comment, 'Weiterhin erhalten');
  for (const key of ['weightInput', 'bodyWeight', 'bodyweightFactor', 'addedWeight', 'addedWeightInput']) {
    assert.equal(key in sets[3], false, key);
  }
  assert.equal(formatSetSummary(sets[4]), '35 s');
  assert.equal(sets[4].weight, 0);
  assert.equal(sets[4].reps, 0);
});

test('mixed no-weight history keeps repetition counts separate from loaded reps and timed load', () => {
  const { workouts } = normalizeAppState(sampleState());
  workouts[0].exercises[0].sets.push(
    { id: 'none-1', weightMode: 'none', weight: 999, reps: 12 },
    { id: 'none-2', weightMode: 'none', weight: 0, reps: 9 },
    { id: 'none-duration', weightMode: 'none', weight: 999, measurementType: 'duration', durationSeconds: 70, reps: 0 },
  );
  const stats = calculateWorkoutStats(workouts[0]);
  assert.equal(stats.totalVolume, 300);
  assert.equal(stats.totalReps, 21);
  assert.equal(stats.totalDurationSeconds, 175);
  assert.equal(stats.setCount, 6);

  const [mixed] = buildExerciseChartData(workouts, 'carry');
  assert.equal(mixed.maxReps, 12);
  assert.equal(mixed.totalReps, 21);
  assert.equal(mixed.volume, 300);
  assert.equal(mixed.maxWeight, 30);
  assert.equal(mixed.maxWeightReps, 10);
  assert.equal(mixed.maxDurationSeconds, 70);
  assert.equal(mixed.longestSetWeight, null);
  assert.equal(mixed.maxDurationWeight, 60);
  assert.equal(mixed.maxDurationWeightSeconds, 45);
  assert.match(getLastExerciseSummaryText(workouts, 'carry'), /12 Wdh\. · 9 Wdh\. · 70 s$/);

  workouts[0].exercises[0].sets = workouts[0].exercises[0].sets.slice(3);
  const [noWeightOnly] = buildExerciseChartData(workouts, 'carry');
  assert.equal(noWeightOnly.volume, null);
  assert.equal(noWeightOnly.maxWeight, null);
  assert.equal(noWeightOnly.maxWeightReps, null);
  assert.equal(noWeightOnly.maxDurationWeight, null);
  assert.equal(noWeightOnly.maxDurationWeightSeconds, null);
  assert.equal(noWeightOnly.totalReps, 21);
});
