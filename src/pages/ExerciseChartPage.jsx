import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import ExerciseChartCard from '../components/ExerciseChartCard';
import ExerciseSettingsModal from '../components/ExerciseSettingsModal';
import { resolveExerciseNavigationOrder } from '../utils/exerciseSort';
import { buildExerciseChartData } from '../utils/workout';

function ChartBackLink({ returnTo, libraryReturnTo }) {
  const hasWorkoutContext = Boolean(returnTo);

  return (
    <Link to={returnTo || libraryReturnTo || '/exercises'} className="secondary-button gap-2">
      <span aria-hidden="true">←</span>
      {hasWorkoutContext ? 'Workout' : 'Bibliothek'}
    </Link>
  );
}

export default function ExerciseChartPage() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, updateExerciseSettings } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const requestedReturnTo = location.state?.returnTo;
  const returnTo =
    typeof requestedReturnTo === 'string' && /^\/workouts\/[^/]+\/edit(?:\?.*)?$/.test(requestedReturnTo)
      ? requestedReturnTo
      : null;
  const requestedLibraryReturnTo = location.state?.libraryReturnTo;
  const libraryReturnTo =
    typeof requestedLibraryReturnTo === 'string' && /^\/exercises(?:\?[^#]*)?$/.test(requestedLibraryReturnTo)
      ? requestedLibraryReturnTo
      : null;
  const requestedExerciseOrder = location.state?.exerciseOrder;
  const requestedExercises = resolveExerciseNavigationOrder(state.exercises, requestedExerciseOrder);
  const sortedExercises = requestedExercises.some((item) => item.id === exerciseId)
    ? requestedExercises
    : resolveExerciseNavigationOrder(state.exercises);
  const exercise = sortedExercises.find((item) => item.id === exerciseId);
  const exerciseIndex = sortedExercises.findIndex((item) => item.id === exerciseId);
  const data = buildExerciseChartData(state.workouts, exerciseId, exercise?.name);

  if (!exercise) {
    return (
      <section className="space-y-6">
        <div className="flex justify-start">
          <ChartBackLink returnTo={returnTo} libraryReturnTo={libraryReturnTo} />
        </div>
        <EmptyState title="Übung nicht gefunden" />
      </section>
    );
  }

  const latest = data[data.length - 1];
  const showDuration = latest?.maxDurationSeconds != null && (exercise.settings?.measurementType === 'duration' || (latest.maxWeight == null && latest.maxReps == null));
  const showWeightlessReps = latest?.maxReps != null && (exercise.settings?.loadType === 'none' || latest.maxWeight == null);
  const latestMetrics = latest ? (showDuration ? [
    { label: 'Gesamt', value: `${latest.totalDurationSeconds} s` },
    { label: 'Längster Satz', value: `${latest.maxDurationSeconds} s` },
    ...(latest.longestSetWeight > 0 ? [{ label: 'Gewicht dabei', value: `${latest.longestSetWeight} kg` }] : []),
  ] : showWeightlessReps ? [
    { label: 'Wdh. gesamt', value: latest.totalReps },
    { label: 'Max. Wdh.', value: latest.maxReps },
  ] : [
    { label: 'Volumen', value: `${latest.volume?.toFixed(0) ?? '–'} kg` },
    { label: 'Max. Gewicht', value: `${latest.maxWeight} kg` },
    { label: 'Wdh. dabei', value: latest.maxWeightReps },
  ]) : [];

  function goToRelativeExercise(direction) {
    const nextIndex = exerciseIndex + direction;

    if (nextIndex < 0 || nextIndex >= sortedExercises.length) {
      return;
    }

    navigate(`/exercises/${sortedExercises[nextIndex].id}/chart`, {
      state: {
        ...(returnTo ? { returnTo } : {}),
        ...(libraryReturnTo ? { libraryReturnTo } : {}),
        exerciseOrder: sortedExercises.map((item) => item.id),
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <ChartBackLink returnTo={returnTo} libraryReturnTo={libraryReturnTo} />
        <button type="button" className="secondary-button" onClick={() => setSettingsOpen(true)}>
          Bearbeiten
        </button>
      </div>
      {latest ? (
        <>
          <ExerciseChartCard
            exerciseName={exercise.name}
            measurementType={exercise.settings?.measurementType}
            loadType={exercise.settings?.loadType}
            data={data}
            canGoPrev={exerciseIndex > 0}
            canGoNext={exerciseIndex < sortedExercises.length - 1}
            onPrevExercise={() => goToRelativeExercise(-1)}
            onNextExercise={() => goToRelativeExercise(1)}
          />
          <section className={`grid gap-2 ${latestMetrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} aria-label="Letztes Training">
            {latestMetrics.map((item) => (
              <div key={item.label} className="metric">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                <p className="mt-2 text-xl font-bold tabular-nums text-ink">{item.value}</p>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button type="button" className="icon-button" aria-label="Vorherige Übung" disabled={exerciseIndex <= 0} onClick={() => goToRelativeExercise(-1)}>←</button>
            <h1 className="min-w-0 break-words font-display text-2xl font-bold text-ink">{exercise.name}</h1>
            <button type="button" className="icon-button" aria-label="Nächste Übung" disabled={exerciseIndex >= sortedExercises.length - 1} onClick={() => goToRelativeExercise(1)}>→</button>
          </div>
          <EmptyState
            title="Noch kein abgeschlossenes Training"
          />
        </>
      )}
      <ExerciseSettingsModal
        isOpen={settingsOpen}
        exerciseName={exercise.name}
        settings={exercise.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(settings) => updateExerciseSettings(exercise.id, settings)}
      />
    </div>
  );
}
