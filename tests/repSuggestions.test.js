import test from 'node:test';
import assert from 'node:assert/strict';
import { getExerciseRepSuggestions } from '../src/utils/repSuggestions.js';

const sequence = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const workout = (date, reps, exerciseId = 'row') => ({ date, exercises: [{ exerciseId, sets: reps.map(reps => ({ reps })) }] });

test('repetition choices use compact one-step defaults without suitable history', () => {
  assert.deepEqual(getExerciseRepSuggestions([], 'row'), sequence(5, 12));
  assert.deepEqual(getExerciseRepSuggestions([workout('2026-10-31', [20, 20], 'other')], 'row'), sequence(5, 12));
});

test('recent same-exercise sessions set the range independently of input array order', () => {
  const workouts = [
    workout('2026-10-01', [50, 50]),
    workout('2026-10-30', [8, 10]),
    workout('2026-10-31', [10, 12]),
    workout('2026-10-29', [8, 8]),
  ];
  const snapshot = structuredClone(workouts);
  assert.deepEqual(getExerciseRepSuggestions(workouts, 'row'), sequence(5, 12));
  assert.deepEqual(workouts, snapshot);
});

test('weighted and weightless repetitions are eligible, durations and invalid values are not', () => {
  const workouts = [{ date: '2026-10-31', exercises: [{ exerciseId: 'row', sets: [
    { weight: 30, reps: 15 }, { weightMode: 'none', reps: 18 }, { weightMode: 'bodyweight', reps: 20 },
    { measurementType: 'duration', durationSeconds: 60, reps: 100 },
    { reps: 0 }, { reps: -1 }, { reps: 8.5 }, { reps: 1001 }, { reps: 'nope' },
  ] }] }];
  assert.deepEqual(getExerciseRepSuggestions(workouts, 'row'), sequence(15, 22));
});

test('low ranges stay positive and high ranges remain within valid entry limits', () => {
  assert.deepEqual(getExerciseRepSuggestions([workout('2026-10-31', [2, 3, 3])], 'row'), sequence(1, 8));
  assert.deepEqual(getExerciseRepSuggestions([workout('2026-10-31', [1000, 1000])], 'row'), sequence(993, 1000));
});

test('a compact observed range is included while an isolated extreme does not create dozens of buttons', () => {
  assert.deepEqual(getExerciseRepSuggestions([workout('2026-10-31', [5, 15, 15])], 'row'), sequence(5, 15));
  assert.deepEqual(getExerciseRepSuggestions([workout('2026-10-31', [8, 8, 50])], 'row'), sequence(5, 12));
});

test('empty newer workouts and another exercise do not hide the relevant history', () => {
  const workouts = [workout('2026-11-02', [], 'row'), workout('2026-11-01', [5, 5], 'other'), workout('2026-10-31', [18, 18])];
  const choices = getExerciseRepSuggestions(workouts, 'row');
  assert(choices.includes(18));
  assert(choices.length >= 8 && choices.length <= 12);
  assert(choices.every((value, index) => !index || value === choices[index - 1] + 1));
});
