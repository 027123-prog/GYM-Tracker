import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMuscleLoad, muscleLoadColor } from '../src/utils/muscleLoad.js';

const NOW = '2026-11-15T12:00:00Z';
const assignment = { exerciseId: 'press', status: 'draft_assigned', primary: ['chest'], secondary: ['triceps'], stabilizers: [] };
const mapping = { groups: { chest: 'Chest', triceps: 'Triceps', calves: 'Calves' }, entries: [assignment] };
const set = (weight = 40, reps = 8, extra = {}) => ({ weight, reps, weightMode: 'normal', ...extra });
const workout = (id, date, sets = [set()], entry = {}) => ({
  id, date, completedAt: date, exercises: [{ exerciseId: 'press', sets, ...entry }],
});
const run = (workouts, extra = {}) => calculateMuscleLoad({ workouts, mapping, now: NOW, ...extra });
const targetScore = (result, id = 'target') => result.sessions.find(item => item.workoutId === id).sets[0];
const ref = (weight) => [workout('ref1', '2026-11-01', [set(weight), set(weight)]), workout('ref2', '2026-11-08', [set(weight), set(weight)])];

test('40 kg at the same reps contributes less against higher prior personal capacity', () => {
  const target = workout('target', '2026-11-14');
  const earlierCapacity = targetScore(run([...ref(42.5), target]));
  const strongerCapacity = targetScore(run([...ref(55), target]));
  assert.ok(earlierCapacity.contribution > strongerCapacity.contribution);
  assert.ok(earlierCapacity.relativeLoad > strongerCapacity.relativeLoad);
  assert.deepEqual(strongerCapacity.reference.workoutIds, ['ref1', 'ref2']);
});

test('same reference gives monotone reps and sets with diminishing color gain', () => {
  const evaluate = (sets) => run([...ref(50), workout('target', '2026-11-15', sets)]);
  assert.ok(targetScore(evaluate([set(40, 12)])).contribution > targetScore(evaluate([set(40, 8)])).contribution);
  const one = evaluate([set()]).muscles.chest.intensity;
  const two = evaluate([set(), set()]).muscles.chest.intensity;
  const three = evaluate([set(), set(), set()]).muscles.chest.intensity;
  assert.ok(one < two && two < three && three < 1);
  assert.ok(three - two < two - one);
});

test('future PRs and reversed input ordering never change the historical score', () => {
  const previous = [...ref(42.5), workout('target', '2026-11-10')];
  const before = targetScore(run(previous));
  const after = targetScore(run([...previous, workout('new-record', '2026-11-14', [set(80)])].reverse()));
  assert.deepEqual(after, before);
});

test('references exclude the current workout and all same-day sessions', () => {
  const result = run([workout('b', '2026-11-14T15:00:00Z'), workout('a', '2026-11-14T10:00:00Z', [set(90)])]);
  for (const session of result.sessions) assert.equal(session.sets[0].reference, null);
});

test('references expire after long pauses and use at most the last five prior workouts', () => {
  const workouts = Array.from({ length: 7 }, (_, i) => workout(`r${i}`, `2026-11-0${i + 1}`, [set(50), set(50)]));
  const result = run([...workouts, workout('target', '2026-11-14')]);
  assert.deepEqual(targetScore(result).reference.workoutIds, ['r2', 'r3', 'r4', 'r5', 'r6']);
  assert.equal(targetScore(run([workout('old', '2026-06-01'), workout('target', '2026-11-14')])).reference, null);
});

test('a lone extreme high value cannot set the reference of a multi-set session', () => {
  const result = run([workout('r', '2026-11-01', [set(50), set(50), set(1000)]), workout('target', '2026-11-14')]);
  const reference = targetScore(result).reference;
  assert.ok(reference.value < 100);
});

test('different exercise IDs, variants, modes and bodyweight factors stay separate', () => {
  const additional = { ...assignment, exerciseId: 'another-machine' };
  const variations = [
    workout('a', '2026-11-01', [set(90)], { exerciseId: 'another-machine' }),
    workout('b', '2026-11-02', [set(90)], { variantKey: 'different-grip' }),
    workout('c', '2026-11-03', [set(90, 8, { weightMode: 'paired' })]),
  ];
  const result = run([...variations, workout('target', '2026-11-14')], { mapping: { ...mapping, entries: [assignment, additional] } });
  assert.equal(targetScore(result).reference, null);
  const body = (factor) => set(40, 8, { weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: factor, addedWeight: 0 });
  const changed = run([workout('r', '2026-11-01', [body(0.5)]), workout('target', '2026-11-14', [body(1)])]);
  assert.equal(targetScore(changed).reference, null);
});

