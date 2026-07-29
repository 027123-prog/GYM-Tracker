import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import ExerciseChartCard from '../components/ExerciseChartCard';
import { buildExerciseChartData } from '../utils/workout';

function ChartBackLink({ returnTo }) {
  const hasWorkoutContext = Boolean(returnTo);

  return (
    <Link to={returnTo || '/exercises'} className="secondary-button gap-2">
      <span aria-hidden="true">←</span>
      {hasWorkoutContext ? 'Zurück zum aktiven Workout' : 'Zur Übungsbibliothek'}
    </Link>
  );
}

export default function ExerciseChartPage() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAppData();
  const requestedReturnTo = location.state?.returnTo;
  const returnTo =
    typeof requestedReturnTo === 'string' && /^\/workouts\/[^/]+\/edit(?:\?.*)?$/.test(requestedReturnTo)
      ? requestedReturnTo
      : null;
  const sortedExercises = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const exercise = sortedExercises.find((item) => item.id === exerciseId);
  const exerciseIndex = sortedExercises.findIndex((item) => item.id === exerciseId);
  const data = buildExerciseChartData(state.workouts, exerciseId, exercise?.name);

  if (!exercise) {
    return (
      <section className="space-y-6">
        <div className="flex justify-start">
          <ChartBackLink returnTo={returnTo} />
        </div>
        <EmptyState title="Übung nicht gefunden" description="Für diese Übung konnte kein Eintrag geladen werden." />
      </section>
    );
  }

  if (!data.length) {
    return (
      <section className="space-y-6">
        <div className="flex justify-start">
          <ChartBackLink returnTo={returnTo} />
        </div>
        <EmptyState
          title="Noch keine Trainingshistorie"
          description="Sobald für diese Übung abgeschlossene Workouts vorhanden sind, erscheint hier das Diagramm."
        />
      </section>
    );
  }

  const latest = data[data.length - 1];

  function goToRelativeExercise(direction) {
    const nextIndex = exerciseIndex + direction;

    if (nextIndex < 0 || nextIndex >= sortedExercises.length) {
      return;
    }

    navigate(`/exercises/${sortedExercises[nextIndex].id}/chart`, {
      state: returnTo ? { returnTo } : null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <ChartBackLink returnTo={returnTo} />
      </div>
      <ExerciseChartCard
        exerciseName={exercise.name}
        data={data}
        canGoPrev={exerciseIndex > 0}
        canGoNext={exerciseIndex < sortedExercises.length - 1}
        onPrevExercise={() => goToRelativeExercise(-1)}
        onNextExercise={() => goToRelativeExercise(1)}
      />
      <section className="grid grid-cols-3 gap-2">
        <div className="metric">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Volumen</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{latest.volume.toFixed(0)} kg</p>
        </div>
        <div className="metric">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Max. Gewicht</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{latest.maxWeight} kg</p>
        </div>
        <div className="metric">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Reps bei Max</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{latest.maxWeightReps}</p>
        </div>
      </section>
    </div>
  );
}
