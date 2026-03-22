import { useAppData } from '../components/AppProvider';
import DashboardHeader from '../components/DashboardHeader';
import QuickActionTile from '../components/QuickActionTile';
import WorkoutCard from '../components/WorkoutCard';
import EmptyState from '../components/EmptyState';

export default function DashboardPage() {
  const { state } = useAppData();
  const workouts = [...state.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      <DashboardHeader workoutCount={state.workouts.length} templateCount={state.templates.length} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickActionTile
          title="Neues freies Workout"
          description="Lege eine Session mit eigenem Namen an und füge Übungen flexibel per Autocomplete hinzu."
          to="/workouts/new"
          variant="solid"
        />
        <QuickActionTile
          title="Workout aus Vorlage"
          description="Starte aus vorhandenen Templates und bearbeite Reihenfolge, Sätze und Übungen frei weiter."
          to="/workouts/template"
          variant="soft"
        />
        {workouts.map((workout) => (
          <WorkoutCard key={workout.id} workout={workout} />
        ))}
      </section>
      {!workouts.length ? (
        <EmptyState
          title="Noch keine Workouts gespeichert"
          description="Starte oben direkt mit einem freien Workout oder wähle eine bestehende Vorlage aus."
        />
      ) : null}
    </div>
  );
}
