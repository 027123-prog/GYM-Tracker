import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBodyweightLoad, parseLocalizedNumber } from '../src/utils/bodyweight.js';
import {
  buildExerciseChartData,
  calculateWorkoutStats,
  getExerciseWorkoutCount,
  getLastExerciseSnapshot,
  getLastExerciseWeight,
  sortWorkoutsByDate,
} from '../src/utils/workout.js';

test('Körpergewichtsanteil und Zusatzgewicht ergeben eine nachvollziehbare effektive Last', () => {
  assert.equal(calculateBodyweightLoad('90', 2 / 3, 0), 60);
  assert.equal(calculateBodyweightLoad('80', '⅔', 0), 53.3);
  assert.equal(parseLocalizedNumber('2/3'), 2 / 3);
  assert.equal(calculateBodyweightLoad('80,5', 1, '10'), 90.5);
  assert.equal(calculateBodyweightLoad(100, 1, -20), 80);
  assert.equal(calculateBodyweightLoad('', 1, 0), null);
  assert.equal(calculateBodyweightLoad(80, 0, 0), null);
});

test('calculateWorkoutStats ignoriert übersprungene Übungen vollständig', () => {
  const stats = calculateWorkoutStats({
    exercises: [
      {
        exerciseId: 'bench',
        skipped: false,
        sets: [
          { weight: 50, reps: 10 },
          { weight: '60', reps: '5' },
        ],
      },
      {
        exerciseId: 'row',
        skipped: true,
        sets: [
          { weight: 100, reps: 100 },
        ],
      },
      {
        exerciseId: 'squat',
        skipped: false,
        sets: [],
      },
    ],
  });

  assert.deepEqual(stats, {
    exerciseCount: 2,
    setCount: 2,
    totalVolume: 800,
  });
});

test('doppelte Übungen innerhalb eines Workouts werden als eine Einheit aggregiert', () => {
  const workouts = [
    {
      id: 'workout-1',
      name: 'Doppelte Bank',
      date: '2026-07-20T18:00:00.000Z',
      completedAt: '2026-07-20T19:00:00.000Z',
      exercises: [
        {
          id: 'entry-bench-1',
          exerciseId: 'bench',
          skipped: false,
          sets: [
            { id: 'set-1', weight: 50, reps: 10 },
          ],
        },
        {
          id: 'entry-bench-2',
          exerciseId: 'bench',
          skipped: false,
          sets: [
            { id: 'set-2', weight: 60, reps: 5 },
          ],
        },
        {
          id: 'entry-row',
          exerciseId: 'row',
          skipped: false,
          sets: [
            { id: 'set-3', weight: 40, reps: 10 },
          ],
        },
      ],
    },
  ];

  const chart = buildExerciseChartData(workouts, 'bench');
  const snapshot = getLastExerciseSnapshot(workouts, 'bench');

  assert.equal(chart.length, 1);
  assert.equal(chart[0].volume, 800);
  assert.equal(chart[0].maxWeight, 60);
  assert.equal(chart[0].maxWeightReps, 5);
  assert.deepEqual(chart[0].sets.map((setItem) => setItem.id), ['set-1', 'set-2']);
  assert.deepEqual(snapshot.sets.map((setItem) => setItem.id), ['set-1', 'set-2']);
  assert.equal(getLastExerciseWeight(workouts, 'bench'), 60);
  assert.equal(getExerciseWorkoutCount(workouts, 'bench'), 1);
});

test('Drafts werden in Verlauf, Chart und Workout-Zähler ignoriert', () => {
  const workouts = [
    {
      id: 'workout-completed',
      name: 'Abgeschlossen',
      date: '2026-07-10T18:00:00.000Z',
      completedAt: '2026-07-10T19:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          skipped: false,
          sets: [{ id: 'completed-set', weight: 70, reps: 5 }],
        },
      ],
    },
    {
      id: 'workout-draft',
      name: 'Entwurf',
      date: '2026-07-25T18:00:00.000Z',
      completedAt: null,
      exercises: [
        {
          exerciseId: 'bench',
          skipped: false,
          sets: [{ id: 'draft-set', weight: 100, reps: 3 }],
        },
      ],
    },
    {
      id: 'workout-skipped',
      name: 'Übersprungen',
      date: '2026-07-26T18:00:00.000Z',
      completedAt: '2026-07-26T19:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          skipped: true,
          sets: [{ id: 'skipped-set', weight: 120, reps: 1 }],
        },
      ],
    },
  ];

  const snapshot = getLastExerciseSnapshot(workouts, 'bench');
  const chart = buildExerciseChartData(workouts, 'bench');

  assert.equal(snapshot.workoutId, 'workout-completed');
  assert.deepEqual(snapshot.sets.map((setItem) => setItem.id), ['completed-set']);
  assert.equal(getLastExerciseWeight(workouts, 'bench'), 70);
  assert.deepEqual(chart.map((point) => point.workoutName), ['Abgeschlossen']);
  assert.equal(getExerciseWorkoutCount(workouts, 'bench'), 1);
});

test('sortWorkoutsByDate priorisiert das Workout-Datum trotz konfliktierender Abschlussdaten', () => {
  const workouts = [
    {
      id: 'older-workout-date',
      date: '2026-06-10T18:00:00.000Z',
      completedAt: '2026-12-31T23:00:00.000Z',
      updatedAt: '2026-12-31T23:30:00.000Z',
    },
    {
      id: 'fallback-updated-at',
      date: '',
      completedAt: 'kein-datum',
      updatedAt: '2026-08-01T18:00:00.000Z',
    },
    {
      id: 'newer-workout-date',
      date: '2026-07-10T18:00:00.000Z',
      completedAt: '2026-01-01T18:00:00.000Z',
      updatedAt: '2026-01-01T19:00:00.000Z',
    },
    {
      id: 'fallback-completed-at',
      date: 'ungültig',
      completedAt: '2026-05-01T18:00:00.000Z',
      updatedAt: '2027-01-01T18:00:00.000Z',
    },
    {
      id: 'without-valid-date',
      date: null,
      completedAt: null,
      updatedAt: 'ebenfalls-ungültig',
    },
  ];

  assert.deepEqual(
    sortWorkoutsByDate(workouts).map((workout) => workout.id),
    [
      'fallback-updated-at',
      'newer-workout-date',
      'older-workout-date',
      'fallback-completed-at',
      'without-valid-date',
    ],
  );
});

test('sortWorkoutsByDate verändert weder das Eingabearray noch dessen Reihenfolge', () => {
  const workouts = Object.freeze([
    { id: 'older', date: '2026-06-01T18:00:00.000Z' },
    { id: 'newer', date: '2026-07-01T18:00:00.000Z' },
  ]);
  const originalOrder = workouts.map((workout) => workout.id);

  const sorted = sortWorkoutsByDate(workouts);

  assert.notStrictEqual(sorted, workouts);
  assert.deepEqual(workouts.map((workout) => workout.id), originalOrder);
  assert.deepEqual(sorted.map((workout) => workout.id), ['newer', 'older']);
});
