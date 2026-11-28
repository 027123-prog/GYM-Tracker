import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppState } from '../src/utils/storage.js';
import { homeValuesEqual, isFactoryHomeState, mergeHomeState } from '../src/utils/homeSyncMerge.js';

const workout = { id: 'w', name: 'Training A', exercises: [{
  id: 'entry', name: 'Übung A', sets: [{ id: 's1', reps: 6, weight: 30, comment: '' }], notes: [],
}] };
const base = { workouts: [workout] };
const entry = state => state.workouts[0].exercises[0];
const copy = structuredClone;

test('combines changes to a recorded set, new sets and notes without touching its inputs', () => {
  const a = copy(base), b = copy(base);
  entry(a).sets[0].reps = 7;
  entry(b).sets[0].comment = 'Reserve';
  entry(a).sets.push({ id: 's3', savedAt: '2026-01-01T11:02:00Z' });
  entry(b).sets.push({ id: 's2', savedAt: '2026-01-01T11:01:00Z' });
  entry(b).notes.push({ id: 'n', comment: 'Notiz vom PC' });
  a.workouts[0].updatedAt = '2026-01-01T11:03:00Z';
  b.workouts[0].updatedAt = '2026-01-01T11:04:00Z';
  const before = copy([base, a, b]);
  const result = mergeHomeState(base, a, b);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(entry(result.state).sets.map(s => s.id), ['s1', 's2', 's3']);
  assert.deepEqual(entry(result.state).sets[0], { id: 's1', reps: 7, weight: 30, comment: 'Reserve' });
  assert.deepEqual(entry(result.state).notes, entry(b).notes);
  assert.equal(result.state.workouts[0].updatedAt, b.workouts[0].updatedAt);
  assert.deepEqual([base, a, b], before);
  assert.deepEqual(mergeHomeState(base, b, a), result);
});

test('a deleted set stays deleted when the other device only edits its workout', () => {
  const a = copy(base), b = copy(base);
  entry(a).sets = [];
  b.workouts[0].name = 'Umbenannt';
  entry(b).sets.push({ id: 's2', reps: 3 });
  const { state, conflicts } = mergeHomeState(base, a, b);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(entry(state).sets, [{ id: 's2', reps: 3 }]);
  assert.equal(state.workouts[0].name, 'Umbenannt');
});

test('deletion versus edit offers both decisions without rolling back other fields', () => {
  const a = copy(base), b = copy(base);
  entry(a).sets = [];
  entry(b).sets[0].reps = 9;
  entry(b).notes.push({ id: 'n', comment: 'Zusätzlich' });
  const result = mergeHomeState(base, a, b);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].path, ['workouts', 'w', 'exercises', 'entry', 'sets', 's1']);
  assert.match(result.conflicts[0].label, /Training A.*Übung A.*Satz 1/);
  assert.equal(result.conflicts[0].localPreview, 'Gelöscht');
  assert.deepEqual(entry(result.state).sets, []);
  assert.equal(entry(result.state).notes[0].id, 'n');
  assert.deepEqual(mergeHomeState(base, a, b, { prefer: 'remote' }).state, b);
});

test('resolving overlapping measurements preserves independent changes from both devices', () => {
  const a = copy(base), b = copy(base);
  Object.assign(entry(a).sets[0], { reps: 7, comment: 'Gut' });
  Object.assign(entry(b).sets[0], { reps: 8, weight: 35 });
  for (const prefer of ['local', 'remote']) {
    const result = mergeHomeState(base, a, b, { prefer });
    assert.equal(result.conflicts.length, 1);
    assert.deepEqual(result.conflicts[0].path.slice(-3), ['sets', 's1', 'reps']);
    assert.equal(result.conflicts[0].localPreview, '7');
    assert.equal(result.conflicts[0].remotePreview, '8');
    assert.deepEqual(entry(result.state).sets[0], { id: 's1', reps: prefer === 'local' ? 7 : 8, weight: 35, comment: 'Gut' });
  }
});

