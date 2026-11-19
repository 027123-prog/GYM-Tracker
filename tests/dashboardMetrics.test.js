import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardMetrics } from '../src/utils/dashboardMetrics.js';

const now = new Date(2026, 10, 19, 10);
const exercise = (exerciseId, ...sets) => ({ exerciseId, sets });
const session = (date, ...exercises) => ({ date, exercises, completedAt: date });

test('counts local calendar days and ignores drafts and future workouts', () => {
  const workouts = [
    session('2026-11-16'),
    session('2026-11-20'),
    { date: '2026-11-19', completedAt: null },
    session('invalid'),
  ];
  assert.deepEqual(getDashboardMetrics(workouts, now), { daysSinceLastWorkout: 3, progress: null });
  assert.equal(getDashboardMetrics([...workouts, session('2026-11-19')], now).daysSinceLastWorkout, 0);

  const sunday = new Date(2026, 2, 29, 8);
  const saturday = new Date(2026, 2, 28, 22).toISOString();
  assert.equal(getDashboardMetrics([session(saturday)], sunday).daysSinceLastWorkout, 1);
});

test('compares only like-for-like best sets in the two consecutive 28-day windows', () => {
  const workouts = [
    session('2026-10-22', exercise('squat', { weight: 100, reps: 5 }), exercise('plank', { measurementType: 'duration', durationSeconds: 40 }), exercise('chin-up', { weightMode: 'none', reps: 4 })),
    session('2026-10-23', exercise('squat', { weight: 100, reps: 3 })),
    session('2026-11-16', exercise('squat', { weight: 100, reps: 6 }), exercise('plank', { measurementType: 'duration', durationSeconds: 20 }), exercise('chin-up', { weightMode: 'none', reps: 8 }), exercise('new', { weight: 999, reps: 2 })),
    session('2026-09-24', exercise('squat', { weight: 500, reps: 5 })),
  ];
  const result = getDashboardMetrics(workouts, now);
  assert.equal(result.daysSinceLastWorkout, 3);
  assert.ok(Math.abs(result.progress - 0.2) < 1e-9);
});

test('shows no progress without comparable data from completed workouts', () => {
  const workouts = [
    session('2026-10-22', exercise('chin-up', { weight: 20, reps: 5 })),
    session('2026-11-18', exercise('chin-up', { weightMode: 'none', reps: 5 })),
    { ...session('2026-11-19', exercise('chin-up', { weight: 22, reps: 5 })), completedAt: null },
  ];
  assert.equal(getDashboardMetrics(workouts, now).progress, null);
  assert.deepEqual(getDashboardMetrics([], now), { daysSinceLastWorkout: null, progress: null });
});
