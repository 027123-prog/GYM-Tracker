import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutGoal, formatWorkoutGoal, getGoalProgress, guidedRepScheme, nextGoalQuantity } from '../src/utils/workoutGoals.js';
import { createBackupPayload, normalizeAppState, parseBackupPayload } from '../src/utils/storage.js';

const exercise = { id: 'row', name: 'Rudern', settings: { loadType: 'normal' }, weightOptions: [40, 42, 50] };
const entry = { id: 'entry', exerciseId: 'row', name: exercise.name, targetRepScheme: '2 × 6–8 · Pause 2–3 Min.', sets: [] };
const set = (weight, reps, extra) => ({ weight, reps, ...extra });
const workout = (day, item) => ({ id: 'w' + day, date: day, completedAt: day, templateId: 'A', exercises: [item] });
const create = (history, ex = exercise, item = entry) =>
  createWorkoutGoal(ex, item, history, { date: '2026-09-30', templateId: 'A' });
const starting = () => ({ ...create([]), amounts: [6, 6], load: 40 });
const done = (day, overrides = {}) => workout(day, { ...entry, sets: [set(40, 12), set(40, 9)],
  goal: { ...starting(), confirmed: true, ...overrides } });

test('guided bands are derived separately from template prescriptions and workout snapshots', () => {
  const raw = { exercises: [exercise], workouts: [workout('2026-09-19', entry)], templates: [
    { name: 'A', exerciseTemplates: [{ exerciseId: 'row', name: 'Rudern', repScheme: '3 × 8–12 je Seite · ca. 2 RIR' }] },
  ] };
  const state = normalizeAppState(raw);
  assert.equal(guidedRepScheme(exercise, state.templates[0].exerciseTemplates[0].repScheme), '3 × 6–9 je Seite · ca. 2 RIR');
  assert.equal(state.templates[0].exerciseTemplates[0].repScheme, '3 × 8–12 je Seite · ca. 2 RIR');
  assert.equal(state.workouts[0].exercises[0].targetRepScheme, entry.targetRepScheme);
  assert.equal(raw.templates[0].exerciseTemplates[0].repScheme, '3 × 8–12 je Seite · ca. 2 RIR');
  state.templates[0].exerciseTemplates[0].repScheme = '2 × 7–10';
  assert.equal(normalizeAppState(state).templates[0].exerciseTemplates[0].repScheme, '2 × 7–10');
  for (const name of ['Facepull', 'Face Pull', 'Beinbeuger', 'Reverse Flys', 'Seitheben', 'Bizeps am Kabelzug']) {
    assert.equal(guidedRepScheme({ name }, '2 × 12–20 · Pause 60–90 Sek.'), '2 × 8–11 · Pause 60–90 Sek.');
  }
  assert.equal(guidedRepScheme({ id: 'exercise-squat', name: 'Umbenannt' }, '2 × 8–12'), '2 × 5–8');
  const timed = '2 × 20–30 Sek. je Seite';
  assert.equal(guidedRepScheme({ name: 'Side Plank' }, timed), timed);
});

test('exercises inserted into a guided workout receive their own bands and a manageable load', () => {
  const free = { ...entry, targetRepScheme: '' };
  assert.deepEqual([create([], exercise, free).min, create([], exercise, free).max], [6, 9]);
  const history = [workout('2026-09-19', { ...free, sets: [set(30, 8), set(40, 5), set(40, 5)] })];
  const next = create(history, exercise, free);
  assert.deepEqual([next.load, next.amounts], [30, [6, 6]]);
});

test('seed uses repeated loads across recent comparable workout days and ignores drafts, other variants and isolated peaks', () => {
  const training = (day, weight, reps) => workout(day, { ...entry, sets: [set(20, 10), set(weight, reps), set(weight, reps), set(80, 2)] });
  const goal = create([training('2026-09-12', 40, 7), training('2026-09-19', 50, 8),
    { ...training('2026-09-23', 100, 12), completedAt: null },
    workout('2026-09-25', { ...entry, variantKey: 'other', sets: [set(90, 9), set(90, 9)] }),
    training('2026-10-01', 70, 8)]);
  assert.deepEqual([goal.load, goal.amounts], [40, [7, 7]]);
  assert.equal(create([training('2026-07-01', 90, 8)]).load, null);
});

