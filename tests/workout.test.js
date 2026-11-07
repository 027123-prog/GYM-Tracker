import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBodyweightLoad, parseLocalizedNumber } from '../src/utils/bodyweight.js';
import {
  buildExerciseChartData,
  calculateWorkoutStats,
  getExerciseWorkoutCount,
  getLastExerciseSnapshot,
  getLastExerciseWeight,
  getExerciseChartMetricOptions,
  resolveExerciseChartMetric,
  exerciseChartMetrics,
  normalizeExerciseLibraryMetric,
  resolveExerciseLibraryMetric,
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
    exerciseCount: 1,
    setCount: 2,
    totalVolume: 800,
  });
});

test('Übungszahlen zählen gespeicherte Sätze aller Messarten und erhalten leere Vorlagenübungen', () => {
  const workout = { mode: 'template', completedAt: null, exercises: [
    { exerciseId: 'empty', sets: [] },
    { exerciseId: 'missing' },
    { exerciseId: 'skipped', skipped: true, sets: [{ weight: 100, reps: 10 }] },
    { exerciseId: 'zero-load', sets: [{ weight: 0, reps: 10 }] },
    { exerciseId: 'reps-only', sets: [{ weightMode: 'none', weight: 0, reps: 12 }] },
    { exerciseId: 'duration', sets: [{ weightMode: 'none', weight: 0, measurementType: 'duration', durationSeconds: 20, reps: 0 }] },
    { exerciseId: 'paired', sets: [{ weightMode: 'paired', weight: 40, reps: 10 }] },
    { exerciseId: 'bodyweight', sets: [{ weightMode: 'bodyweight', weight: 80, reps: 5 }] },
  ] };
  const snapshot = structuredClone(workout);
  const expected = { exerciseCount: 5, setCount: 5, totalVolume: 800, totalDurationSeconds: 20, totalReps: 12 };
  assert.deepEqual(calculateWorkoutStats(workout), expected);
  assert.deepEqual(calculateWorkoutStats({ ...workout, completedAt: '2026-11-07T21:00:00Z' }), expected);
  assert.deepEqual(workout, snapshot);
  assert.equal(workout.exercises.length, 8);
});

test('Übungszahl steigt mit dem ersten Satz und sinkt nach Löschen des letzten Satzes', () => {
  const workout = { exercises: [{ exerciseId: 'planned', sets: [] }] };
  assert.equal(calculateWorkoutStats(workout).exerciseCount, 0);
  workout.exercises[0].sets.push({ weight: 20, reps: 10 });
  assert.equal(calculateWorkoutStats(workout).exerciseCount, 1);
  workout.exercises[0].sets.push({ weight: 30, reps: 8 });
  assert.equal(calculateWorkoutStats(workout).exerciseCount, 1);
  workout.exercises[0].sets.pop();
  assert.equal(calculateWorkoutStats(workout).exerciseCount, 1);
  workout.exercises[0].sets.pop();
  assert.deepEqual(calculateWorkoutStats(workout), { exerciseCount: 0, setCount: 0, totalVolume: 0 });
  assert.equal(workout.exercises.length, 1);
  assert.deepEqual(calculateWorkoutStats({}), { exerciseCount: 0, setCount: 0, totalVolume: 0 });
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
  assert.equal(chart[0].maxReps, 10);
  assert.equal(chart[0].totalReps, 15);
  assert.deepEqual(chart[0].sets.map((setItem) => setItem.id), ['set-1', 'set-2']);
  assert.deepEqual(snapshot.sets.map((setItem) => setItem.id), ['set-1', 'set-2']);
  assert.equal(getLastExerciseWeight(workouts, 'bench'), 60);
  assert.equal(getExerciseWorkoutCount(workouts, 'bench'), 1);
});

test('chart metrics offer repetition counts for weighted exercises while retaining volume as the default', () => {
  const data = [{ volume: 800, maxWeight: 60, maxReps: 10, totalReps: 15, maxDurationSeconds: null, totalDurationSeconds: null }];
  assert.deepEqual(getExerciseChartMetricOptions(data), ['volume', 'maxWeight', 'maxReps', 'reps']);
  assert.equal(resolveExerciseChartMetric(data, { loadType: 'normal' }), 'volume');
  assert.equal(resolveExerciseChartMetric(data, { loadType: 'normal' }, 'reps'), 'reps');
  assert.equal(resolveExerciseChartMetric(data, { loadType: 'normal' }, 'totalDuration'), 'volume');
});