test('paired loads remain stored total loads and explicit bodyweight assistance uses effective load', () => {
  const paired = targetScore(run([workout('target', '2026-11-14', [set(40, 8, { weightMode: 'paired', weightInput: '2x20' })])]));
  assert.equal(paired.weight, 40);
  const assisted = targetScore(run([workout('target', '2026-11-14', [set(60, 8, { weightMode: 'bodyweight', bodyWeight: 80, bodyweightFactor: 1, addedWeight: -20 })])]));
  assert.equal(assisted.weight, 60);
});

test('legacy loads with a changed current mode retain baseline but cannot establish a reference', () => {
  const legacy = set(40, 8, { weightMode: undefined });
  const result = run([workout('r', '2026-11-01', [legacy]), workout('target', '2026-11-14', [legacy])], {
    exercises: [{ id: 'press', settings: { loadType: 'paired' } }],
  });
  const score = targetScore(result);
  assert.equal(score.reference, null);
  assert.ok(score.warnings.includes('current_and_historical_load_modes_differ'));
  assert.ok(score.contribution > 0 && score.confidence <= 0.15);
});

test('seconds and weightless repetitions contribute without invented weights or repetitions', () => {
  const seconds = (durationSeconds) => set(0, 0, { weightMode: 'none', measurementType: 'duration', durationSeconds });
  const result = run([workout('r', '2026-11-01', [seconds(30), seconds(30)]), workout('target', '2026-11-14', [seconds(45)])]);
  const score = targetScore(result);
  assert.equal(score.measurement, 'duration');
  assert.equal(score.relativeQuantity, 1.5);
  assert.ok(score.contribution > 0);
  const reps = targetScore(run([workout('target', '2026-11-14', [set(0, 8, { weightMode: 'none' })])]));
  assert.equal(reps.weight, 0);
  assert.ok(reps.contribution > 0);
});

test('weighted duration handles more time and more load as distinct factors', () => {
  const seconds = (weight, durationSeconds) => set(weight, 0, { measurementType: 'duration', durationSeconds });
  const prior = workout('r', '2026-11-01', [seconds(20, 30), seconds(20, 30)]);
  const evaluate = (weight, duration) => targetScore(run([prior, workout('target', '2026-11-14', [seconds(weight, duration)])])).contribution;
  assert.ok(evaluate(20, 45) > evaluate(20, 30));
  assert.ok(evaluate(25, 30) > evaluate(20, 30));
});

test('an unknown machine base load receives a cautious nonzero baseline', () => {
  const zero = targetScore(run([workout('target', '2026-11-14', [set(0)])]));
  const loaded = targetScore(run([workout('target', '2026-11-14', [set(20)])]));
  assert.ok(zero.contribution > 0 && zero.contribution < loaded.contribution);
  assert.ok(zero.warnings.includes('zero_external_load'));
});

test('unclear assistance conventions are excluded and uncertain variants establish no reference', () => {
  const custom = { ...mapping, entries: [{ ...assignment, analysis: { unclearLegacyLoad: true } }] };
  const excluded = run([workout('w', '2026-11-14', [set(40, 8, { weightMode: undefined })])], { mapping: custom });
  assert.equal(excluded.diagnostics[0].reason, 'unclear_legacy_load');
  const uncertain = { ...mapping, entries: [{ ...assignment, analysis: { comparisonUncertain: true } }] };
  const result = run([...ref(50), workout('target', '2026-11-14')], { mapping: uncertain });
  assert.equal(targetScore(result).reference, null);
  assert.ok(targetScore(result).warnings.includes('comparison_uncertain'));
});

test('known timer exercises never interpret legacy kg x 1 as seconds', () => {
  const result = run([workout('target', '2026-11-14', [set(93, 1)])], { exercises: [{ id: 'press', settings: { measurementType: 'duration' } }] });
  assert.equal(result.sessions[0].sets.length, 0);
  assert.equal(result.diagnostics[0].reason, 'missing_duration');
});

test('high repetitions and one-rep sets never use the 3–12 repetition index', () => {
  for (const reps of [1, 20]) {
    const result = run([workout('r', '2026-11-01', [set(40, reps), set(40, reps)]), workout('target', '2026-11-14', [set(35, reps)])]);
    assert.equal(targetScore(result).reference.method, 'same_repetitions');
  }
});

test('training age only decreases color and old history remains distinct from no history', () => {
  const workouts = [workout('w', '2026-11-01T12:00:00Z')];
  const colors = [1, 2, 5, 10, 15].map(day => run(workouts, { now: `2026-11-${String(day + 1).padStart(2, '0')}T12:00:00Z` }).muscles.chest.intensity);
  for (let i = 1; i < colors.length; i++) assert.ok(colors[i] < colors[i - 1]);
  const old = run(workouts, { now: '2026-11-20T12:00:00Z' });
  assert.equal(old.muscles.chest.status, 'older_history');
  assert.equal(old.muscles.chest.intensity, 0);
  assert.equal(old.muscles.calves.status, 'no_history');
});

