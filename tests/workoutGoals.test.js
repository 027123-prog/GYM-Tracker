import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutGoal, formatNextGoalSet, formatWorkoutGoal, getExerciseTabPercent, getGoalProgress, guidedRepScheme, nextGoalQuantity, nextWarmup } from '../src/utils/workoutGoals.js';
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

test('floor deadlift increases one rep after one confirmation and adds 5 kg after two ceiling confirmations', () => {
  const ex = { ...exercise, id: 'exercise-deadlift', name: 'Kreuzheben', weightOptions: [60, 70] };
  const lift = { ...entry, exerciseId: ex.id, variantKey: 'floor_reset', targetRepScheme: 'Zunächst 2 × 5, später 2 × 5–8' };
  const seed = create([workout('2026-09-01', { ...lift, sets: [set(60, 8), set(60, 8)] })], ex, lift);
  assert.deepEqual([seed.load, seed.amounts, seed.confirmations, seed.weightConfirmations], [60, [5, 5], 1, 2]);
  const history = ['2026-09-05', '2026-09-12', '2026-09-19'].map(day => workout(day,
    { ...lift, goal: { ...seed, amounts: [8, 8], confirmed: true }, sets: [set(60, 8), set(60, 8)] }));
  assert.equal(create(history.slice(2), ex, lift).load, 60);
  assert.deepEqual(create([workout('2026-09-19', { ...lift, goal: { ...seed, confirmed: true }, sets: [set(60, 5), set(60, 5)] })], ex, lift).amounts, [6, 5]);
  const next = create(history, ex, lift);
  assert.deepEqual([next.load, next.amounts], [65, [5, 5]]);
});

test('repeat recent ascending warmups, excluding a drop set, and switch to work on save or skip', () => {
  const day = workout('2026-09-20', { ...entry, sets: [set(0, 10), set(20, 6), set(40, 7), set(40, 7), set(15, 12)] });
  const goal = create([day]);
  assert.deepEqual(goal.warmups, [{ load: 0, reps: 10 }, { load: 20, reps: 6 }]);
  const current = { ...entry, goal, sets: [] };
  assert.equal(formatNextGoalSet(current), '0 kg × 10 Wdh. (Warm-up)');
  current.sets.push(set(0, 10, { setType: 'warmup' }));
  assert.equal(formatNextGoalSet(current), '20 kg × 6 Wdh. (Warm-up)');
  assert.equal(getGoalProgress(current).percent, 0);
  current.sets.push(set(40, 7, { setType: 'work' }));
  assert.equal(nextWarmup(current), null);
  assert.equal(formatNextGoalSet(current), '40 kg × 7 Wdh.');
  assert.equal(getGoalProgress(current).percent, 50);
  const restored = parseBackupPayload(JSON.stringify(createBackupPayload({ exercises: [exercise], workouts: [workout('2026-09-21', current)] })));
  assert.deepEqual(restored.workouts[0].exercises[0].goal.warmups, goal.warmups);
});

test('explicit paired warmup survives an equal working weight and other variations never supply it', () => {
  const pair = { ...exercise, settings: { loadType: 'paired' } };
  const paired = (w, n, extra) => set(w, n, { weightMode: 'paired', ...extra });
  const sets = [paired(20, 8, { comment: 'WU' }), paired(20, 8), paired(20, 8)];
  const history = [workout('2026-09-22', { ...entry, sets }), workout('2026-09-24', { ...entry, variantKey:'other', sets: [paired(4, 10), ...sets] })];
  const goal = create(history, pair);
  assert.equal(formatNextGoalSet({ goal, sets: [] }), '2 × 10 kg × 8 Wdh. (Warm-up)');
  assert.equal(create([workout('2026-09-20', { ...entry, sets: [set(20, 6, { setType: 'work' }), set(40, 7), set(40, 7)] })]).warmups, undefined);
});