test('time totals are independently selectable without turning seconds into repetitions or kilograms', () => {
  const workouts = [{ id: 'time', name: 'Halteübung', date: '2026-10-31', completedAt: '2026-10-31', exercises: [{ exerciseId: 'plank', sets: [
    { id: 'one', measurementType: 'duration', durationSeconds: 40, weightMode: 'none', weight: 0, reps: 0 },
    { id: 'two', measurementType: 'duration', durationSeconds: 50, weightMode: 'none', weight: 0, reps: 0 },
  ] }] }];
  const before = structuredClone(workouts);
  const data = buildExerciseChartData(workouts, 'plank');
  assert.equal(data[0].totalDurationSeconds, 90);
  assert.equal(data[0].maxDurationSeconds, 50);
  assert.equal(data[0].maxReps, null);
  assert.equal(data[0].totalReps, null);
  assert.equal(data[0].volume, null);
  assert.deepEqual(getExerciseChartMetricOptions(data), ['duration', 'totalDuration']);
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration', loadType: 'none' }), 'duration');
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration' }, 'totalDuration'), 'totalDuration');
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration' }, 'reps'), 'duration');
  assert.deepEqual(workouts, before);
});

test('automatic chart choice keeps weightless and mixed-duration exercise defaults meaningful', () => {
  const weightless = [{ volume: null, maxWeight: null, maxReps: 12, totalReps: 21, maxDurationSeconds: null }];
  const mixed = [{ volume: 300, maxWeight: 30, maxReps: 10, totalReps: 10, maxDurationSeconds: 50, totalDurationSeconds: 90 }];
  assert.equal(resolveExerciseChartMetric(weightless, { loadType: 'none' }), 'maxReps');
  assert.equal(resolveExerciseChartMetric(weightless, { loadType: 'none' }, 'volume'), 'maxReps');
  assert.equal(resolveExerciseChartMetric(mixed, { measurementType: 'duration' }), 'duration');
  assert.equal(resolveExerciseChartMetric(mixed, { measurementType: 'duration' }, 'reps'), 'duration');
  assert.equal(resolveExerciseChartMetric([], {}, 'not-a-metric'), 'volume');
});

test('explicit seconds exercises offer only compatible time metrics despite old repetition records', () => {
  const data = [
    { volume: 279, maxWeight: 93, maxReps: 1, totalReps: 3, maxDurationSeconds: null, totalDurationSeconds: null },
    { volume: null, maxWeight: null, maxReps: null, totalReps: null, maxDurationSeconds: 56, totalDurationSeconds: 109, maxDurationWeight: 0 },
  ];
  const before = structuredClone(data);
  assert.deepEqual(getExerciseChartMetricOptions(data, { measurementType: 'duration' }), ['duration', 'totalDuration']);
  assert.deepEqual(getExerciseChartMetricOptions(data), ['volume', 'maxWeight', 'maxReps', 'reps', 'duration', 'totalDuration']);
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration' }, 'volume'), 'duration');
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration' }, 'reps'), 'duration');
  assert.equal(resolveExerciseChartMetric(data, { measurementType: 'duration' }, 'totalDuration'), 'totalDuration');
  assert.equal(resolveExerciseChartMetric([data[0]], { measurementType: 'duration' }, 'reps'), 'duration');
  assert.deepEqual(getExerciseChartMetricOptions([{ ...data[1], maxDurationWeight: 20 }], { measurementType: 'duration' }), ['duration', 'totalDuration', 'durationWeight']);
  assert.deepEqual(data, before);
});

test('library volume and max represent weighted repetitions, repetition-only sets and time independently', () => {
  const workouts = [{
    id: 'mixed', name: 'Training', date: '2026-10-31', completedAt: '2026-10-31',
    exercises: [
      { exerciseId: 'weighted', sets: [{ weight: 50, reps: 10 }, { weight: 60, reps: 5 }] },
      { exerciseId: 'repetitions', sets: [{ weightMode: 'none', reps: 12 }, { weightMode: 'none', reps: 9 }] },
      { exerciseId: 'timed', sets: [
        { measurementType: 'duration', durationSeconds: 40, weight: 20 },
        { measurementType: 'duration', durationSeconds: 50, weight: 10 },
      ] },
    ],
  }];
  const before = structuredClone(workouts);
  const cases = [
    ['weighted', { measurementType: 'reps', loadType: 'bodyweight' }, 800, 60],
    ['repetitions', { measurementType: 'reps', loadType: 'none' }, 21, 12],
    ['timed', { measurementType: 'duration', loadType: 'normal' }, 90, 50],
  ];

  for (const [exerciseId, settings, volume, max] of cases) {
    const data = buildExerciseChartData(workouts, exerciseId);
    for (const [intent, expected] of [['volume', volume], ['max', max]]) {
      const metric = resolveExerciseLibraryMetric(data, settings, intent);
      assert.equal(data[0][exerciseChartMetrics[metric].field], expected, `${exerciseId}: ${intent}`);
    }
  }
  assert.deepEqual(workouts, before);
});

