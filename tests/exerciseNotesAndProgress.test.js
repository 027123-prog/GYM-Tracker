import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';
import { buildExerciseChartData, calculateWorkoutStats, getExerciseWorkoutCount } from '../src/utils/workout.js';
import { formatWorkoutDuration } from '../src/utils/workoutDuration.js';
import { getExerciseVolumeProgress, getWorkoutAlternatives } from '../src/utils/workoutPresentation.js';

test('notes survive a backup and do not count as sets, exercises, chart sessions or elapsed time', () => {
  const notes = [{ id: 'note-1', comment: 'Ausgelassen', savedAt: '2026-11-22T15:30:00Z' }];
  const date = '2026-11-22T09:00:00Z';
  const completedAt = '2026-11-22T09:30:00Z';
  const sets = [
    { id: 'set-1', weight: 25, reps: 8, savedAt: '2026-11-22T09:10:00Z' },
    { id: 'set-2', weight: 25, reps: 8, savedAt: '2026-11-22T09:21:00Z' },
  ];
  const entry = {
    id: 'workout', name: 'Test', date, completedAt,
    exercises: [
      { id: 'a', exerciseId: 'row', name: 'Rudern', sets, notes },
      { id: 'b', exerciseId: 'curl', name: 'Curls', sets: [], notes },
    ],
  };
  const backup = createBackupPayload({ exercises: [], templates: [], maxStrengthRecords: [], workouts: [entry] });
  const state = parseBackupPayload(JSON.stringify(backup));
  assert.deepEqual(state.workouts[0].exercises[1].notes, notes);
  assert.deepEqual(calculateWorkoutStats(state.workouts[0]), { exerciseCount: 1, setCount: 2, totalVolume: 400 });
  assert.equal(formatWorkoutDuration(state.workouts[0]), '16 min');
  assert.equal(getExerciseWorkoutCount(state.workouts, 'curl'), 0);
  assert.deepEqual(buildExerciseChartData(state.workouts, 'curl'), []);
});

test('existing plus suggests trained bench variations and previous extras from the selected plan', () => {
  const names = ['Bankdrücken Hantel', 'Schrägbankdrücken Stange', 'Bankdrücken Stange', 'Multipresse', 'Nie trainiert', 'Archiviert'];
  const library = names.map((name, i) => ({id: String(i), name, archivedAt: i === 5 ? 'yesterday' : null}));
  const item = index => ({exerciseId: String(index), name: names[index], sets: [{weight: 30, reps: 8}]});
  const current = {guided: true, templateId: 'A', name: 'A', exercises: [item(0)]};
  const history = [{completedAt: 'today', templateId: 'B', exercises: [item(1),item(2)]},
    {completedAt: 'yesterday', templateId: 'A', exercises: [item(0),item(3),item(5)]}];
  assert.deepEqual(getWorkoutAlternatives(library, current, item(0), history).map(ex => ex.id), ['1','2','3']);
  assert.deepEqual(getWorkoutAlternatives(library, {...current, guided: false}, item(0), history), []);
});

test('exercise volume progress uses the last comparable non-outlier session', () => {
  const exercise = { sets: [{ weight: 50, reps: 5 }] };
  const history = (...volumes) => volumes.map((weight) => ({ sets: [{ weight, reps: 1 }] }));
  assert.equal(getExerciseVolumeProgress(exercise, history(500, 550, 450, 520)), 50);
  assert.equal(getExerciseVolumeProgress(exercise, history(2000, 500, 550, 450)), 50);
  assert.equal(getExerciseVolumeProgress(exercise, history(20, 500, 550, 450)), 50);
  assert.equal(getExerciseVolumeProgress(exercise, history(500)), 50);
  assert.equal(getExerciseVolumeProgress({ sets: [] }, history(500)), 0);
  assert.equal(getExerciseVolumeProgress({ ...exercise, skipped: true }, history(500)), null);
  assert.equal(getExerciseVolumeProgress(exercise, history(0)), null);
});
