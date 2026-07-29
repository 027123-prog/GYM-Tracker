import assert from 'node:assert/strict';
import test from 'node:test';

import { sortExerciseCards } from '../src/utils/exerciseSort.js';

function getNames(exercises) {
  return exercises.map((exercise) => exercise.name);
}

test('name-asc ist der Default und sortiert deutschsprachige Namen stabil', () => {
  const exercises = [
    { name: 'Rücken' },
    { name: 'Äpfel' },
    { name: 'Apfel' },
    { name: 'Knie' },
    { name: 'bank' },
    { name: 'Bank' },
  ];

  assert.deepEqual(
    getNames(sortExerciseCards(exercises)),
    ['Äpfel', 'Apfel', 'bank', 'Bank', 'Knie', 'Rücken'],
  );
  assert.deepEqual(
    getNames(sortExerciseCards(exercises, 'unbekannt')),
    ['Äpfel', 'Apfel', 'bank', 'Bank', 'Knie', 'Rücken'],
  );
});

test('name-desc sortiert absteigend und bewahrt Gleichstände stabil', () => {
  const exercises = [
    { name: 'Arm' },
    { name: 'Bank' },
    { name: 'bank' },
    { name: 'Zug' },
  ];

  assert.deepEqual(
    getNames(sortExerciseCards(exercises, 'name-desc')),
    ['Zug', 'Bank', 'bank', 'Arm'],
  );
});

test('count-desc sortiert nach Workout-Anzahl und löst Gleichstände mit A–Z auf', () => {
  const exercises = [
    { name: 'Zug', workoutCount: 8 },
    { name: 'Brust', workoutCount: '8' },
    { name: 'Knie', workoutCount: 'ungültig' },
    { name: 'Arm' },
    { name: 'Beine', workoutCount: 3 },
  ];

  assert.deepEqual(
    getNames(sortExerciseCards(exercises, 'count-desc')),
    ['Brust', 'Zug', 'Beine', 'Arm', 'Knie'],
  );
});

test('newest priorisiert gültige Erstellungsdaten und ordnet Legacy-Einträge nach sourceIndex', () => {
  const exercises = [
    { name: 'Datiert alt', createdAt: '2026-01-01T10:00:00.000Z', sourceIndex: 99 },
    { name: 'Legacy Mitte', sourceIndex: 4 },
    { name: 'Legacy neu', createdAt: 'kein-datum', sourceIndex: 9 },
    { name: 'Datiert neu', createdAt: '2026-02-01T10:00:00.000Z', sourceIndex: 0 },
    { name: 'Legacy alt', createdAt: null, sourceIndex: 1 },
    { name: 'Alpha', createdAt: '2026-01-01T10:00:00.000Z', sourceIndex: 100 },
  ];

  assert.deepEqual(
    getNames(sortExerciseCards(exercises, 'newest')),
    ['Datiert neu', 'Alpha', 'Datiert alt', 'Legacy neu', 'Legacy Mitte', 'Legacy alt'],
  );
});

test('last-trained sortiert letzte Trainings absteigend und nie trainierte Übungen ans Ende', () => {
  const exercises = [
    { name: 'Nie Z', lastTrainedAt: null },
    { name: 'Gleich B', lastTrainedAt: '2026-07-20T18:00:00.000Z' },
    { name: 'Alt', lastTrainedAt: '2026-06-01T18:00:00.000Z' },
    { name: 'Nie A', lastTrainedAt: 'ungültig' },
    { name: 'Gleich A', lastTrainedAt: '2026-07-20T18:00:00.000Z' },
  ];

  assert.deepEqual(
    getNames(sortExerciseCards(exercises, 'last-trained')),
    ['Gleich A', 'Gleich B', 'Alt', 'Nie A', 'Nie Z'],
  );
});

test('sortExerciseCards verändert weder Eingabearray noch Einträge', () => {
  const first = Object.freeze({ name: 'Zug', workoutCount: 1 });
  const second = Object.freeze({ name: 'Arm', workoutCount: 2 });
  const exercises = Object.freeze([first, second]);

  const sorted = sortExerciseCards(exercises, 'count-desc');

  assert.notStrictEqual(sorted, exercises);
  assert.deepEqual(sorted, [second, first]);
  assert.deepEqual(exercises, [first, second]);
  assert.strictEqual(sorted[0], second);
  assert.deepEqual(sortExerciseCards(null), []);
});