test('yesterday heavy can contribute more than today light', () => {
  const prior = ref(50);
  const heavy = run([...prior, workout('target', '2026-11-14', [set(50), set(50)])]).muscles.chest.rawLoad;
  const light = run([...prior, workout('target', '2026-11-15', [set(10), set(10)])]).muscles.chest.rawLoad;
  assert.ok(heavy > light);
});

test('actual training date survives late completion and edit timestamps', () => {
  const w = workout('w', '2026-10-01');
  w.completedAt = NOW;
  w.updatedAt = NOW;
  const result = run([w]);
  assert.equal(result.muscles.chest.intensity, 0);
  assert.equal(result.muscles.chest.lastTrainedDate, '2026-10-01');
  const invalid = { ...w, date: '2026-02-30' };
  assert.equal(run([invalid]).sessions.length, 0);
  assert.equal(run([{ ...invalid, date: '' }]).sessions[0].dateSource, 'completion_fallback');
});

test('date-only ages use local calendar days across DST and future dates stay excluded', () => {
  const result = run([workout('dst', '2026-10-25')], { now: '2026-10-26T00:30:00+01:00' });
  assert.equal(result.sessions[0].ageDays, 1);
  assert.equal(run([workout('future', '2026-11-16')]).sessions.length, 0);
  assert.equal(run([workout('future-completion', '2026-11-01'), { ...workout('x', '2026-11-01'), completedAt: '2026-11-16' }]).sessions.length, 1);
});

test('empty drafts, skipped, invalid and explicitly warmup sets do not contribute', () => {
  const result = run([
    { ...workout('draft', '2026-11-14'), completedAt: null },
    workout('skip', '2026-11-14', [set()], { skipped: true }),
    workout('invalid', '2026-11-14', [set(40, 0), set(40, 8, { invalid: true }), set(40, 8, { setType: 'warmup' })]),
  ]);
  assert.equal(result.muscles.chest.intensity, 0);
  assert.equal(result.sessions.flatMap(item => item.sets).length, 0);
});

test('duplicate muscle roles, set IDs and workout IDs never inflate the result', () => {
  const w = workout('w', '2026-11-14', [set(40, 8, { id: 's' })]);
  const clean = run([w]);
  const duplicated = structuredClone(w);
  duplicated.exercises.push(structuredClone(duplicated.exercises[0]));
  const result = run([duplicated, duplicated], { mapping: { ...mapping, entries: [{ ...assignment, secondary: ['chest', 'triceps'] }] } });
  assert.equal(result.muscles.chest.rawLoad, clean.muscles.chest.rawLoad);
  assert.equal(clean.muscles.triceps.rawLoad, clean.muscles.chest.rawLoad * 0.5);
  assert.equal(result.sessions.length, 1);
});

test('tentative mappings and future-only variants are not applied to unverified history', () => {
  const tentative = { ...mapping, entries: [{ ...assignment, status: 'tentative_variant' }] };
  assert.equal(run([workout('w', '2026-11-14')], { mapping: tentative }).diagnostics[0].reason, 'unresolved_mapping');
  const scoped = { ...mapping, entries: [{ ...assignment, variantDetails: { applyToPriorWorkouts: false, variantKey: 'from_floor' } }] };
  const result = run([workout('old', '2026-11-10'), workout('new', '2026-11-14', [set()], { variantKey: 'from_floor' })], { mapping: scoped });
  assert.equal(result.sessions[0].sets.length, 0);
  assert.equal(result.sessions[1].sets.length, 1);
  assert.equal(result.sessions[1].sets[0].reference, null);
});

test('structured effort affects the estimate; comments do not fabricate effort', () => {
  const evaluate = (extra) => targetScore(run([...ref(50), workout('target', '2026-11-14', [set(40, 8, extra)])]));
  assert.ok(evaluate({ rir: 0 }).contribution > evaluate({ rir: 5 }).contribution);
  assert.equal(evaluate({ comment: 'very hard, zero reserve' }).effortFactor, 1);
  assert.equal(evaluate({ rir: '0' }).effortFactor, 1);
});

test('calculation leaves source data untouched and validates configuration', () => {
  const input = { workouts: ref(50), mapping, now: NOW };
  const before = structuredClone(input);
  const a = calculateMuscleLoad(input);
  assert.deepEqual(input, before);
  assert.deepEqual(calculateMuscleLoad(input), a);
  assert.throws(() => run([], { options: { halfLifeHours: 0 } }));
  assert.throws(() => run([], { now: 'invalid' }));
  assert.equal(muscleLoadColor(0), '#73777b');
  assert.equal(muscleLoadColor(1), '#dc3030');
});