test('a machine uses its next known size, dumbbells use small per-hand steps and a lone heavy attempt does not set a bench target', () => {
  const machine = { ...exercise, weightOptions: [60, 65, 70] };
  const ceiling = { ...starting(), load: 60, amounts: [9, 9], confirmed: true };
  const cycle = (goal, sets) => ['2026-09-12', '2026-09-19'].map(day => workout(day, { ...entry, goal, sets }));
  const next = create(cycle(ceiling, [set(60, 9), set(60, 9)]), machine);
  assert.deepEqual([next.load, next.amounts], [65, [6, 6]]);
  const pair = { ...exercise, settings: { loadType: 'paired' }, weightOptions: [24, 28, 32] };
  const dbSet = set(32, 9, { weightMode: 'paired' });
  const dumbbell = create(cycle({ ...ceiling, mode: 'paired', load: 32 }, [dbSet, dbSet]), pair);
  assert.deepEqual([dumbbell.load, dumbbell.amounts], [34, [6, 6]]);
  const intro = create([workout('2026-09-20', { ...entry, sets: [set(30, 10), set(50, 7)] })]);
  assert.deepEqual([intro.load, intro.amounts, intro.step], [30, [6, 6], 'intro']);
});

test('the whole tab credits warmups while reserve remains tied to work, including skips and edits', () => {
  const goal = { ...starting(), warmups: [{load: 10, reps: 8}, {load: 20, reps: 6}] };
  const current = { ...entry, goal, sets: [] };
  const warm = (w) => set(w, 8, { setType: 'warmup' });
  const work = set(40, 6);
  for (const [record, percent] of [[warm(10), 25], [warm(20), 50], [work, 75], [work, 100]]) {
    current.sets.push(record);
    assert.equal(getExerciseTabPercent(current), percent);
    assert.equal(getGoalProgress(current).complete, percent === 100);
  }
  assert.equal(getExerciseTabPercent({ ...current, sets: [warm(10), work] }), 67);
  assert.equal(getExerciseTabPercent({ ...current, sets: [work] }), 50);
  assert.equal(getExerciseTabPercent({ ...current, sets: [warm(10), warm(20), warm(30)] }), 50);
  assert.equal(getExerciseTabPercent({ ...current, skipped: true }), 0);
  assert.equal(getExerciseTabPercent({ ...current, sets: [{...warm(20), invalid: true}] }), 0);
  assert.equal(getExerciseTabPercent({ ...current, goal: starting(), sets: [warm(10)] }), 33);
});

test('side plank progresses beyond the old guided range, checking both sides in seconds', () => {
  const ex = { id: 'side', name: 'Side Plank', settings: { measurementType: 'duration', loadType: 'none' } };
  const en = { ...entry, exerciseId: ex.id, name: ex.name, targetRepScheme: '2 × 20–30 Sek. je Seite · mit Reserve' };
  const timed = (s, comment) => ({ weight: 0, weightMode: 'none', measurementType: 'duration', durationSeconds: s, comment });
  const full = [timed(40,'L'), timed(40,'R'), timed(40,'L'), timed(40,'R')];
  const old = { ...create([], ex, en), max: 30, amounts: [30, 30], confirmed: true };
  const first = create([workout('2026-09-01', { ...en, goal: old, sets: full })], ex, en);
  assert.deepEqual(first.amounts, [40, 40]);
  assert.ok(!first.scheme.includes('20–30'));
  const days = ['2026-09-12', '2026-09-19'].map(day => workout(day,{ ...en, goal:{ ...first, confirmed:true }, sets:full }));
  assert.deepEqual(create(days.slice(0,1), ex, en).amounts, [40,40]);
  const next = create(days, ex, en);
  assert.deepEqual(next.amounts, [42,40]);
  assert.equal(nextGoalQuantity({ ...en, goal:next, sets: [timed(40,'L'),timed(40,'R')] }), 42);
  assert.equal(nextGoalQuantity({ ...en, goal:next, sets: [timed(42,'L'),timed(40,'R')] }), 40);
  assert.equal(getGoalProgress({ ...en, goal:first, sets:full.map(s => ({...s, comment:'L'})) }).complete, false);
  assert.deepEqual(old.amounts,[30,30]);
});

test('warmup-only sessions do not break reserve confirmations', () => {
  const warm = workout('2026-09-15', { ...entry, goal: starting(), sets: [set(20, 8, { setType: 'warmup' })] });
  assert.deepEqual(create([done('2026-09-12'), warm, done('2026-09-19')]).amounts, [7, 6]);
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