test('only consecutive confirmed completions on distinct days advance one set, without changing old goals', () => {
  const first = done('2026-09-12');
  const second = done('2026-09-19');
  assert.deepEqual(create([first]).amounts, [6, 6]);
  assert.deepEqual(create([first, first]).amounts, [6, 6]);
  assert.deepEqual(create([first, second]).amounts, [7, 6]);
  assert.deepEqual(first.exercises[0].goal.amounts, [6, 6]);
  for (const stop of [
    done('2026-09-15', { confirmed: false }),
    workout('2026-09-15', { ...entry, sets: [set(40, 5)], goal: first.exercises[0].goal }),
  ]) assert.deepEqual(create([first, stop, second]).amounts, [6, 6]);
  const secondPlan = { ...second, templateId: 'B' };
  assert.deepEqual(create([first, secondPlan]).amounts, [6, 6]);
  const freeDay = workout('2026-09-16', { ...entry, sets: [set(40, 15)] });
  const skipped = workout('2026-09-17', { ...entry, goal: starting(), sets: [] });
  assert.deepEqual(create([first, freeDay, skipped, second]).amounts, [7, 6]);
});

test('at the ceiling the smallest suitable load restarts the range; larger machine steps are held', () => {
  const history = ['2026-09-12', '2026-09-19'].map(day => done(day, { amounts: [9, 9] }));
  const next = create(history);
  assert.deepEqual([next.load, next.amounts, next.step], [42, [6, 6], 'weight']);
  const held = create(history, { ...exercise, weightOptions: [45] });
  assert.deepEqual([held.load, held.amounts, held.step], [40, [9, 9], 'hold']);
});

test('floor deadlift starts with the first prescribed phase, and needs three days before a microplate step', () => {
  const ex = { ...exercise, id: 'exercise-deadlift', name: 'Kreuzheben', weightOptions: [60, 70] };
  const lift = { ...entry, exerciseId: ex.id, variantKey: 'floor_reset', targetRepScheme: 'Zunächst 2 × 5, später 2 × 5–8' };
  const seed = create([workout('2026-09-01', { ...lift, sets: [set(60, 8), set(60, 8)] })], ex, lift);
  assert.deepEqual([seed.load, seed.amounts, seed.confirmations], [60, [5, 5], 3]);
  const history = ['2026-09-05', '2026-09-12', '2026-09-19'].map(day => workout(day,
    { ...lift, goal: { ...seed, amounts: [8, 8], confirmed: true }, sets: [set(60, 8), set(60, 8)] }));
  assert.equal(create(history.slice(1), ex, lift).load, 60);
  const next = create(history, ex, lift);
  assert.deepEqual([next.load, next.amounts], [62.5, [5, 5]]);
});

test('warmups, invalid or wrong loads, and repetitions above one target cannot fill two targets', () => {
  const goal = { ...starting(), amounts: [7, 6] };
  const sets = [set(40, 6), set(40, 12, { setType: 'warmup' }), set(40, 10, { comment: 'WU' }),
    set(40, 11, { invalid: true }), set(20, 20), set(60, 12)];
  assert.deepEqual(getGoalProgress({ goal, sets }), { achieved: 1, total: 2, percent: 46, complete: false });
  assert.equal(nextGoalQuantity({ goal, sets }), 7);
  assert.equal(nextGoalQuantity({ goal, sets: [set(40, 7)] }), 6);
  assert.equal(getGoalProgress({ goal, sets: [...sets, set(40, 30)] }).complete, true);
});

test('paired total load, bodyweight assistance, and bilateral timed goals use their own units', () => {
  const paired = { ...starting(), mode: 'paired' };
  assert.match(formatWorkoutGoal(paired), /2 × 20 kg/);
  assert.equal(getGoalProgress({ goal: paired, sets: [set(40, 6), set(40, 6, { weightMode: 'paired' })] }).achieved, 1);
  const bw = { ...starting(), mode: 'bodyweight', factor: 0.4, load: 0 };
  assert.equal(getGoalProgress({ goal: bw, sets: [37, 39].map(weight => set(weight, 6,
    { weightMode: 'bodyweight', addedWeight: 0, bodyweightFactor: 0.4 })) }).complete, true);
  const hold = { ...starting(), duration: true, mode: 'none', load: 0, amounts: [20, 20], perSide: true };
  const timed = (comment) => set(0, 0, { weightMode: 'none', measurementType: 'duration', durationSeconds: 20, comment });
  assert.equal(getGoalProgress({ goal: hold, sets: Array(4).fill(timed('R')) }).percent, 50);
  assert.equal(getGoalProgress({ goal: hold, sets: Array(4).fill(timed('')) }).complete, true);
});

test('export roundtrip retains frozen goals and discards a malformed goal independently of recorded sets', () => {
  const frozen = done('2026-09-19');
  const broken = done('2026-09-12', { amounts: 'invalid' });
  const backup = createBackupPayload({ exercises: [exercise], workouts: [frozen, broken] });
  const loaded = parseBackupPayload(JSON.stringify(backup));
  assert.deepEqual(loaded.workouts[0].exercises[0].goal, frozen.exercises[0].goal);
  assert.equal(loaded.workouts[1].exercises[0].goal, undefined);
  assert.equal(loaded.workouts[1].exercises[0].sets.length, 2);
});