test('plan exercise IDs keep inserted exercises next to their neighbours after reordering', () => {
  const plan = ids => ({ templates: [{ id: 'p', name: 'Plan', exerciseTemplates: ids.map(exerciseId => ({ exerciseId })) }] });
  const ids = result => result.state.templates[0].exerciseTemplates.map(e => e.exerciseId);
  const initial = plan(['k', 'l', 'm']);
  const a = plan(['m', 'k', 'l']);
  const b = plan(['k', 'x', 'l', 'm']);
  const result = mergeHomeState(initial, a, b);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(ids(result), ['m', 'k', 'x', 'l']);
  const bothReordered = plan(['l', 'x', 'k', 'm']);
  const choice = mergeHomeState(initial, a, bothReordered, { prefer: 'remote' });
  assert.deepEqual(choice.conflicts.map(c => c.path), [['templates', 'p', 'exerciseTemplates', '$order']]);
  assert.deepEqual(ids(choice), ['l', 'x', 'k', 'm']);
});

test('without a common ancestor distinct histories and strength records are retained', () => {
  const a = { workouts: [{ id: 'a', name: 'A', date: '2026-01-01' }], maxStrengthRecords: [{ id: 'r1' }] };
  const b = { workouts: [{ id: 'b', name: 'A', date: '2026-01-03' }], maxStrengthRecords: [{ id: 'r2' }] };
  const result = mergeHomeState(null, a, b);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.state.workouts.map(w => w.id), ['b', 'a']);
  assert.deepEqual(result.state.maxStrengthRecords.map(v => v.id).sort(), ['r1', 'r2']);
  assert.deepEqual(mergeHomeState(null, a, null), { state: a, conflicts: [] });
  b.workouts = [{ ...a.workouts[0], name: 'Geändert' }];
  assert.deepEqual(mergeHomeState(null, a, b).conflicts.map(c => c.path), [['workouts', 'a', 'name']]);
});

test('an unused second installation adopts the personalized device with its removed templates', () => {
  const clean = normalizeAppState();
  const personal = copy(clean);
  personal.workouts.push(workout);
  personal.templates = [];
  const android = { ...clean, maxStrengthRecords: [], meta: { ...clean.meta, lastSyncAt: '2026-01-01' } };
  assert.equal(isFactoryHomeState(android), true);
  assert.equal(isFactoryHomeState(clean), true);
  assert.equal(isFactoryHomeState(personal), false);
  assert.deepEqual(mergeHomeState(null, android, personal), { state: personal, conflicts: [] });
  assert.deepEqual(mergeHomeState(null, personal, clean), { state: personal, conflicts: [] });
});

test('first merge combines custom fields on different seeded exercises without factory collisions', () => {
  const a = normalizeAppState(), b = copy(a);
  const expected = copy(a);
  a.exercises[0].name = expected.exercises[0].name = 'Eigen A';
  b.exercises[1].name = expected.exercises[1].name = 'Eigen B';
  assert.deepEqual(mergeHomeState(null, a, b), { state: expected, conflicts: [] });
});

test('weight option additions and removals on both devices are kept', () => {
  const options = weightOptions => ({ exercises: [{ id: 'a', weightOptions }] });
  const result = mergeHomeState(options([20, 25, 30]), options([20, 30, 35]), options([20, 25, 40]));
  assert.deepEqual(result, { state: options([20, 35, 40]), conflicts: [] });
});

test('a missing factory exercise is not reintroduced by the unchanged preset on another used device', () => {
  const a = normalizeAppState(), b = copy(a);
  const removedId = a.exercises.shift().id;
  a.exercises.push({ id: 'added', name: 'Gerät' });
  b.exercises[1].name = 'Eigener Name';
  const { state, conflicts } = mergeHomeState(null, a, b);
  assert.deepEqual(conflicts, []);
  assert.equal(state.exercises.some(e => e.id === removedId), false);
  assert.equal(state.exercises.some(e => e.id === 'added'), true);
  assert.equal(state.exercises.some(e => e.name === 'Eigener Name'), true);
});

test('positional values and ambiguous duplicate IDs preserve either complete variant on conflict', () => {
  const a = { amounts: [5, 6], sets: [{ id: 's' }, { id: 's' }] };
  const b = { amounts: [5, 7], sets: [{ id: 't' }] };
  const result = mergeHomeState({ amounts: [5, 5], sets: [] }, a, b, { prefer: 'remote' });
  assert.deepEqual(result.state, b);
  assert.deepEqual(result.conflicts.map(c => c.path), [['amounts'], ['sets']]);
});

test('JSON comparisons ignore object key order and omitted fields but preserve array order', () => {
  assert.equal(homeValuesEqual({ a: 1, b: [2], c: undefined }, { b: [2], a: 1 }), true);
  assert.equal(homeValuesEqual([1, 2], [2, 1]), false);
  assert.equal(homeValuesEqual({ a: null }, {}), false);
});