test('old library metric URLs preserve total or maximum intent with safe defaults', () => {
  for (const oldMetric of ['max', 'maxWeight', 'maxReps', 'duration', 'durationWeight']) {
    assert.equal(normalizeExerciseLibraryMetric(oldMetric), 'max');
  }
  for (const oldMetric of ['volume', 'reps', 'totalDuration', 'auto', 'unknown', '', null, undefined]) {
    assert.equal(normalizeExerciseLibraryMetric(oldMetric), 'volume');
  }
  assert.equal(resolveExerciseLibraryMetric([], { measurementType: 'duration' }, 'maxWeight'), 'duration');
  assert.equal(resolveExerciseLibraryMetric([], { loadType: 'none' }, 'totalDuration'), 'reps');
});

test('library metric intent respects current settings and never falls back from totals to maxima', () => {
  const weightedHistory = [{ volume: 0, maxWeight: 0, maxReps: 10, totalReps: 20 }];
  const durationHistory = [{ maxDurationSeconds: 50, totalDurationSeconds: 90 }];
  assert.equal(resolveExerciseLibraryMetric(weightedHistory, { measurementType: 'duration' }, 'volume'), 'totalDuration');
  assert.equal(resolveExerciseLibraryMetric(weightedHistory, { measurementType: 'duration' }, 'max'), 'duration');
  assert.equal(resolveExerciseLibraryMetric(weightedHistory, { loadType: 'none' }, 'volume'), 'reps');
  assert.equal(resolveExerciseLibraryMetric(weightedHistory, { loadType: 'none' }, 'max'), 'maxReps');
  assert.equal(resolveExerciseLibraryMetric(durationHistory, { measurementType: 'reps', loadType: 'normal' }, 'volume'), 'volume');
  assert.equal(resolveExerciseLibraryMetric(weightedHistory, {}, 'max'), 'maxWeight');
  assert.equal(resolveExerciseLibraryMetric(durationHistory, {}, 'volume'), 'totalDuration');
  assert.equal(resolveExerciseLibraryMetric([{ maxWeight: null, maxReps: 12, totalReps: 21 }], {}, 'volume'), 'reps');
});

test('gespeicherte Sätze laufender Trainings erscheinen im Chart, ohne den abgeschlossenen Verlauf oder Zähler zu ändern', () => {
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
  assert.deepEqual(chart.map((point) => point.workoutName), ['Abgeschlossen', 'Entwurf']);
  assert.deepEqual(chart.map((point) => point.isInProgress), [false, true]);
  assert.equal(chart[1].workoutId, 'workout-draft');
  assert.equal(chart[1].volume, 300);
  assert.equal(chart[1].maxWeight, 100);
  assert.equal(getExerciseWorkoutCount(workouts, 'bench'), 1);
});

test('ein laufender Chartpunkt aktualisiert sich nach Speichern und Bearbeiten und bleibt beim Abschluss derselbe Punkt', () => {
  const completed = {
    id: 'previous', name: 'Vorher', date: '2026-11-06T10:00:00Z', completedAt: '2026-11-06T11:00:00Z',
    exercises: [{ exerciseId: 'press', sets: [{ id: 'old', weight: 30, reps: 10 }] }],
  };
  const running = {
    id: 'running', name: 'Heute', date: '2026-11-07T10:00:00Z', completedAt: null,
    exercises: [
      { id: 'entry-one', exerciseId: 'press', sets: [] },
      { id: 'entry-two', exerciseId: 'press', sets: [] },
      { exerciseId: 'press', skipped: true, sets: [{ id: 'skipped', weight: 100, reps: 100 }] },
    ],
  };
  const workouts = [running, completed];
  assert.deepEqual(buildExerciseChartData(workouts, 'press').map((point) => point.workoutId), ['previous']);

  running.exercises[0].sets.push({ id: 'first', weightMode: 'paired', weight: 40, weightInput: '2x20', reps: 10 });
  running.exercises[1].sets.push({ id: 'second', weight: 20, reps: 5 });
  const snapshot = structuredClone(workouts);
  const saved = buildExerciseChartData(workouts, 'press');
  assert.deepEqual(saved.map((point) => point.workoutId), ['previous', 'running']);
  assert.equal(saved[1].volume, 500);
  assert.equal(saved[1].maxWeight, 40);
  assert.equal(saved[1].maxWeightReps, 10);
  assert.deepEqual(saved[1].sets.map((setItem) => setItem.id), ['first', 'second']);
  assert.deepEqual(workouts, snapshot, 'Chart creation must not change training data');
  assert.equal(getExerciseWorkoutCount(workouts, 'press'), 1);
  assert.equal(getLastExerciseSnapshot(workouts, 'press').workoutId, 'previous');

  running.exercises[0].sets[0] = { id: 'first', weightMode: 'paired', weight: 50, weightInput: '2x25', reps: 9 };
  const edited = buildExerciseChartData(workouts, 'press');
  assert.equal(edited.length, 2);
  assert.equal(edited[1].volume, 550);
  assert.equal(edited[1].maxWeight, 50);
  assert.equal(edited[1].maxWeightReps, 9);
  assert.equal(edited[1].totalReps, 14);

  running.completedAt = '2026-11-07T11:00:00Z';
  const finished = buildExerciseChartData(workouts, 'press');
  assert.equal(finished.length, 2);
  assert.deepEqual(finished[1], { ...edited[1], isInProgress: false });
  assert.equal(getExerciseWorkoutCount(workouts, 'press'), 2);
});

