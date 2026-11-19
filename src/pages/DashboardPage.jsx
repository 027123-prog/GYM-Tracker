import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import BackupControls from '../components/BackupControls';
import EmptyState from '../components/EmptyState';
import WorkoutCard from '../components/WorkoutCard';
import MuscleMapCard from '../components/muscle/MuscleMapCard';
import { getDashboardMetrics, PROGRESS_WINDOW_DAYS } from '../utils/dashboardMetrics';
import {
  calculateWorkoutStats,
  getWorkoutDateTimestamp,
  sortWorkoutsByDate,
} from '../utils/workout';

const progressFormat = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  signDisplay: 'exceptZero',
  maximumFractionDigits: 0,
});

function formatVolume(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

function hasRecordedSets(workout) {
  return workout.exercises.some((exercise) => exercise.sets?.length);
}

function hasLegacyDraftContent(workout, templates) {
  if (hasRecordedSets(workout)) {
    return true;
  }

  if (workout.mode === 'free') {
    return workout.name.trim() !== 'Freies Workout' || workout.exercises.length > 0;
  }

  const template = templates.find((item) => item.id === workout.templateId);

  if (!template) {
    return workout.exercises.length > 0;
  }

  if (workout.name.trim() !== template.name.trim()) {
    return true;
  }

  if (workout.exercises.length !== template.exerciseTemplates.length) {
    return true;
  }

  return workout.exercises.some((exercise, index) => {
    const templateExercise = template.exerciseTemplates[index];
    return (
      exercise.exerciseId !== templateExercise?.exerciseId ||
      exercise.name !== templateExercise?.name ||
      exercise.skipped
    );
  });
}

function isMeaningfulDraft(workout, templates) {
  if (workout.completedAt) {
    return false;
  }

  if (workout.draftStartedAt) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(workout, 'draftStartedAt')) {
    return false;
  }

  return hasLegacyDraftContent(workout, templates);
}

export default function DashboardPage() {
  const { state, activeWorkoutId } = useAppData();
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const nextDay = new Date(today);
    nextDay.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => setToday(new Date()), nextDay.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [today]);

  const sortedWorkouts = sortWorkoutsByDate(state.workouts);
  const completedWorkouts = sortedWorkouts.filter((workout) => workout.completedAt);
  const { daysSinceLastWorkout, progress } = getDashboardMetrics(completedWorkouts, today);
  const visibleWorkouts = showAllWorkouts ? completedWorkouts : completedWorkouts.slice(0, 6);
  const activeWorkout = state.workouts.find(
    (workout) => workout.id === activeWorkoutId && !workout.completedAt,
  );
  const currentDraft = activeWorkout
    ? null
    : sortedWorkouts.find((workout) => isMeaningfulDraft(workout, state.templates)) ?? null;
  const currentDraftStats = currentDraft ? calculateWorkoutStats(currentDraft) : null;
  const monthStart = new Date(today);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
  const monthlyWorkouts = completedWorkouts.filter((workout) => {
    const workoutTimestamp = getWorkoutDateTimestamp(workout);
    return (
      workoutTimestamp !== null &&
      workoutTimestamp >= monthStart.getTime() &&
      workoutTimestamp < nextMonthStart.getTime()
    );
  });
  const totalVolume = completedWorkouts.reduce(
    (sum, workout) => sum + calculateWorkoutStats(workout).totalVolume,
    0,
  );
  const totalSets = completedWorkouts.reduce(
    (sum, workout) => sum + calculateWorkoutStats(workout).setCount,
    0,
  );

  return (
    <div className="space-y-5">
      {currentDraft ? (
        <section className="panel border-amber/35 bg-gradient-to-r from-amber-soft to-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Offenes Training</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{currentDraft.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {currentDraftStats.exerciseCount} Übungen · {currentDraftStats.setCount} Sätze
              </p>
            </div>
            <Link to={`/workouts/${currentDraft.id}/edit`} className="action-button">
              Fortsetzen
            </Link>
          </div>
        </section>
      ) : null}

      <section className="dashboard-overview" aria-label="Trainingsübersicht">
        <div className="dashboard-overview-figure">
          <MuscleMapCard exercises={state.exercises} workouts={state.workouts} />
        </div>
        <div className="metric dashboard-metric dashboard-metric-progress"
          title={`Mittlere Veränderung der besten Sätze derselben Übungen. Letzte ${PROGRESS_WINDOW_DAYS} Tage gegenüber den ${PROGRESS_WINDOW_DAYS} Tagen davor.`}
        >
          <p className="eyebrow">Fortschritt</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{progress === null ? '–' : progressFormat.format(progress)}</span>
            <span className="text-xs text-muted">{progress === null ? 'Keine Vergleichsdaten' : `${PROGRESS_WINDOW_DAYS} Tage`}</span>
          </p>
        </div>
        <div className="metric dashboard-metric dashboard-metric-recency">
          <p className="eyebrow">Letztes Workout</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{daysSinceLastWorkout === 0 ? 'Heute' : daysSinceLastWorkout ?? '–'}</span>
            {daysSinceLastWorkout !== 0 && (
              <span className="text-xs text-muted">{daysSinceLastWorkout === null ? 'Kein Eintrag' : daysSinceLastWorkout === 1 ? 'Tag her' : 'Tage her'}</span>
            )}
          </p>
        </div>
        <div className="metric dashboard-metric dashboard-metric-total">
          <p className="eyebrow">Gesamt</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{completedWorkouts.length}</span>
            <span className="text-xs text-muted">Workouts</span>
          </p>
        </div>
        <div className="metric dashboard-metric dashboard-metric-month">
          <p className="eyebrow">Monat</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{monthlyWorkouts.length}</span>
            <span className="text-xs text-muted">Einheiten</span>
          </p>
        </div>
        <div className="metric dashboard-metric dashboard-metric-volume">
          <p className="eyebrow">Volumen</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{formatVolume(totalVolume)}</span>
            <span className="text-xs text-muted">kg</span>
          </p>
        </div>
        <div className="metric dashboard-metric dashboard-metric-sets">
          <p className="eyebrow">Sätze</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="dashboard-metric-value font-display font-bold tabular-nums text-ink">{totalSets}</span>
            <span className="text-xs text-muted">gesamt</span>
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="mt-1 text-lg font-bold text-ink">
              {showAllWorkouts ? 'Alle Workouts' : 'Letzte Workouts'}
            </h2>
          </div>
          <span className="text-xs font-semibold text-muted">
            {visibleWorkouts.length} von {completedWorkouts.length}
          </span>
        </div>
        {completedWorkouts.length ? (
          <div id="workout-history-list" className="divide-y divide-line">
            {visibleWorkouts.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} compact />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title="Noch kein Training abgeschlossen" />
          </div>
        )}
        {completedWorkouts.length > 6 ? (
          <div className="border-t border-line">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center text-muted transition hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber"
              aria-label={showAllWorkouts ? 'Auf sechs Einheiten einklappen' : `Alle ${completedWorkouts.length} Einheiten anzeigen`}
              aria-expanded={showAllWorkouts}
              aria-controls="workout-history-list"
              onClick={() => setShowAllWorkouts((current) => !current)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-5 w-5 transition-transform ${showAllWorkouts ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel p-4 lg:hidden">
        <BackupControls />
      </section>
      <div className="text-right text-xs text-muted">
        <a href={`${import.meta.env.BASE_URL}anatomy/credits.html`} target="_blank" rel="noreferrer" className="underline">3D-Quellen</a>
      </div>
    </div>
  );
}
