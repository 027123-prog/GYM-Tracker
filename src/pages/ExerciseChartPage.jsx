import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import ExerciseChartCard from '../components/ExerciseChartCard';
import { buildExerciseChartData } from '../utils/workout';

export default function ExerciseChartPage() {
  const { exerciseId } = useParams();
  const { state } = useAppData();
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  const data = buildExerciseChartData(state.workouts, exerciseId);

  if (!exercise) {
    return (
      <EmptyState
        title="Übung nicht gefunden"
        description="Für diese Übung konnte kein Bibliothekseintrag geladen werden."
      />
    );
  }

  if (!data.length) {
    return (
      <section className="space-y-6">
        <div className="flex justify-end">
          <Link to="/" className="secondary-button">
            Zurück
          </Link>
        </div>
        <EmptyState
          title="Noch keine Trainingshistorie"
          description="Sobald für diese Übung abgeschlossene Workouts vorhanden sind, erscheint hier das Diagramm."
        />
      </section>
    );
  }

  const latest = data[data.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link to="/" className="secondary-button">
          Zurück
        </Link>
      </div>
      <ExerciseChartCard exerciseName={exercise.name} data={data} />
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Neuester Verlauf</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{latest.volume.toFixed(0)} kg</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Max. Gewicht</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{latest.maxWeight} kg</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Reps bei Max</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{latest.maxWeightReps}</p>
        </div>
      </section>
    </div>
  );
}
