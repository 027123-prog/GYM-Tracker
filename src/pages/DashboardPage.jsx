import { Link } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import BackupControls from '../components/BackupControls';
import EmptyState from '../components/EmptyState';
import WorkoutCard from '../components/WorkoutCard';
import {
  calculateWorkoutStats,
  getWorkoutDateTimestamp,
  sortWorkoutsByDate,
} from '../utils/workout';

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
  const { state } = useAppData();
  const sortedWorkouts = sortWorkoutsByDate(state.workouts);
  const completedWorkouts = sortedWorkouts.filter((workout) => workout.completedAt);
  const currentDraft = sortedWorkouts.find((workout) => isMeaningfulDraft(workout, state.templates)) ?? null;
  const monthStart = new Date();
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
      <section className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
        <Link to="/workouts/template" className="secondary-button w-full px-3">
          Aus Vorlage
        </Link>
        <Link to="/workouts/new" className="action-button w-full px-3">
          Workout starten
        </Link>
      </section>

      {currentDraft ? (
        <section className="panel border-amber/35 bg-gradient-to-r from-amber-soft to-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Offenes Training</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{currentDraft.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {currentDraft.exercises.length} Übungen · {calculateWorkoutStats(currentDraft).setCount} Sätze erfasst
              </p>
            </div>
            <Link to={`/workouts/${currentDraft.id}/edit`} className="action-button">
              Fortsetzen
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="metric">
          <p className="eyebrow">Gesamt</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{completedWorkouts.length}</p>
          <p className="mt-1 text-xs text-muted">Workouts</p>
        </div>
        <div className="metric">
          <p className="eyebrow">Dieser Monat</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{monthlyWorkouts.length}</p>
          <p className="mt-1 text-xs text-muted">Einheiten</p>
        </div>
        <div className="metric">
          <p className="eyebrow">Volumen</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{formatVolume(totalVolume)}</p>
          <p className="mt-1 text-xs text-muted">kg bewegt</p>
        </div>
        <div className="metric">
          <p className="eyebrow">Sätze</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{totalSets}</p>
          <p className="mt-1 text-xs text-muted">abgeschlossen</p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <div>
            <p className="eyebrow">Verlauf</p>
            <h2 className="mt-1 text-lg font-bold text-ink">Letzte Workouts</h2>
          </div>
          <span className="text-xs font-semibold text-muted">{completedWorkouts.length} gesamt</span>
        </div>
        {completedWorkouts.length ? (
          <div className="divide-y divide-line">
            {completedWorkouts.slice(0, 10).map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} compact />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState title="Noch kein Workout abgeschlossen" description="Starte dein erstes Training." />
          </div>
        )}
      </section>

      <section className="panel p-4 lg:hidden">
        <p className="eyebrow">Daten</p>
        <p className="mb-3 mt-1 text-sm text-muted">Sicherung exportieren oder wieder einspielen.</p>
        <BackupControls />
      </section>
    </div>
  );
}