test('laufende Zeitübungen aktualisieren Haltegewicht und Dauer ohne Wiederholungsvolumen', () => {
  const workout = {
    id: 'carry-now', name: 'Carry', date: '2026-11-07T10:00:00Z', completedAt: null,
    exercises: [{ exerciseId: 'carry', sets: [
      { id: 'first', measurementType: 'duration', durationSeconds: 40, weight: 20, reps: 0 },
    ] }],
  };
  const [first] = buildExerciseChartData([workout], 'carry');
  assert.equal(first.isInProgress, true);
  assert.equal(first.maxDurationSeconds, 40);
  assert.equal(first.totalDurationSeconds, 40);
  assert.equal(first.maxDurationWeight, 20);

  workout.exercises[0].sets.push({ id: 'second', measurementType: 'duration', durationSeconds: 60, weight: 30, reps: 0 });
  const [updated] = buildExerciseChartData([workout], 'carry');
  assert.equal(updated.totalDurationSeconds, 100);
  assert.equal(updated.maxDurationSeconds, 60);
  assert.equal(updated.maxDurationWeight, 30);
  assert.equal(updated.volume, null);
  assert.equal(updated.maxWeight, null);
  assert.equal(updated.totalReps, null);
  assert.equal(getExerciseWorkoutCount([workout], 'carry'), 0);
});

test('leere, übersprungene und nicht passende laufende Übungseinträge erzeugen keine Chartpunkte', () => {
  const workouts = [
    { id: 'empty', date: '2026-11-07', completedAt: null, exercises: [{ exerciseId: 'press', sets: [] }] },
    { id: 'skipped', date: '2026-11-07', completedAt: null, exercises: [{ exerciseId: 'press', skipped: true, sets: [{ weight: 50, reps: 10 }] }] },
    { id: 'other', date: '2026-11-07', completedAt: null, exercises: [{ exerciseId: 'row', sets: [{ weight: 50, reps: 10 }] }] },
  ];
  assert.deepEqual(buildExerciseChartData(workouts, 'press'), []);
  assert.equal(getExerciseWorkoutCount(workouts, 'press'), 0);
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

test('letztes Übungs-Workout richtet sich nach dem Workout-Datum statt dem Abschlusszeitpunkt', () => {
  const workouts = [
    {
      id: 'older-workout',
      name: 'Spät abgeschlossen',
      date: '2026-06-10T18:00:00.000Z',
      completedAt: '2026-07-30T20:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          skipped: false,
          sets: [{ id: 'older-set', weight: 60, reps: 8 }],
        },
      ],
    },
    {
      id: 'newer-workout',
      name: 'Früher abgeschlossen',
      date: '2026-07-20T18:00:00.000Z',
      completedAt: '2026-07-20T19:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          skipped: false,
          sets: [{ id: 'newer-set', weight: 70, reps: 5 }],
        },
      ],
    },
  ];

  const snapshot = getLastExerciseSnapshot(workouts, 'bench');

  assert.equal(snapshot.workoutId, 'newer-workout');
  assert.equal(snapshot.workoutDate, '2026-07-20T18:00:00.000Z');
  assert.deepEqual(snapshot.sets.map((setItem) => setItem.id), ['newer-set']);
});
