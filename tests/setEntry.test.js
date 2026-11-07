import assert from 'node:assert/strict';
import test from 'node:test';
import { getRepeatedSetPayload, getSetEntryLoadType, getSetEntryWeight, getSetEntryWeightSuggestions } from '../src/utils/setEntry.js';
import { prepareSetValues } from '../src/utils/setMeasurements.js';

const pairedSettings = { loadType: 'paired' };
const paired = prepareSetValues({ weightMode: 'paired', individualWeight: 20, reps: 10 }).values;

test('editing old total and expression sets in paired mode preserves total through both validation layers', () => {
  for (const old of [{ weight: 40, reps: 10 }, { weight: 40, weightInput: '2x20', reps: 10 }]) {
    const type = getSetEntryLoadType(old, pairedSettings);
    assert.equal(type, 'paired');
    const input = getSetEntryWeight(old, type);
    assert.equal(input, 20);
    const edited = prepareSetValues({ weightMode: type, individualWeight: input, reps: 12 }).values;
    const saved = prepareSetValues(edited).values;
    assert.equal(saved.weight, 40);
    assert.equal(saved.reps, 12);
    assert.equal(old.reps, 10);
  }
});

test('editing stored paired sets retains per-weight input after changing settings', () => {
  for (const loadType of ['normal', 'paired', 'none', 'bodyweight']) {
    const type = getSetEntryLoadType(paired, { loadType });
    assert.equal(type, 'paired');
    assert.equal(getSetEntryWeight(paired, type), 20);
  }
  assert.equal(getSetEntryLoadType({ weightMode: 'none', reps: 10 }, pairedSettings), 'none');
  assert.equal(getSetEntryLoadType({ weightMode: 'bodyweight', addedWeight: 10 }, pairedSettings), 'bodyweight-added');
  assert.equal(getSetEntryLoadType(null, pairedSettings), 'paired');
  assert.equal(getSetEntryWeight(null, 'paired'), '');
  assert.equal(getSetEntryWeight(null, 'paired', true), 0);
});

test('repeat adapts total and paired modes without changing load or copying set identity', () => {
  const sources = [paired, { weight: 40, weightInput: '2x20', reps: 10 }, { weight: 40, reps: 10 }];
  for (const source of sources) {
    const repeated = getRepeatedSetPayload({ ...source, id: 'old', comment: 'old', savedAt: 'old' }, pairedSettings);
    const saved = prepareSetValues(repeated).values;
    assert.deepEqual(saved, paired);
    assert.equal(repeated.id, undefined);
    assert.equal(repeated.savedAt, undefined);
    assert.equal(repeated.comment, '');
  }
  const normal = prepareSetValues(getRepeatedSetPayload(paired, { loadType: 'normal' })).values;
  assert.deepEqual(normal, { weight: 40, reps: 10 });
  const again = prepareSetValues(getRepeatedSetPayload(normal, pairedSettings)).values;
  assert.deepEqual(again, paired);
});

test('repeat respects duration and incompatible modes', () => {
  const timed = { ...paired, measurementType: 'duration', durationSeconds: 30, reps: 0 };
  assert.deepEqual(prepareSetValues(getRepeatedSetPayload(timed, { ...pairedSettings, measurementType: 'duration' })).values, timed);
  assert.equal(getRepeatedSetPayload(timed, pairedSettings), null);
  assert.equal(getRepeatedSetPayload(paired, { loadType: 'bodyweight' }), null);
  assert.equal(getRepeatedSetPayload({ weightMode: 'none', reps: 12 }, pairedSettings), null);
  assert.deepEqual(prepareSetValues(getRepeatedSetPayload(paired, { loadType: 'none' })).values, { weight: 0, weightMode: 'none', reps: 10 });
});

test('suggestions convert between current settings and historical editing modes only once', () => {
  assert.deepEqual(getSetEntryWeightSuggestions([0, 20, 25], 'paired', 'paired'), [0, 20, 25]);
  assert.deepEqual(getSetEntryWeightSuggestions([0, 40, '2x20', 50], 'normal', 'paired'), [0, 20, 25]);
  assert.deepEqual(getSetEntryWeightSuggestions([0, 20, 25], 'paired', 'normal'), [0, 40, 50]);
  assert.deepEqual(getSetEntryWeightSuggestions(['2x20'], 'normal', 'normal'), ['2x20']);
});
